import type { ApiV3Token, LaunchpadPoolInfo, OwnerIdoInfo } from "@raydium-io/raydium-sdk-v2";
import { LaunchpadPool } from "@raydium-io/raydium-sdk-v2";
import { Connection, PublicKey } from "@solana/web3.js";

import type { StoredMarketToken } from "./localMarkets";

const DEFAULT_CLUSTER = (import.meta.env.VITE_SOLANA_CLUSTER as "devnet" | "mainnet") ?? "devnet";
const DEFAULT_RPC =
    import.meta.env.VITE_SOLANA_RPC_ENDPOINT ??
    (DEFAULT_CLUSTER === "mainnet" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com");
const DEFAULT_OWNER_BASE =
    import.meta.env.VITE_RAYDIUM_OWNER_BASE ??
    (DEFAULT_CLUSTER === "mainnet" ? "https://owner-v1.raydium.io" : "https://owner-v1-devnet.raydium.io");
const DEFAULT_API_BASE =
    import.meta.env.VITE_RAYDIUM_API_BASE ??
    (DEFAULT_CLUSTER === "mainnet" ? "https://api-v3.raydium.io" : "https://api-v3-devnet.raydium.io");
const FALLBACK_PLATFORM_ID = "9s82BCAuWCtXub1MytzfH93LG2cRM41YEF8CYTZpc8w5";
const DEFAULT_PLATFORM_ID = import.meta.env.VITE_SLAB_PLATFORM_CONFIG_ID?.trim() ?? FALLBACK_PLATFORM_ID;

const connectionCache = new Map<string, Connection>();

const getConnection = (endpoint: string) => {
    const normalized = endpoint.trim();
    if (!connectionCache.has(normalized)) {
        connectionCache.set(normalized, new Connection(normalized, "confirmed"));
    }
    return connectionCache.get(normalized)!;
};

const chunk = <T,>(items: T[], size: number): T[][] => {
    if (size <= 0) return [items];
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
};

const buildUrl = (base: string, path: string) => {
    const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
    return `${trimmed}${path.startsWith("/") ? path : `/${path}`}`;
};

const parseOwnerPayload = (payload: unknown): OwnerIdoInfo => {
    if (!payload || typeof payload !== "object") return {};
    if ("data" in payload && payload.data && typeof payload.data === "object") {
        return parseOwnerPayload(payload.data);
    }
    return payload as OwnerIdoInfo;
};

const fetchMintInfos = async (baseUrl: string, mints: string[]): Promise<Map<string, ApiV3Token>> => {
    const unique = Array.from(new Set(mints.map((mint) => mint?.trim()).filter((mint): mint is string => !!mint)));
    if (!unique.length) return new Map();

    const url = new URL(buildUrl(baseUrl, "/mint/ids"));
    url.searchParams.set("mints", unique.join(","));

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`Raydium mint metadata request failed: ${response.status}`);
    }

    const body = await response.json();
    const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    const map = new Map<string, ApiV3Token>();
    for (const entry of list) {
        if (entry && typeof entry.address === "string") {
            map.set(entry.address, entry as ApiV3Token);
        }
    }
    return map;
};

const decodePoolAccounts = async (
    connection: Connection,
    poolIds: string[],
): Promise<Record<string, LaunchpadPoolInfo>> => {
    const result: Record<string, LaunchpadPoolInfo> = {};
    const publicKeys = poolIds.map((id) => new PublicKey(id));

    for (const slice of chunk(publicKeys, 100)) {
        const infos = await connection.getMultipleAccountsInfo(slice);
        infos.forEach((info, idx) => {
            const pubkey = slice[idx];
            if (!info?.data) return;
            try {
                const decoded = LaunchpadPool.decode(info.data);
                result[pubkey.toBase58()] = decoded;
            } catch (error) {
                console.warn("[Launchpad] Failed to decode pool", pubkey.toBase58(), error);
            }
        });
    }

    return result;
};

export interface FetchCreatorLaunchesOptions {
    owner: string;
    rpcEndpoint?: string;
    ownerApiBase?: string;
    raydiumApiBase?: string;
    platformId?: string | null;
    cluster?: "devnet" | "mainnet";
}

export interface FetchCreatorLaunchesResult {
    tokens: StoredMarketToken[];
}

export async function fetchCreatorLaunches({
    owner,
    rpcEndpoint = DEFAULT_RPC,
    ownerApiBase = DEFAULT_OWNER_BASE,
    raydiumApiBase = DEFAULT_API_BASE,
    platformId = DEFAULT_PLATFORM_ID ?? null,
    cluster = DEFAULT_CLUSTER,
}: FetchCreatorLaunchesOptions): Promise<FetchCreatorLaunchesResult> {
    const ownerKey = owner.trim();
    if (!ownerKey) {
        return { tokens: [] };
    }

    const ownerUrl = buildUrl(ownerApiBase, `/main/ido/${ownerKey}`);
    let response: Response;
    try {
        response = await fetch(ownerUrl);
    } catch (error) {
        throw new Error(`Failed to reach Raydium owner API: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!response.ok) {
        if (response.status === 404) {
            return { tokens: [] };
        }
        throw new Error(`Raydium owner API error (${response.status})`);
    }

    const payload = parseOwnerPayload(await response.json());
    const entries = Object.entries(payload ?? {});
    if (!entries.length) {
        return { tokens: [] };
    }

    const poolIds = entries.map(([, info]) => info.poolId).filter((id): id is string => typeof id === "string");
    const coinMints = entries.map(([, info]) => info.coin).filter((id): id is string => typeof id === "string");

    const connection = getConnection(rpcEndpoint);
    const [poolMap, mintMap] = await Promise.all([
        decodePoolAccounts(connection, poolIds),
        fetchMintInfos(raydiumApiBase, coinMints).catch((error) => {
            console.warn("[Launchpad] mint metadata fetch failed", error);
            return new Map<string, ApiV3Token>();
        }),
    ]);

    const normalizedPlatformId = platformId ? new PublicKey(platformId).toBase58() : null;
    const now = Date.now();

    const tokens: StoredMarketToken[] = [];
    for (const [, info] of entries) {
        const poolInfo = info.poolId ? poolMap[info.poolId] : null;
        if (!poolInfo) continue;

        if (normalizedPlatformId && poolInfo.platformId.toBase58() !== normalizedPlatformId) {
            continue;
        }

        const mintAddress = typeof info.coin === "string" ? info.coin : null;
        if (!mintAddress) continue;

        const tokenMeta = mintMap.get(mintAddress);
        const symbolFallback = mintAddress ? mintAddress.slice(0, 6).toUpperCase() : "SLAB";

        tokens.push({
            id: mintAddress,
            mintAddress,
            poolId: info.poolId,
            creator: poolInfo.creator.toBase58(),
            launchedAt: now,
            cluster,
            symbol: tokenMeta?.symbol ?? symbolFallback,
            name: tokenMeta?.name ?? tokenMeta?.symbol ?? symbolFallback,
            decimals: tokenMeta?.decimals ?? poolInfo.mintDecimalsA ?? 6,
            imageUrl: tokenMeta?.logoURI,
            holderCount: 0,
            liquidity: 0,
            usdPrice: undefined,
            launchpad: "SLAB",
        });
    }

    return { tokens };
}

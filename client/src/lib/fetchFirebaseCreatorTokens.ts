import { equalTo, get, orderByChild, query, ref } from "firebase/database";

import { getFirebaseDatabase, hasFirebaseConfig } from "./firebaseClient";
import type { StoredMarketToken } from "./localMarkets";

interface FirebaseCreatorTokenRecord {
    mintAddress?: string;
    poolId?: string;
    name?: string;
    symbol?: string;
    imageUrl?: string;
    icon?: string;
    description?: string;
    metadataUri?: string;
    signer?: string;
    deployer?: string;
    createdAt?: string | number;
    cluster?: "devnet" | "mainnet" | string;
    website?: string;
    twitter?: string;
    telegram?: string;
    launchpad?: string;
    referrerFeePct?: number;
    usdPrice?: number;
    volume24h?: number;
    liquidity?: number;
    holderCount?: number;
    stats24h?: {
        priceChange?: number;
        buyVolume?: number;
        sellVolume?: number;
    };
    [key: string]: unknown;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const normalizeTimestamp = (value: unknown): number => {
    if (isFiniteNumber(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return Date.now();
};

const selectString = (value: unknown): string | undefined => (typeof value === "string" && value.trim().length ? value.trim() : undefined);

const toStoredMarketToken = (
    record: FirebaseCreatorTokenRecord,
    key: string,
    expectedSigner: string,
): StoredMarketToken | null => {
    const mintAddress = selectString(record.mintAddress) ?? key;
    if (!mintAddress) {
        return null;
    }

    const symbolSource = selectString(record.symbol) ?? selectString(record.name) ?? mintAddress.slice(0, 6).toUpperCase();
    const nameSource = selectString(record.name) ?? symbolSource;
    const creator = selectString(record.signer) ?? selectString(record.deployer) ?? expectedSigner;

    if (!creator) {
        return null;
    }

    return {
        id: mintAddress,
        mintAddress,
        poolId: selectString(record.poolId),
        name: nameSource,
        symbol: symbolSource.toUpperCase(),
        imageUrl: selectString(record.imageUrl) ?? selectString(record.icon),
        icon: selectString(record.icon) ?? selectString(record.imageUrl),
        description: selectString(record.description),
        metadataUri: selectString(record.metadataUri),
        creator,
        launchedAt: normalizeTimestamp(record.createdAt),
        cluster: record.cluster === "mainnet" || record.cluster === "devnet" ? record.cluster : undefined,
        website: selectString(record.website),
        twitter: selectString(record.twitter),
        telegram: selectString(record.telegram),
        launchpad: selectString(record.launchpad) ?? "SLAB",
        referrerFeePct: isFiniteNumber(record.referrerFeePct) ? record.referrerFeePct : undefined,
        usdPrice: isFiniteNumber(record.usdPrice) ? record.usdPrice : undefined,
        volume24h: isFiniteNumber(record.volume24h) ? record.volume24h : undefined,
        liquidity: isFiniteNumber(record.liquidity) ? record.liquidity : undefined,
        holderCount: isFiniteNumber(record.holderCount) ? record.holderCount : undefined,
        stats24h: record.stats24h && typeof record.stats24h === "object"
            ? {
                priceChange: isFiniteNumber(record.stats24h.priceChange) ? record.stats24h.priceChange : undefined,
                buyVolume: isFiniteNumber(record.stats24h.buyVolume) ? record.stats24h.buyVolume : undefined,
                sellVolume: isFiniteNumber(record.stats24h.sellVolume) ? record.stats24h.sellVolume : undefined,
            }
            : undefined,
    };
};

export interface FetchFirebaseCreatorTokensOptions {
    signer: string;
}

export const fetchFirebaseCreatorTokens = async ({ signer }: FetchFirebaseCreatorTokensOptions): Promise<StoredMarketToken[]> => {
    const normalizedSigner = selectString(signer);
    if (!normalizedSigner) {
        return [];
    }
    const normalizedSignerLower = normalizedSigner.toLowerCase();

    if (!hasFirebaseConfig()) {
        throw new Error("Firebase configuration missing");
    }

    const db = getFirebaseDatabase();
    if (!db) {
        throw new Error("Firebase database unavailable");
    }

    const tokensRef = ref(db, "tokens");
    const request = query(tokensRef, orderByChild("signer"), equalTo(normalizedSigner));
    try {
        const snapshot = await get(request);
        const raw = snapshot.val() as Record<string, FirebaseCreatorTokenRecord> | null;
        if (!raw) {
            return [];
        }

        const tokens: StoredMarketToken[] = [];
        for (const [key, entry] of Object.entries(raw)) {
            if (!entry || typeof entry !== "object") {
                continue;
            }
            const stored = toStoredMarketToken(entry, key, normalizedSigner);
            if (stored) {
                tokens.push(stored);
            }
        }

        return tokens.sort((a, b) => (b.launchedAt ?? 0) - (a.launchedAt ?? 0));
    } catch (error) {
        console.warn("[Firebase] signer query failed; falling back to client-side filtering", error);
        const snapshot = await get(tokensRef);
        const raw = snapshot.val() as Record<string, FirebaseCreatorTokenRecord> | null;
        if (!raw) {
            return [];
        }

        const tokens: StoredMarketToken[] = [];
        for (const [key, entry] of Object.entries(raw)) {
            if (!entry || typeof entry !== "object") {
                continue;
            }
            const signerField = selectString(entry.signer) ?? selectString(entry.deployer);
            if (!signerField || signerField.toLowerCase() !== normalizedSignerLower) {
                continue;
            }
            const stored = toStoredMarketToken(entry, key, signerField);
            if (stored) {
                tokens.push(stored);
            }
        }

        return tokens.sort((a, b) => (b.launchedAt ?? 0) - (a.launchedAt ?? 0));
    }
};

export const fetchAllFirebaseTokens = async (): Promise<StoredMarketToken[]> => {
    if (!hasFirebaseConfig()) {
        throw new Error("Firebase configuration missing");
    }

    const db = getFirebaseDatabase();
    if (!db) {
        throw new Error("Firebase database unavailable");
    }

    const tokensRef = ref(db, "tokens");

    try {
        const snapshot = await get(tokensRef);
        const raw = snapshot.val() as Record<string, FirebaseCreatorTokenRecord> | null;
        if (!raw) {
            return [];
        }

        const tokens: StoredMarketToken[] = [];
        for (const [key, entry] of Object.entries(raw)) {
            if (!entry || typeof entry !== "object") {
                continue;
            }

            const fallbackSigner = selectString(entry.signer) ?? selectString(entry.deployer) ?? key;
            const stored = toStoredMarketToken(entry, key, fallbackSigner);
            if (stored) {
                tokens.push(stored);
            }
        }

        return tokens.sort((a, b) => (b.launchedAt ?? 0) - (a.launchedAt ?? 0));
    } catch (error) {
        console.error("[Firebase] Failed to fetch tokens", error);
        throw error;
    }
};

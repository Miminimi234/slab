import type { JupiterToken } from "@/lib/api";

export const MARKET_STORAGE_KEY = "gmgn.storedMarkets";
export const MARKET_STORAGE_MAX_ITEMS = 25;
export const MARKET_STORAGE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
export const MARKET_STORAGE_EVENT = "slab-market-stored";

export interface StoredMarketToken extends Partial<JupiterToken> {
    id: string;
    mintAddress: string;
    poolId?: string;
    metadataUri?: string;
    creator: string;
    launchedAt: number;
    cluster?: "devnet" | "mainnet";
    imageUrl?: string;
}

export interface StoredMarketEntry {
    token: StoredMarketToken;
    storedAt: number;
}

export const normalizeSymbolKey = (value: string | null | undefined): string =>
    value ? value.toString().replace(/[^a-zA-Z0-9]/g, "").toUpperCase() : "";

const readStorage = (): Record<string, StoredMarketEntry> => {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(MARKET_STORAGE_KEY);
        if (!raw) return {};

        const parsed = JSON.parse(raw) as Record<string, StoredMarketEntry>;
        const now = Date.now();
        let mutated = false;

        const filteredEntries = Object.entries(parsed).filter(([key, entry]) => {
            if (!entry || typeof entry.storedAt !== "number" || !entry.token) {
                mutated = true;
                return false;
            }
            if (MARKET_STORAGE_TTL_MS <= 0) return true;
            const isFresh = now - entry.storedAt <= MARKET_STORAGE_TTL_MS;
            if (!isFresh) mutated = true;
            return isFresh;
        });

        const filtered: Record<string, StoredMarketEntry> = Object.fromEntries(filteredEntries);

        if (mutated) {
            window.localStorage.setItem(MARKET_STORAGE_KEY, JSON.stringify(filtered));
        }

        return filtered;
    } catch (error) {
        console.warn("[LocalMarkets] Failed to read market cache:", error);
        return {};
    }
};

const writeStorage = (map: Record<string, StoredMarketEntry>) => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(MARKET_STORAGE_KEY, JSON.stringify(map));
    } catch (error) {
        console.warn("[LocalMarkets] Failed to persist market cache:", error);
    }
};

export const getStoredMarketMap = (): Record<string, StoredMarketEntry> => readStorage();

export const getAllStoredMarkets = (): StoredMarketToken[] =>
    Object.values(readStorage())
        .sort((a, b) => b.storedAt - a.storedAt)
        .map((entry) => entry.token);

export const getMarketsForCreator = (creator: string | null | undefined): StoredMarketToken[] => {
    if (!creator) return [];
    const creatorKey = creator.toLowerCase();
    return Object.values(readStorage())
        .filter((entry) => entry.token.creator?.toLowerCase() === creatorKey)
        .sort((a, b) => b.storedAt - a.storedAt)
        .map((entry) => entry.token);
};

export const storeMarketToken = (token: StoredMarketToken): void => {
    if (typeof window === "undefined") return;

    const normalizedSymbol = normalizeSymbolKey(token.symbol || token.id);
    if (!normalizedSymbol) return;

    const map = readStorage();
    const storedAt = Date.now();

    map[normalizedSymbol] = {
        token: {
            decimals: token.decimals ?? 6,
            ...token,
            launchedAt: token.launchedAt ?? storedAt,
            symbol: token.symbol?.toUpperCase() ?? token.id.toUpperCase(),
        },
        storedAt,
    };

    const trimmedEntries = Object.entries(map)
        .sort(([, a], [, b]) => b.storedAt - a.storedAt)
        .slice(0, MARKET_STORAGE_MAX_ITEMS);

    const trimmedMap: Record<string, StoredMarketEntry> = {};
    for (const [key, value] of trimmedEntries) {
        trimmedMap[key] = value;
    }

    writeStorage(trimmedMap);

    try {
        const detail: StoredMarketEntry | undefined = trimmedMap[normalizedSymbol];
        if (detail) {
            window.dispatchEvent(new CustomEvent<StoredMarketEntry>(MARKET_STORAGE_EVENT, { detail }));
        }
    } catch (error) {
        console.warn("[LocalMarkets] Failed to broadcast market update:", error);
    }
};

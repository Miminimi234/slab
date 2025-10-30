/*
 Front-end Jupiter client helpers.
 These functions call public Jupiter/cache endpoints directly from the browser so
 the frontend can obtain token lists and token metadata without routing through
 the server. They include safe fallbacks and defensive parsing.
*/

import type { JupiterRecentSnapshot, JupiterToken } from "./api";

const JUPITER_TOKEN_LIST_URLS = [
    // primary known cache endpoint
    "https://cache.jup.ag/tokens",
    // alternate (older) endpoint
    "https://raw.githubusercontent.com/jup-ag/token-list/main/jupiter.tokenlist.json",
];

async function tryFetchJson(url: string) {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchJupiterTokensDirect(): Promise<JupiterToken[]> {
    for (const url of JUPITER_TOKEN_LIST_URLS) {
        try {
            const data = await tryFetchJson(url);

            // The cache endpoint may already be an array of token objects, or it may
            // be a tokenlist-format object with a `tokens` property.
            const tokensRaw = Array.isArray(data) ? data : data?.tokens ?? data?.tokens ?? [];

            if (!Array.isArray(tokensRaw)) continue;

            // Normalize token entries into our JupiterToken shape (best-effort)
            const normalized = tokensRaw.map((t: any) => ({
                id: t.address ?? t.id ?? t.tokenId ?? t.mint ?? "",
                name: t.name ?? t.symbol ?? "",
                symbol: t.symbol ?? t.name ?? "",
                decimals: typeof t.decimals === "number" ? t.decimals : Number(t.decimals) || 0,
                icon: t.logoURI ?? t.icon ?? t.image ?? undefined,
                website: t.website ?? t.projectUrl ?? undefined,
                twitter: t.twitter ?? undefined,
                launchpad: t.launchpad ?? t.platform ?? undefined,
                circSupply: Number(t.circulating_supply ?? t.circSupply ?? t.circulatingSupply) || undefined,
                totalSupply: Number(t.total_supply ?? t.totalSupply) || undefined,
                fdv: Number(t.fdv ?? t.fully_diluted_valuation) || undefined,
                mcap: Number(t.mcap ?? t.market_cap) || undefined,
                usdPrice: Number(t.usdPrice ?? t.price_usd ?? t.price) || undefined,
                liquidity: Number(t.liquidity) || undefined,
                holderCount: Number(t.holderCount) || undefined,
                bondingCurve: Number(t.bondingCurve) || undefined,
                updatedAt: t.updatedAt ?? t.updated_at ?? undefined,
                ...t,
            })) as JupiterToken[];

            return normalized;
        } catch (err) {
            // try next url
            // eslint-disable-next-line no-console
            console.warn("jupiterClient: failed to fetch from", url, err);
            continue;
        }
    }

    // If all attempts fail, return empty array
    return [];
}

export async function fetchJupiterRecentTokensDirect(): Promise<JupiterRecentSnapshot | null> {
    try {
        const tokens = await fetchJupiterTokensDirect();
        return {
            tokens,
            fetchedAt: new Date().toISOString(),
        };
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("fetchJupiterRecentTokensDirect failed:", err);
        return null;
    }
}

export async function fetchJupiterTokenByMintDirect(mint: string): Promise<JupiterToken | null> {
    try {
        if (!mint) return null;
        const tokens = await fetchJupiterTokensDirect();
        if (!tokens || tokens.length === 0) return null;
        const found = tokens.find((t) => (t.id || "").toLowerCase() === mint.toLowerCase());
        if (found) return found;

        // Some tokenlists store the mint under other keys; try matching by symbol or name prefix
        const bySymbol = tokens.find((t) => (t.symbol || "").toLowerCase() === mint.toLowerCase());
        if (bySymbol) return bySymbol;

        return null;
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("fetchJupiterTokenByMintDirect failed:", err);
        return null;
    }
}

export default {
    fetchJupiterRecentTokensDirect,
    fetchJupiterTokenByMintDirect,
    fetchJupiterTokensDirect,
};

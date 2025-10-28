import { useQuery } from "@tanstack/react-query";

export interface JupiterSearchToken {
    id: string;
    name: string;
    symbol: string;
    icon?: string;
    decimals?: number;
    usdPrice?: number;
    mcap?: number;
    [key: string]: unknown;
}

async function fetchJupiterSearch(q?: string) {
    const url = new URL("/api/jupiter/search", window.location.origin);
    if (q) url.searchParams.set("q", q);

    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error(`Search request failed: ${res.status}`);
    }

    const payload = await res.json();
    if (!payload?.success) {
        throw new Error(payload?.message || "Jupiter search failed");
    }

    return payload.data as JupiterSearchToken[];
}

export function useJupiterSearch(query?: string, enabled = true) {
    return useQuery<JupiterSearchToken[], Error>({
        queryKey: ["jupiter-search", query],
        queryFn: () => fetchJupiterSearch(query),
        enabled: Boolean(enabled && typeof query === "string"),
        staleTime: 1000 * 30,
        retry: 1,
    });
}

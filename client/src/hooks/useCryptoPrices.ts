import { useQuery } from "@tanstack/react-query";

export interface PriceData {
    symbol: string;
    price: number;
    change24h: number;
    timestamp: number;
}

export interface PriceResponse {
    success: boolean;
    data: Record<string, PriceData>;
    isStale?: boolean;
}

async function fetchCryptoPrices(): Promise<PriceResponse> {
    const response = await fetch("/api/prices", {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch prices: ${response.status}`);
    }

    return response.json();
}

export function useCryptoPrices() {
    return useQuery({
        queryKey: ["crypto-prices"],
        queryFn: fetchCryptoPrices,
        staleTime: 3 * 1000, // 3 seconds
        refetchInterval: 3 * 1000, // Refetch every 3 seconds
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
}

export function useSpecificCryptoPrice(symbol: string) {
    return useQuery({
        queryKey: ["crypto-price", symbol],
        queryFn: async (): Promise<{ success: boolean; data: PriceData; isStale?: boolean }> => {
            const response = await fetch(`/api/prices/${symbol}`, {
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ${symbol} price: ${response.status}`);
            }

            return response.json();
        },
        staleTime: 3 * 1000,
        refetchInterval: 3 * 1000,
        retry: 3,
    });
}
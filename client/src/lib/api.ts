import marketsData from "@/mocks/markets.json";
import type { Market, OrderBook, Trade } from "@shared/schema";
import jupiterClient from "./jupiterClient";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface JupiterToken {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  icon?: string;
  website?: string;
  twitter?: string;
  launchpad?: string;
  metaLaunchpad?: string;
  circSupply?: number;
  totalSupply?: number;
  fdv?: number;
  mcap?: number;
  usdPrice?: number;
  liquidity?: number;
  holderCount?: number;
  bondingCurve?: number;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface JupiterRecentSnapshot {
  tokens: JupiterToken[];
  fetchedAt: string | null;
  error?: string;
}

export interface JupiterTopTrendingStats {
  priceChange?: number;
  holderChange?: number;
  liquidityChange?: number;
  volumeChange?: number;
  buyVolume?: number;
  sellVolume?: number;
  buyOrganicVolume?: number;
  sellOrganicVolume?: number;
  numBuys?: number;
  numSells?: number;
  numTraders?: number;
  numOrganicBuyers?: number;
  numNetBuyers?: number;
}

export interface JupiterTopTrendingToken {
  id: string;
  name: string;
  symbol: string;
  icon?: string;
  decimals: number;
  twitter?: string;
  telegram?: string;
  website?: string;
  dev?: string;
  circSupply?: number;
  totalSupply?: number;
  tokenProgram?: string;
  launchpad?: string;
  partnerConfig?: string;
  graduatedPool?: string;
  graduatedAt?: string;
  holderCount?: number;
  fdv?: number;
  mcap?: number;
  usdPrice?: number;
  priceBlockId?: number;
  liquidity?: number;
  stats5m?: JupiterTopTrendingStats;
  stats1h?: JupiterTopTrendingStats;
  stats6h?: JupiterTopTrendingStats;
  stats24h?: JupiterTopTrendingStats;
  firstPool?: {
    id: string;
    createdAt: string;
  };
  audit?: {
    isSus?: boolean;
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    topHoldersPercentage?: number;
    devBalancePercentage?: number;
    devMigrations?: number;
  };
  organicScore?: number;
  organicScoreLabel?: string;
  isVerified?: boolean;
  cexes?: string[];
  tags?: string[];
  updatedAt?: string;
  [key: string]: unknown;
}

export interface JupiterTopTrendingSnapshot {
  metadataArweaveUri?: string;
  imageArweaveUrl?: string;
  timeframe: string;
  limit: number;
  tokens: JupiterTopTrendingToken[];
  fetchedAt: string | null;
  error?: string;
}

export async function fetchMarkets(): Promise<Market[]> {
  await delay(300);
  return marketsData as Market[];
}

export async function fetchMarketBySymbol(symbol: string): Promise<Market | null> {
  await delay(200);
  const market = (marketsData as Market[]).find(m => m.symbol === symbol);
  return market || null;
}

export async function fetchOrderBook(marketId: string): Promise<OrderBook> {
  await delay(150);

  const basePrice = 0.00001234;
  const bids = Array.from({ length: 20 }, (_, i) => ({
    price: basePrice * (1 - (i + 1) * 0.0005),
    size: 1000 + Math.random() * 5000,
    total: 1000 + (i + 1) * 1000,
  }));

  const asks = Array.from({ length: 20 }, (_, i) => ({
    price: basePrice * (1 + (i + 1) * 0.0005),
    size: 1000 + Math.random() * 5000,
    total: 1000 + (i + 1) * 1000,
  }));

  return {
    marketId,
    bids,
    asks,
    lastUpdate: Date.now(),
  };
}

export async function fetchRecentTrades(marketId: string): Promise<Trade[]> {
  await delay(150);

  return Array.from({ length: 30 }, (_, i) => ({
    id: `trade-${marketId}-${i}-${Date.now()}`,
    marketId,
    symbol: marketId.replace("market-", "").toUpperCase(),
    timestamp: Date.now() - i * 5000,
    price: 0.00001234 * (1 + (Math.random() - 0.5) * 0.02),
    size: 100 + Math.random() * 500,
    side: Math.random() > 0.5 ? "buy" : "sell",
  }));
}

export async function simulateTrade(
  marketId: string,
  side: "long" | "short" | "buy" | "sell",
  size: number,
  price: number
): Promise<{ success: boolean; txId: string }> {
  await delay(1000);

  return {
    success: true,
    txId: `0x${Math.random().toString(16).slice(2)}`,
  };
}

export async function deployMarket(marketData: any): Promise<{ success: boolean; marketId: string; txId: string }> {
  await delay(2500);

  return {
    success: true,
    marketId: `market-${marketData.basics.symbol.toLowerCase()}-${Date.now()}`,
    txId: `0x${Math.random().toString(16).slice(2)}`,
  };
}

let realtimeUpdateInterval: NodeJS.Timeout | null = null;

export function startRealtimeUpdates(
  onPriceUpdate: (marketId: string, price: number) => void,
  onTradeUpdate: (trade: Trade) => void
) {
  if (realtimeUpdateInterval) return;

  realtimeUpdateInterval = setInterval(() => {
    const markets = marketsData as Market[];
    const randomMarket = markets[Math.floor(Math.random() * markets.length)];

    const priceChange = (Math.random() - 0.5) * 0.0002;
    const newPrice = randomMarket.metrics.currentPrice * (1 + priceChange);

    onPriceUpdate(randomMarket.id, newPrice);

    if (Math.random() > 0.7) {
      const trade: Trade = {
        id: `trade-${randomMarket.id}-${Date.now()}`,
        marketId: randomMarket.id,
        symbol: randomMarket.symbol,
        timestamp: Date.now(),
        price: newPrice,
        size: 100 + Math.random() * 500,
        side: Math.random() > 0.5 ? "buy" : "sell",
      };
      onTradeUpdate(trade);
    }
  }, 3000);
}

export function stopRealtimeUpdates() {
  if (realtimeUpdateInterval) {
    clearInterval(realtimeUpdateInterval);
    realtimeUpdateInterval = null;
  }
}

export async function fetchJupiterRecentTokens(): Promise<JupiterRecentSnapshot | null> {
  // Keep recent-token snapshot fetching on the backend (server proxy).
  try {
    const response = await fetch("/api/jupiter/recent");
    if (!response.ok) {
      throw new Error(`Failed to fetch Jupiter tokens: ${response.status}`);
    }
    const snapshot = (await response.json()) as JupiterRecentSnapshot;
    return {
      tokens: snapshot.tokens ?? [],
      fetchedAt: snapshot.fetchedAt ?? null,
      error: snapshot.error,
    };
  } catch (error) {
    console.error("fetchJupiterRecentTokens error:", error);
    return null;
  }
}

export function subscribeToJupiterRecentTokens(
  onSnapshot: (snapshot: JupiterRecentSnapshot) => void,
  onError?: (error: Event | Error) => void
): () => void {
  const eventSource = new EventSource("/api/jupiter/recent/stream");

  const handleSnapshot = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as JupiterRecentSnapshot;
      onSnapshot({
        tokens: data.tokens ?? [],
        fetchedAt: data.fetchedAt ?? null,
        error: data.error,
      });
    } catch (error) {
      console.error("Failed to parse Jupiter snapshot:", error);
      onError?.(error as Error);
    }
  };

  eventSource.addEventListener("init", handleSnapshot as EventListener);
  eventSource.addEventListener("update", handleSnapshot as EventListener);
  eventSource.addEventListener("error", (event) => {
    onError?.(event);
  });

  return () => {
    eventSource.removeEventListener("init", handleSnapshot as EventListener);
    eventSource.removeEventListener("update", handleSnapshot as EventListener);
    eventSource.close();
  };
}

export async function fetchJupiterTopTrendingTokens(): Promise<JupiterTopTrendingSnapshot | null> {
  try {
    const response = await fetch("/api/jupiter/top-trending");
    if (!response.ok) {
      throw new Error(`Failed to fetch Jupiter top trending tokens: ${response.status}`);
    }
    const snapshot = (await response.json()) as JupiterTopTrendingSnapshot;
    return {
      timeframe: snapshot.timeframe,
      limit: snapshot.limit,
      tokens: snapshot.tokens ?? [],
      fetchedAt: snapshot.fetchedAt ?? null,
      error: snapshot.error,
    };
  } catch (error) {
    console.error("fetchJupiterTopTrendingTokens error:", error);
    return null;
  }
}

export function subscribeToJupiterTopTrendingTokens(
  onSnapshot: (snapshot: JupiterTopTrendingSnapshot) => void,
  onError?: (error: Event | Error) => void
): () => void {
  const eventSource = new EventSource("/api/jupiter/top-trending/stream");

  const handleSnapshot = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as JupiterTopTrendingSnapshot;
      onSnapshot({
        timeframe: data.timeframe,
        limit: data.limit,
        tokens: data.tokens ?? [],
        fetchedAt: data.fetchedAt ?? null,
        error: data.error,
      });
    } catch (error) {
      console.error("Failed to parse Jupiter top trending snapshot:", error);
      onError?.(error as Error);
    }
  };

  eventSource.addEventListener("init", handleSnapshot as EventListener);
  eventSource.addEventListener("update", handleSnapshot as EventListener);
  eventSource.addEventListener("error", (event) => {
    onError?.(event);
  });

  return () => {
    eventSource.removeEventListener("init", handleSnapshot as EventListener);
    eventSource.removeEventListener("update", handleSnapshot as EventListener);
    eventSource.close();
  };
}

export async function fetchJupiterTokenByMint(mintAddress: string): Promise<JupiterToken | null> {
  // Try client-side first (directly to public jupiter tokenlists). If that fails
  // or returns no result, fall back to the backend proxy endpoint so we still
  // resolve tokens in environments where direct calls are blocked.
  try {
    const direct = await jupiterClient.fetchJupiterTokenByMintDirect(mintAddress);
    if (direct) return direct;
  } catch (err) {
    console.warn("fetchJupiterTokenByMint: client lookup failed, falling back to server", err);
  }

  // Fallback to server proxy search
  try {
    const response = await fetch(`/api/jupiter/search?query=${encodeURIComponent(mintAddress)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Jupiter token from server: ${response.status}`);
    }
    const data = await response.json();
    const tokens = data.tokens || [];

    // Find the exact match by mint address (id)
    const token = tokens.find((t: JupiterToken) => (t.id || "").toLowerCase() === (mintAddress || "").toLowerCase());
    return token || null;
  } catch (error) {
    console.error("fetchJupiterTokenByMint error:", error);
    return null;
  }
}

export async function fetchGmgnTokenTrades(mintAddress: string, limit = 50): Promise<Trade[]> {
  try {
    const url = `/api/gmgn/trades/${encodeURIComponent(mintAddress)}?limit=${encodeURIComponent(String(limit))}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch GMGN trades: ${response.status}`);
    }
    const json = await response.json();
    const data = json?.data?.data ?? json?.data ?? json;
    const history = Array.isArray(data?.history) ? data.history : [];

    return history.map((item: any, i: number) => {
      const timestamp = typeof item.timestamp === "number" ? item.timestamp * 1000 : Date.now();
      const price = Number(item.price_usd ?? item.price ?? 0) || 0;
      const baseAmount = Number(item.base_amount ?? item.amount ?? 0) || 0;
      const quoteAmount = Number(item.quote_amount ?? 0) || 0;
      const side = item.event === "buy" ? "buy" : "sell";

      return {
        id: item.id ?? item.tx_hash ?? `${mintAddress}-${i}-${timestamp}`,
        marketId: mintAddress,
        symbol: mintAddress,
        timestamp,
        price,
        size: baseAmount,
        side,
        // Keep original GMGN payload for richer rendering in the UI
        gmgnRaw: item,
        gmgn: {
          base_amount: String(baseAmount),
          quote_amount: String(quoteAmount),
          price_usd: String(price),
          maker: item.maker ?? "",
          tx_hash: item.tx_hash ?? "",
        },
      } as unknown as Trade;
    });
  } catch (error) {
    console.error("fetchGmgnTokenTrades error:", error);
    return [];
  }
}

export async function fetchGmgnTokenHolders(
  mintAddress: string,
  limit = 50,
  cursor?: string
): Promise<{ holders: any[]; next?: string | null }> {
  try {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (cursor) params.set("cursor", cursor);
    const url = `/api/gmgn/holders/${encodeURIComponent(mintAddress)}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch GMGN holders: ${response.status}`);
    }
    const json = await response.json();
    const data = json?.data?.data ?? json?.data ?? json;

    // GMGN may return holders under different keys; try common ones
    let holders: any[] = [];
    if (Array.isArray(data?.holders)) holders = data.holders;
    else if (Array.isArray(data?.items)) holders = data.items;
    else if (Array.isArray(data?.list)) holders = data.list;
    else if (Array.isArray(data)) holders = data;

    const next = data?.next ?? null;
    return { holders, next };
  } catch (error) {
    console.error("fetchGmgnTokenHolders error:", error);
    return { holders: [], next: null };
  }
}

// Raydium LaunchLab API Functions

export interface LaunchpadFormData {
  walletPublicKey: string;
  tokenMint: string;
  name: string;
  symbol: string;
  uri: string;
  totalSupply: string | number;
  tokensToSell: string | number;
  fundraisingTarget: string | number;
  migrateType?: 'amm' | 'cpmm';
  decimals?: number;
  buyAmount?: string | number;
  createOnly?: boolean;
  cliffPeriod?: number;
  unlockPeriod?: number;
  creatorFeeOn?: boolean;
}

export interface LaunchpadResponse {
  success: boolean;
  data?: {
    transactions: Array<{
      transaction: string; // base64 encoded
      signers: any[];
    }>;
    poolId: string;
    mintAddress: string;
    configId: string;
    platformId: string;
    params: any;
    message: string;
  };
  error?: string;
  details?: any;
}

export async function generateLaunchpadMetadata(payload: {
  name: string;
  symbol: string;
  description?: string;
  imageDataUrl?: string | null;
  imageUrl?: string | null;
  imageContentType?: string | null;
  externalUrl?: string | null;
  attributes?: Array<Record<string, unknown>>;
}): Promise<{
  success: boolean;
  metadataUri?: string;
  imageUrl?: string;
  metadataArweaveUri?: string;
  imageArweaveUrl?: string;
  imageContentType?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const response = await fetch('/api/launchpad/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: result?.error || `Failed to generate metadata (status ${response.status})`,
      };
    }

    return result;
  } catch (error) {
    console.error('Error generating launchpad metadata:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function createLaunchpadPool(formData: LaunchpadFormData): Promise<LaunchpadResponse> {
  try {
    // Use the backend's new API format - requires name, symbol, uri for official SDK
    const launchpadData = {
      name: formData.name,
      symbol: formData.symbol,
      uri: formData.uri,
      totalSupply: formData.totalSupply?.toString() || '1000000000000000',
      tokensToSell: formData.tokensToSell?.toString() || '793100000000000',
      fundraisingTarget: formData.fundraisingTarget?.toString() || '100000000000',
      migrateType: formData.migrateType || 'cpmm',
      decimals: formData.decimals ?? 6,
      buyAmount: formData.buyAmount?.toString() || '1000000000', // 1 SOL initial buy
      createOnly: formData.createOnly ?? false,
      walletPublicKey: formData.walletPublicKey,
    };

    const response = await fetch('/api/launchpad/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'credentials': 'include'
      },
      body: JSON.stringify(launchpadData),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error creating launchpad pool:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function validateLaunchParams(params: Partial<LaunchpadFormData>): Promise<{
  success: boolean;
  errors?: string[];
  message?: string;
}> {
  try {
    const response = await fetch('/api/launchpad/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error validating launch params:', error);
    return {
      success: false,
      errors: ['Failed to validate parameters']
    };
  }
}

export interface LaunchpadConfigResponse {
  success: boolean;
  config?: {
    platformConfigId: string | null;
    programId: string;
    cpConfigId: string;
    network: string;
    quoteMint: string;
    minFundraising?: {
      lamports: string;
      sol: number;
    };
    platform: {
      name: string;
      website: string;
      logo: string;
      description: string;
      feeRate: string;
      creatorFeeRate: string;
      graduationThreshold: string;
    };
  };
  error?: string;
}

export async function getLaunchpadConfig(): Promise<LaunchpadConfigResponse> {
  try {
    const response = await fetch('/api/launchpad/config');
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching launchpad config:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// New functions for buy/sell/pool info using official Raydium SDK

export async function buyLaunchpadTokens(
  walletPublicKey: string,
  poolId: string,
  solAmount: string,
  slippageBps: number = 100
): Promise<LaunchpadResponse> {
  try {
    const response = await fetch('/api/launchpad/buy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'credentials': 'include'
      },
      body: JSON.stringify({
        walletPublicKey,
        poolId,
        solAmount,
        slippageBps
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error buying tokens:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function sellLaunchpadTokens(
  walletPublicKey: string,
  poolId: string,
  tokenAmount: string,
  slippageBps: number = 100
): Promise<LaunchpadResponse> {
  try {
    const response = await fetch('/api/launchpad/sell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'credentials': 'include'
      },
      body: JSON.stringify({
        walletPublicKey,
        poolId,
        tokenAmount,
        slippageBps
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error selling tokens:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function getLaunchpadPoolInfo(poolId: string): Promise<{
  success: boolean;
  data?: {
    poolId: string;
    poolInfo: any;
    platformInfo: any;
    message: string;
  };
  error?: string;
}> {
  try {
    const response = await fetch(`/api/launchpad/pool/${poolId}`);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching pool info:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

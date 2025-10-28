import { GMGNWidget } from "@/components/shared/GMGNWidget";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { OrderBook } from "@/components/shared/OrderBook";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TradesFeed } from "@/components/shared/TradesFeed";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchJupiterRecentTokens,
  fetchJupiterTokenByMint,
  fetchMarketBySymbol,
  fetchOrderBook,
  fetchRecentTrades,
  type JupiterToken,
} from "@/lib/api";
import type { OrderBook as OrderBookType, Trade } from "@shared/schema";
import { motion } from "framer-motion";
import { Minus, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useRoute } from "wouter";

const normalizeSymbol = (value: string | null | undefined): string => {
  if (!value) return "";
  return value.toString().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const deriveTokenSymbol = (token: JupiterToken): string => {
  const primary = normalizeSymbol(token.symbol || token.name || token.id);
  if (primary) return primary;
  return token.id.slice(0, 6).toUpperCase();
};

const findTokenBySymbol = (tokens: JupiterToken[], target: string): JupiterToken | undefined => {
  const normalizedTarget = normalizeSymbol(target);
  if (!normalizedTarget) return undefined;

  return tokens.find((token) => {
    const candidates = [
      token.symbol,
      token.name,
      token.id,
      deriveTokenSymbol(token),
      token.id.slice(0, 6),
    ];

    return candidates.some((candidate) => normalizeSymbol(candidate) === normalizedTarget);
  });
};

const STORAGE_KEY = "gmgn.storedMarkets";
const STORAGE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const STORAGE_MAX_ITEMS = 25;

interface StoredTokenEntry {
  token: JupiterToken;
  storedAt: number;
}

const getStoredMarkets = (): Record<string, StoredTokenEntry> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredTokenEntry>;
    return parsed || {};
  } catch {
    return {};
  }
};

const persistStoredMarkets = (data: Record<string, StoredTokenEntry>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const storeTokenForSymbol = (symbol: string, token: JupiterToken) => {
  if (typeof window === "undefined") return;
  const upper = normalizeSymbol(symbol);
  if (!upper) return;

  const data = getStoredMarkets();
  data[upper] = { token, storedAt: Date.now() };

  const entries = Object.entries(data)
    .sort(([, a], [, b]) => b.storedAt - a.storedAt)
    .slice(0, STORAGE_MAX_ITEMS);

  const trimmed: Record<string, StoredTokenEntry> = {};
  entries.forEach(([key, value]) => {
    trimmed[key] = value;
  });

  persistStoredMarkets(trimmed);
};

const retrieveTokenForSymbol = (symbol: string): JupiterToken | null => {
  if (typeof window === "undefined") return null;
  const upper = normalizeSymbol(symbol);
  if (!upper) return null;

  const data = getStoredMarkets();
  const entry = data[upper];
  if (!entry) return null;

  if (Date.now() - entry.storedAt > STORAGE_TTL_MS) {
    delete data[upper];
    persistStoredMarkets(data);
    return null;
  }

  return entry.token;
};

const createMockMarketFromToken = (token: JupiterToken) => {
  const symbol = deriveTokenSymbol(token);
  const stats24h = (token as Record<string, any>)?.stats24h ?? {};
  const currentPrice = toNumber(token.usdPrice, Math.random() * 0.0001 + 0.000001);
  const priceChange24h = toNumber(stats24h?.priceChange, 0);
  const volume24h = toNumber(stats24h?.buyVolume, 0) + toNumber(stats24h?.sellVolume, 0);
  const liquidity = toNumber((token as Record<string, any>)?.liquidity, toNumber((token as Record<string, any>)?.fdv, 0) * 0.01);
  const holders = toNumber((token as Record<string, any>)?.holderCount, 0);

  return {
    id: token.id,
    symbol,
    name: token.name || symbol,
    status: "bonding",
    mintAddress: token.id,
    launchpad: token.launchpad,
    imageUrl: token.icon,
    description: (Array.isArray((token as Record<string, any>)?.tags) ? (token as Record<string, any>).tags : [])
      .slice(0, 3)
      .join(", "),
    metrics: {
      currentPrice,
      priceChange24h,
      volume24h,
      openInterest: liquidity,
      liquidity,
      holders,
      graduationProgress: toNumber((token as Record<string, any>)?.bondingCurve, 0),
      fundingRate: 0,
    },
  };
};

const generateMockOrderBook = (token: JupiterToken, basePrice: number): OrderBookType => {
  const safePrice = basePrice > 0 ? basePrice : 0.000001;
  const levels = 20;
  const spread = safePrice * 0.01 + 0.0000001;

  const bids = Array.from({ length: levels }, (_, index) => {
    const price = safePrice - spread * (index + 1);
    const size = 1000 + Math.random() * 5000;
    return {
      price: Number(price.toFixed(8)),
      size: Number(size.toFixed(2)),
      total: Number((size * price).toFixed(2)),
    };
  });

  const asks = Array.from({ length: levels }, (_, index) => {
    const price = safePrice + spread * (index + 1);
    const size = 1000 + Math.random() * 5000;
    return {
      price: Number(price.toFixed(8)),
      size: Number(size.toFixed(2)),
      total: Number((size * price).toFixed(2)),
    };
  });

  return {
    marketId: token.id,
    bids,
    asks,
    lastUpdate: Date.now(),
  };
};

const generateMockTrades = (token: JupiterToken, symbol: string, basePrice: number): Trade[] => {
  const safePrice = basePrice > 0 ? basePrice : 0.000001;
  return Array.from({ length: 30 }, (_, index) => {
    const price = safePrice * (1 + (Math.random() - 0.5) * 0.1);
    const size = 100 + Math.random() * 900;
    return {
      id: `mock-trade-${token.id}-${Date.now()}-${index}`,
      marketId: token.id,
      symbol,
      timestamp: Date.now() - index * 60_000,
      price: Number(price.toFixed(8)),
      size: Number(size.toFixed(2)),
      side: Math.random() > 0.5 ? "buy" : "sell",
    };
  });
};

export default function Market() {
  const [, params] = useRoute("/market/:symbol");
  const routeSymbol = params?.symbol ?? "SLAB";
  const symbol = routeSymbol.toUpperCase();
  const normalizedSymbol = normalizeSymbol(routeSymbol);
  const { isAuthenticated } = useAuth();

  const [chartMode, setChartMode] = useState<"candles" | "twap">("candles");
  const [activeTab, setActiveTab] = useState<"trades" | "funding" | "positions">("trades");
  const [market, setMarket] = useState<any>(null);
  const [orderBook, setOrderBook] = useState<OrderBookType | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [jupiterToken, setJupiterToken] = useState<JupiterToken | null>(null);
  const [isMockMarket, setIsMockMarket] = useState(false);
  const [isMarketLoading, setIsMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);

  // Trade ticket state
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [multiplier, setMultiplier] = useState([1]);

  // Multi-wallet trading state
  const [userWallets, setUserWallets] = useState<any[]>([]);
  const [selectedWallets, setSelectedWallets] = useState<{ [walletId: string]: { selected: boolean; solAmount: string } }>({});
  const [showWalletSelection, setShowWalletSelection] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadMarketData = async () => {
      setIsMarketLoading(true);
      setMarketError(null);
      setMarket(null);
      setOrderBook(null);
      setTrades([]);
      setJupiterToken(null);
      setIsMockMarket(false);

      try {
        const storedToken = retrieveTokenForSymbol(normalizedSymbol || symbol);

        const existingMarket = await fetchMarketBySymbol(symbol);
        if (cancelled) return;

        if (existingMarket) {
          setIsMockMarket(false);
          setJupiterToken(null);
          setMarket(existingMarket);
          setLimitPrice(existingMarket.metrics.currentPrice.toFixed(4));

          const [ob, recentTrades] = await Promise.all([
            fetchOrderBook(existingMarket.id),
            fetchRecentTrades(existingMarket.id),
          ]);

          if (cancelled) return;
          setOrderBook(ob);
          setTrades(recentTrades);
          setIsMarketLoading(false);
          return;
        }

        if (storedToken) {
          const mockMarket = createMockMarketFromToken(storedToken);
          const mockOrderBook = generateMockOrderBook(storedToken, mockMarket.metrics.currentPrice);
          const mockTrades = generateMockTrades(storedToken, mockMarket.symbol, mockMarket.metrics.currentPrice);

          if (cancelled) return;
          setIsMockMarket(true);
          setJupiterToken(storedToken);
          setMarket(mockMarket);
          setOrderBook(mockOrderBook);
          setTrades(mockTrades);
          setLimitPrice(mockMarket.metrics.currentPrice.toFixed(6));
          setIsMarketLoading(false);
          return;
        }

        const snapshot = await fetchJupiterRecentTokens();
        if (cancelled) return;

        const tokens = snapshot?.tokens ?? [];
        const matchedToken = findTokenBySymbol(tokens, normalizedSymbol || symbol);

        if (matchedToken) {
          const mockMarket = createMockMarketFromToken(matchedToken);
          const mockOrderBook = generateMockOrderBook(matchedToken, mockMarket.metrics.currentPrice);
          const mockTrades = generateMockTrades(matchedToken, mockMarket.symbol, mockMarket.metrics.currentPrice);

          if (cancelled) return;
          setIsMockMarket(true);
          setJupiterToken(matchedToken);
          setMarket(mockMarket);
          setOrderBook(mockOrderBook);
          setTrades(mockTrades);
          setLimitPrice(mockMarket.metrics.currentPrice.toFixed(6));
          storeTokenForSymbol(normalizedSymbol || symbol, matchedToken);
          setIsMarketLoading(false);
          return;
        }

        setMarketError("MARKET_NOT_FOUND");
        setIsMarketLoading(false);
      } catch (error) {
        console.error("Failed to load market:", error);
        if (!cancelled) {
          setMarketError("MARKET_LOAD_FAILED");
          setMarket(null);
          setOrderBook(null);
          setTrades([]);
          setIsMockMarket(false);
          setJupiterToken(null);
          setIsMarketLoading(false);
        }
      }
    };

    loadMarketData();

    return () => {
      cancelled = true;
    };
  }, [symbol, normalizedSymbol]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const loadUserWallets = async () => {
      try {
        const response = await fetch("/api/wallets", { credentials: "include" });
        if (!response.ok) return;
        const wallets = await response.json();
        if (cancelled) return;
        setUserWallets(wallets);
        const initialSelection: { [walletId: string]: { selected: boolean; solAmount: string } } = {};
        wallets.forEach((wallet: any) => {
          initialSelection[wallet.id] = { selected: false, solAmount: "0" };
        });
        setSelectedWallets(initialSelection);
      } catch (error) {
        console.error("Failed to load user wallets:", error);
      }
    };

    loadUserWallets();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!market) return;

    const interval = setInterval(async () => {
      try {
        if (isMockMarket && jupiterToken) {
          setTrades(generateMockTrades(jupiterToken, market.symbol, market.metrics.currentPrice));
        } else {
          const recentTrades = await fetchRecentTrades(market.id);
          setTrades(recentTrades);
        }
      } catch (error) {
        console.error("Failed to refresh trades:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [market, isMockMarket, jupiterToken]);

  // Polling effect for updating Jupiter token data every 10 seconds
  useEffect(() => {
    if (!isMockMarket || !jupiterToken?.id) return;

    const updateTokenData = async () => {
      try {
        const updatedToken = await fetchJupiterTokenByMint(jupiterToken.id);
        if (updatedToken) {
          setJupiterToken(updatedToken);

          // Update the mock market with fresh data
          const updatedMockMarket = createMockMarketFromToken(updatedToken);
          setMarket(updatedMockMarket);

          // Update the order book with new price data
          const updatedOrderBook = generateMockOrderBook(updatedToken, updatedMockMarket.metrics.currentPrice);
          setOrderBook(updatedOrderBook);

          // Update limit price field
          setLimitPrice(updatedMockMarket.metrics.currentPrice.toFixed(6));

          // Store updated token data
          storeTokenForSymbol(normalizedSymbol || symbol, updatedToken);
        }
      } catch (error) {
        console.error("Failed to update Jupiter token data:", error);
      }
    };

    // Set up polling interval (10 seconds to avoid rate limiting)
    const pollInterval = setInterval(updateTokenData, 10000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [isMockMarket, jupiterToken, normalizedSymbol, symbol]);

  const displaySymbol = market?.symbol || symbol;
  const mintAddress = jupiterToken?.id || market?.mintAddress;
  const gmgnInterval: "1S" | "1" | "5" | "15" | "60" | "240" | "720" | "1D" = chartMode === "candles" ? "15" : "240";

  if (isMarketLoading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-12 w-96" />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <LoadingSkeleton className="xl:col-span-6 h-96" />
          <LoadingSkeleton className="xl:col-span-3 h-96" />
          <LoadingSkeleton className="xl:col-span-3 h-96" />
        </div>
      </div>
    );
  }

  if (!market || !orderBook) {
    return (
      <div className="space-y-6 px-4 py-8">
        <Card className="border-primary/20 bg-card p-8 text-center">
          <div className="text-sm font-mono text-primary mb-2">
            &gt; MARKET_SCANNER.STATUS
          </div>
          <div className="text-xs text-muted-foreground">
            {marketError === "MARKET_NOT_FOUND"
              ? "Requested market not found in SLAB registry or Jupiter feed."
              : "Failed to load market data. Please try again shortly."}
          </div>
          <div className="mt-4">
            <Button variant="outline" size="sm" className="text-[10px]" onClick={() => window.history.back()}>
              [GO_BACK]
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const isPriceUp = market.metrics.priceChange24h >= 0;
  const effectiveSize = parseFloat(size || "0") * multiplier[0];
  const total = orderType === "market"
    ? effectiveSize * market.metrics.currentPrice
    : effectiveSize * parseFloat(limitPrice || "0");

  // Multi-wallet helper functions
  const toggleWalletSelection = (walletId: string) => {
    setSelectedWallets(prev => ({
      ...prev,
      [walletId]: {
        ...prev[walletId],
        selected: !prev[walletId].selected
      }
    }));
  };

  const updateWalletSolAmount = (walletId: string, amount: string) => {
    setSelectedWallets(prev => ({
      ...prev,
      [walletId]: {
        ...prev[walletId],
        solAmount: amount
      }
    }));
  };

  const getTotalSelectedSol = () => {
    return Object.values(selectedWallets)
      .filter(w => w.selected)
      .reduce((total, w) => total + parseFloat(w.solAmount || "0"), 0);
  };

  const getSelectedWalletsCount = () => {
    return Object.values(selectedWallets).filter(w => w.selected).length;
  };

  return (
    <div className="space-y-4 px-4 py-4">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between flex-wrap gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-md flex items-center justify-center overflow-hidden">
            {market.imageUrl ? (
              <img
                src={market.imageUrl}
                alt={displaySymbol}
                className="w-full h-full object-cover rounded-md"
                onError={(e) => {
                  // Fallback to symbol text if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<span class="text-sm font-bold text-primary">${displaySymbol.slice(0, 2)}</span>`;
                  }
                }}
              />
            ) : (
              <span className="text-sm font-bold text-primary">{displaySymbol.slice(0, 2)}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-primary">{displaySymbol}</h1>
              <StatusBadge status={market.status} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div>
            <div className="text-muted-foreground mb-1">24H_VOL</div>
            <div className="font-mono font-bold text-foreground" data-numeric="true">
              ${(market.metrics.volume24h / 1e3).toFixed(0)}K
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">OPEN_INT</div>
            <div className="font-mono font-bold text-foreground" data-numeric="true">
              ${(market.metrics.openInterest / 1e3).toFixed(0)}K
            </div>
          </div>
          {market.status === "perps" && market.metrics.fundingRate !== undefined && (
            <div>
              <div className="text-muted-foreground mb-1">FUNDING</div>
              <div className="font-mono font-bold text-primary" data-numeric="true">
                {(market.metrics.fundingRate * 100).toFixed(4)}%
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Main 3-column layout: Chart | OrderBook | Trade */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left: Chart */}
        <div className="xl:col-span-6 space-y-4">
          <Card className="p-4 border-primary/20 bg-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xl font-bold font-mono text-foreground" data-numeric="true">
                    ${market.metrics.currentPrice.toFixed(8)}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    PAIR: SOL / {displaySymbol}
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${isPriceUp ? "text-success" : "text-destructive"}`}>
                    {isPriceUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span className="font-mono" data-numeric="true">
                      {isPriceUp ? "+" : ""}{market.metrics.priceChange24h.toFixed(2)}%
                    </span>
                    <span className="text-muted-foreground">24H</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setChartMode("candles")}
                  className={`text-[10px] border ${chartMode === "candles" ? "border-primary/50 text-primary" : "border-transparent"}`}
                  data-testid="button-chart-candles"
                >
                  [CANDLES]
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setChartMode("twap")}
                  className={`text-[10px] border ${chartMode === "twap" ? "border-primary/50 text-primary" : "border-transparent"}`}
                  data-testid="button-chart-twap"
                >
                  [TWAP]
                </Button>
              </div>
            </div>

            <div className="mt-4 -mx-4 overflow-hidden border border-primary/10 bg-background/60">
              <GMGNWidget mintAddress={mintAddress || ""} interval={gmgnInterval} height={420} />
            </div>

          </Card>
        </div>

        {/* Middle: Order Book */}
        <div className="xl:col-span-3">
          <Card className="border-primary/20 bg-card overflow-hidden h-full">
            <div className="p-3 border-b border-primary/20">
              <h3 className="text-xs font-bold text-primary">ORDER_BOOK.DB</h3>
            </div>
            <OrderBook
              bids={orderBook.bids}
              asks={orderBook.asks}
            />
          </Card>
        </div>

        {/* Right: Trade Panel */}
        <div className="xl:col-span-3">
          <Card className="p-4 border-primary/20 bg-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-primary">TRADE.EXEC</h3>
            </div>

            {/* Order Type Tabs */}
            <Tabs value={orderType} onValueChange={(v) => setOrderType(v as "market" | "limit")} className="mb-4">
              <TabsList className="grid w-full grid-cols-2 bg-background border border-primary/20">
                <TabsTrigger
                  value="market"
                  className="text-[10px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                  data-testid="tab-market"
                >
                  [MARKET]
                </TabsTrigger>
                <TabsTrigger
                  value="limit"
                  className="text-[10px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                  data-testid="tab-limit"
                >
                  [LIMIT]
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Buy/Sell Tabs */}
            <Tabs value={side} onValueChange={(v) => setSide(v as "buy" | "sell")} className="mb-4">
              <TabsList className="grid w-full grid-cols-2 bg-background border border-primary/20">
                <TabsTrigger
                  value="buy"
                  className="text-[10px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                  data-testid="tab-buy"
                >
                  [BUY]
                </TabsTrigger>
                <TabsTrigger
                  value="sell"
                  className="text-[10px] data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive"
                  data-testid="tab-sell"
                >
                  [SELL]
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-3">
              {/* Limit Price (only for limit orders) */}
              {orderType === "limit" && (
                <div>
                  <Label htmlFor="limit-price" className="text-[10px] text-muted-foreground mb-1.5 block">
                    LIMIT_PRICE
                  </Label>
                  <Input
                    id="limit-price"
                    type="number"
                    placeholder="0.0000"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="font-mono text-sm h-9 bg-background border-primary/20"
                    data-testid="input-limit-price"
                  />
                </div>
              )}

              {/* Size */}
              <div>
                <Label htmlFor="size-input" className="text-[10px] text-muted-foreground mb-1.5 block">
                  SIZE ({displaySymbol})
                </Label>
                <Input
                  id="size-input"
                  type="number"
                  placeholder="0.00"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="font-mono text-sm h-9 bg-background border-primary/20"
                  data-testid="input-size"
                />
              </div>

              {/* Multiplier Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-[10px] text-muted-foreground">
                    MULTIPLIER
                  </Label>
                  <span className="text-xs font-bold font-mono text-primary" data-numeric="true">
                    {multiplier[0]}x
                  </span>
                </div>
                <Slider
                  value={multiplier}
                  onValueChange={setMultiplier}
                  max={100}
                  min={1}
                  step={1}
                  className="mb-1"
                  data-testid="slider-multiplier"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>1x</span>
                  <span>50x</span>
                  <span>100x</span>
                </div>
              </div>

              {/* Order Summary */}
              <div className="space-y-1.5 text-[10px] p-3 bg-background/50 border border-primary/20">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PRICE</span>
                  <span className="font-mono text-foreground" data-numeric="true">
                    ${orderType === "market" ? market.metrics.currentPrice.toFixed(4) : (limitPrice || "0.0000")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SIZE</span>
                  <span className="font-mono text-foreground" data-numeric="true">{size || "0.00"}</span>
                </div>
                {multiplier[0] > 1 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">MULTIPLIER</span>
                    <span className="font-mono text-primary" data-numeric="true">{multiplier[0]}x</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EFFECTIVE_SIZE</span>
                  <span className="font-mono text-foreground" data-numeric="true">{effectiveSize.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-primary/20">
                  <span className="text-primary">TOTAL</span>
                  <span className="font-mono font-bold text-primary" data-numeric="true">
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Multi-Wallet Selection */}
              {isAuthenticated && userWallets.length > 1 && (
                <div className="space-y-3 pt-3 border-t border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">WALLET SELECTION</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6 px-2"
                      onClick={() => setShowWalletSelection(!showWalletSelection)}
                    >
                      {showWalletSelection ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {showWalletSelection ? "HIDE" : "SELECT"}
                    </Button>
                  </div>

                  {showWalletSelection && (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {userWallets.map((wallet) => (
                        <div key={wallet.id} className="flex items-center gap-2 p-2 bg-background/50 border border-primary/10 rounded">
                          <Checkbox
                            checked={selectedWallets[wallet.id]?.selected || false}
                            onCheckedChange={() => toggleWalletSelection(wallet.id)}
                            className="w-3 h-3"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono text-primary truncate">
                              {wallet.name} ({wallet.publicKey.slice(0, 8)}...)
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Balance: {parseFloat(wallet.balance || "0").toFixed(4)} SOL
                            </div>
                          </div>
                          {selectedWallets[wallet.id]?.selected && (
                            <div className="w-20">
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={selectedWallets[wallet.id]?.solAmount || ""}
                                onChange={(e) => updateWalletSolAmount(wallet.id, e.target.value)}
                                className="text-xs h-6"
                                step="0.01"
                                min="0"
                                max={wallet.balance}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {getSelectedWalletsCount() > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Selected: {getSelectedWalletsCount()} wallet(s) | Total SOL: {getTotalSelectedSol().toFixed(4)}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  className={`w-full h-9 font-bold text-[10px] ${side === "buy"
                    ? "border-primary/30 text-primary hover:bg-primary/10"
                    : "border-destructive/30 text-destructive hover:bg-destructive/10"
                    }`}
                  disabled={!size || parseFloat(size) <= 0 || (orderType === "limit" && !limitPrice) || (getSelectedWalletsCount() > 0 && getTotalSelectedSol() <= 0)}
                  data-testid="button-trade-submit"
                >
                  {getSelectedWalletsCount() > 0
                    ? `[${orderType.toUpperCase()}_${side.toUpperCase()}_${getSelectedWalletsCount()}W]`
                    : `[${orderType.toUpperCase()}_${side.toUpperCase()}]`
                  }
                </Button>
              </motion.div>

              <div className="text-[9px] text-center text-muted-foreground">
                {isAuthenticated
                  ? (getSelectedWalletsCount() > 0
                    ? `> READY_TO_TRADE_WITH_${getSelectedWalletsCount()}_WALLETS`
                    : "> SELECT_WALLETS_TO_TRADE")
                  : "> CONNECT_WALLET_TO_TRADE"
                }
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Tabs */}
      <Card className="border-primary/20 bg-card">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <div className="border-b border-primary/20 px-4">
            <TabsList className="bg-transparent border-0 h-10">
              <TabsTrigger value="trades" className="text-[10px] data-[state=active]:border-b-2 data-[state=active]:border-primary" data-testid="tab-trades">
                [TRADES]
              </TabsTrigger>
              <TabsTrigger value="positions" className="text-[10px] data-[state=active]:border-b-2 data-[state=active]:border-primary" data-testid="tab-positions">
                [POSITIONS]
              </TabsTrigger>
              <TabsTrigger value="orders" className="text-[10px] data-[state=active]:border-b-2 data-[state=active]:border-primary" data-testid="tab-orders">
                [ORDERS]
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="trades" className="mt-0">
            <TradesFeed trades={trades} />
          </TabsContent>

          <TabsContent value="positions" className="p-6">
            <div className="text-center py-8 text-muted-foreground text-xs">
              &gt; NO_OPEN_POSITIONS
            </div>
          </TabsContent>

          <TabsContent value="orders" className="p-6">
            <div className="text-center py-8 text-muted-foreground text-xs">
              &gt; NO_OPEN_ORDERS
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}


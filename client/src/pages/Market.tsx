import { GMGNWidget } from "@/components/shared/GMGNWidget";
import HoldersList from "@/components/shared/HoldersList";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TokenAvatar } from "@/components/shared/TokenAvatar";
import { TradesFeed } from "@/components/shared/TradesFeed";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchGmgnTokenHolders,
  fetchGmgnTokenTrades,
  fetchJupiterRecentTokens,
  fetchJupiterTokenByMint,
  fetchMarketBySymbol,
  fetchOrderBook,
  fetchRecentTrades,
  simulateTrade,
  type JupiterToken,
} from "@/lib/api";
import { Buffer } from "@/lib/bufferPolyfill";
import {
  executeJupiterUltraSwap,
  getJupiterUltraOrder,
  type JupiterUltraOrderResponse,
  type JupiterUltraSwapMode,
} from "@/lib/jupiterUltra";
import type { OrderBook as OrderBookType, Trade } from "@shared/schema";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { motion } from "framer-motion";
import { ArrowUpDown, Copy, TrendingDown, TrendingUp } from "lucide-react";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";

function formatUsd(value: number | undefined, fallback = "$0") {
  if (!Number.isFinite(value) || value === undefined) return fallback;

  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

const normalizeSymbol = (value: string | null | undefined): string => {
  if (!value) return "";
  return value.toString().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
};

// Heuristic to detect if a route value looks like a Solana mint (base58-ish)
const isProbablyMint = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const s = String(value).trim();
  if (s.length < 32 || s.length > 44) return false;
  // base58 chars (no 0, O, I, l)
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
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
const SOL_ICON_URL = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_DECIMALS = 9;
const DEFAULT_SLIPPAGE_BPS = 50;
const MAX_DISPLAY_DECIMALS = 6;

const sanitizeNumericInput = (value: string): string => value.replace(/,/g, "").trim();

const isValidDecimalInput = (value: string, decimals: number): boolean => {
  if (value === "") return true;
  const normalized = sanitizeNumericInput(value);
  const pattern = new RegExp(`^\\d*(?:\\.\\d{0,${decimals}})?$`);
  return pattern.test(normalized);
};

const toAtomicAmount = (value: string, decimals: number): string | null => {
  const normalized = sanitizeNumericInput(value);
  if (!normalized) return null;
  if (!/^\d*(?:\.\d*)?$/.test(normalized)) return null;

  const [wholePartRaw, fractionPartRaw = ""] = normalized.split(".");
  const wholePart = wholePartRaw.replace(/^0+(?=\d)/, "") || "0";

  if (!/^\d+$/.test(wholePart)) return null;

  const safeDecimals = Math.max(decimals, 0);
  const cleanedFraction = fractionPartRaw.replace(/\D/g, "");
  const paddedFraction =
    safeDecimals === 0 ? "" : (cleanedFraction + "0".repeat(safeDecimals)).slice(0, safeDecimals);

  const combined = wholePart + paddedFraction;
  const trimmed = combined.replace(/^0+/, "");
  return trimmed || "0";
};

const fromAtomicAmount = (
  value: string | null | undefined,
  decimals: number,
  fractionDigits = Math.min(decimals, MAX_DISPLAY_DECIMALS)
): string => {
  if (!value) return "0";
  try {
    const atomic = BigInt(value);
    if (decimals <= 0) {
      return atomic.toString();
    }
    const base = BigInt(10) ** BigInt(decimals);
    const whole = atomic / base;
    const fraction = atomic % base;

    if (fraction === 0n) {
      return whole.toString();
    }

    const fractionString = fraction
      .toString()
      .padStart(decimals, "0")
      .slice(0, Math.max(fractionDigits, 0))
      .replace(/0+$/, "");

    return fractionString ? `${whole.toString()}.${fractionString}` : whole.toString();
  } catch {
    return "0";
  }
};

const hasPositiveAtomicAmount = (value: string | null): boolean => {
  if (!value) return false;
  try {
    return BigInt(value) > 0n;
  } catch {
    return false;
  }
};

const decodeBase64ToUint8Array = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? normalized : `${normalized}${"=".repeat(4 - (normalized.length % 4))}`;
  if (typeof atob === "function") {
    const binary = atob(padding);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return array;
  }
  return Uint8Array.from(Buffer.from(padding, "base64"));
};

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
  const [, setLocation] = useLocation();
  const routeSymbol = params?.symbol ?? "SLAB";
  const symbol = routeSymbol.toUpperCase();
  const normalizedSymbol = normalizeSymbol(routeSymbol);
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  const [chartMode, setChartMode] = useState<"candles" | "twap">("candles");
  const [activeTab, setActiveTab] = useState<"trades" | "funding" | "positions">("trades");
  const [market, setMarket] = useState<any>(null);
  const [orderBook, setOrderBook] = useState<OrderBookType | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [holdersPages, setHoldersPages] = useState<any[][]>([]);
  const [holdersPageIndex, setHoldersPageIndex] = useState(0);
  const [holdersLoading, setHoldersLoading] = useState(false);
  const [holdersNext, setHoldersNext] = useState<string | null | undefined>(null);
  const [holdersFilter, setHoldersFilter] = useState<"top10" | "top30" | "all">("top10");
  const [jupiterToken, setJupiterToken] = useState<JupiterToken | null>(null);
  const [isMockMarket, setIsMockMarket] = useState(false);
  const [isMarketLoading, setIsMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);

  // Trade ticket state
  const [tradeMode, setTradeMode] = useState<"slab" | "spot">("slab");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [multiplier, setMultiplier] = useState([1]);

  // Multi-wallet trading state
  const [userWallets, setUserWallets] = useState<any[]>([]);
  const [selectedWallets, setSelectedWallets] = useState<{ [walletId: string]: { selected: boolean; solAmount: string } }>({});
  const [showWalletSelection, setShowWalletSelection] = useState(false);
  const [spotSellAmount, setSpotSellAmount] = useState("");
  const [spotBuyAmount, setSpotBuyAmount] = useState("");
  const [lastEditedSpotField, setLastEditedSpotField] = useState<"sell" | "buy">("sell");
  const [isSellingSol, setIsSellingSol] = useState(true);
  const [quote, setQuote] = useState<JupiterUltraOrderResponse | null>(null);
  const [quoteMeta, setQuoteMeta] = useState<{ swapMode: JupiterUltraSwapMode; atomicAmount: string } | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const quoteRateLimitUntilRef = useRef(0);

  const tokenMint =
    jupiterToken?.id ?? (typeof market?.mintAddress === "string" ? market.mintAddress : null);
  const tokenDecimals = jupiterToken?.decimals ?? 6;
  const inputMint = isSellingSol ? SOL_MINT : tokenMint;
  const outputMint = isSellingSol ? tokenMint : SOL_MINT;
  const inputDecimals = isSellingSol ? SOL_DECIMALS : tokenDecimals;
  const outputDecimals = isSellingSol ? tokenDecimals : SOL_DECIMALS;
  const swapMode: JupiterUltraSwapMode = lastEditedSpotField === "sell" ? "ExactIn" : "ExactOut";
  const hasUserWallet = Boolean(user?.wallet?.publicKey);
  const atomicSellAmount = useMemo(
    () => toAtomicAmount(spotSellAmount, inputDecimals),
    [spotSellAmount, inputDecimals]
  );
  const atomicBuyAmount = useMemo(
    () => toAtomicAmount(spotBuyAmount, outputDecimals),
    [spotBuyAmount, outputDecimals]
  );
  const currentAtomicAmount = swapMode === "ExactIn" ? atomicSellAmount : atomicBuyAmount;
  const isSwapAvailable = Boolean(inputMint && outputMint);
  const takerAddress = user?.wallet?.publicKey ?? undefined;

  const handleSellAmountChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = sanitizeNumericInput(event.target.value);
      if (!isValidDecimalInput(nextValue, inputDecimals)) return;
      setLastEditedSpotField("sell");
      setSpotSellAmount(nextValue);
    },
    [inputDecimals]
  );

  const handleBuyAmountChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = sanitizeNumericInput(event.target.value);
      if (!isValidDecimalInput(nextValue, outputDecimals)) return;
      setLastEditedSpotField("buy");
      setSpotBuyAmount(nextValue);
    },
    [outputDecimals]
  );

  const handleToggleDirection = useCallback(() => {
    const nextSell = sanitizeNumericInput(spotBuyAmount);
    const nextBuy = sanitizeNumericInput(spotSellAmount);

    setIsSellingSol((prev) => !prev);
    setLastEditedSpotField("sell");
    setSpotSellAmount(nextSell);
    setSpotBuyAmount(nextBuy);
    setQuote(null);
    setQuoteMeta(null);
    setQuoteError(null);
  }, [spotBuyAmount, spotSellAmount]);

  const handleConnectClick = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("slab-open-login-modal"));
  }, []);

  const handleSwap = useCallback(async () => {
    if (!isSwapAvailable || !inputMint || !outputMint) {
      toast({
        title: "Swap Unavailable",
        description: "This market does not have a swap route yet.",
        variant: "destructive",
      });
      return;
    }

    const atomicAmount = currentAtomicAmount;
    if (!atomicAmount || !hasPositiveAtomicAmount(atomicAmount)) {
      toast({
        title: "Invalid Amount",
        description: "Enter a valid amount before swapping.",
        variant: "destructive",
      });
      return;
    }

    if (!hasUserWallet) {
      handleConnectClick();
      return;
    }

    if (typeof window === "undefined") {
      toast({
        title: "Wallet Not Available",
        description: "Wallet connections require a browser environment.",
        variant: "destructive",
      });
      return;
    }

    const browserWallet = window.phantom?.solana || window.solana;
    if (!browserWallet) {
      toast({
        title: "Wallet Not Found",
        description: "Connect a Solana wallet like Phantom or Solflare to continue.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!browserWallet.publicKey && typeof browserWallet.connect === "function") {
        await browserWallet.connect();
      }
    } catch (error) {
      toast({
        title: "Wallet Connection Failed",
        description: error instanceof Error ? error.message : "Unable to connect wallet.",
        variant: "destructive",
      });
      return;
    }

    let walletPublicKey: string | null = null;
    try {
      if (typeof browserWallet.publicKey?.toBase58 === "function") {
        walletPublicKey = browserWallet.publicKey.toBase58();
      } else if (typeof browserWallet.publicKey === "string") {
        walletPublicKey = browserWallet.publicKey;
      } else if (typeof browserWallet.publicKey?.toString === "function") {
        walletPublicKey = browserWallet.publicKey.toString();
      }
    } catch (error) {
      console.error("Wallet public key error:", error);
    }

    if (!walletPublicKey) {
      toast({
        title: "Wallet Error",
        description: "Unable to read your wallet public key. Please reconnect.",
        variant: "destructive",
      });
      return;
    }

    if (typeof browserWallet.signTransaction !== "function") {
      toast({
        title: "Unsupported Wallet",
        description: "Connected wallet cannot sign transactions required for swaps.",
        variant: "destructive",
      });
      return;
    }

    setIsSwapping(true);

    try {
      const order = await getJupiterUltraOrder({
        inputMint,
        outputMint,
        amount: atomicAmount,
        swapMode,
        mode: swapMode,
        slippageBps: DEFAULT_SLIPPAGE_BPS,
        taker: walletPublicKey,
      });

      if (!order?.transaction) {
        const errorMessage =
          order?.errorMessage ||
          (order?.errorCode ? `Router returned code ${order.errorCode}` : null) ||
          "Router did not return a transaction to sign.";
        throw new Error(errorMessage);
      }

      setQuote(order);
      setQuoteMeta({ swapMode, atomicAmount });
      setQuoteError(null);

      if (swapMode === "ExactIn") {
        setSpotBuyAmount(fromAtomicAmount(order.outAmount, outputDecimals));
      } else {
        setSpotSellAmount(fromAtomicAmount(order.inAmount, inputDecimals));
      }

      const transactionBytes = decodeBase64ToUint8Array(order.transaction);
      let transactionToSign: VersionedTransaction | Transaction;
      try {
        transactionToSign = VersionedTransaction.deserialize(transactionBytes);
      } catch (versionedError) {
        try {
          transactionToSign = Transaction.from(transactionBytes);
        } catch (legacyError) {
          console.error("Failed to decode Jupiter swap transaction", versionedError, legacyError);
          throw new Error("Received an invalid swap transaction payload. Please refresh the quote and try again.");
        }
      }

      const signedTx = await browserWallet.signTransaction(transactionToSign);
      const serializedSigned =
        signedTx instanceof VersionedTransaction
          ? signedTx.serialize()
          : (signedTx as Transaction).serialize();
      const signedTransactionBase64 = Buffer.from(serializedSigned).toString("base64");

      const execution = await executeJupiterUltraSwap({
        signedTransaction: signedTransactionBase64,
        requestId: order.requestId,
      });

      const succeeded =
        typeof execution.status === "string" && execution.status.toLowerCase() === "success" &&
        (!execution.error || execution.error.length === 0);

      if (!succeeded) {
        throw new Error(execution.error || execution.status || "Swap execution failed");
      }

      toast({
        title: "Swap Submitted",
        description: execution.signature
          ? `Signature: ${execution.signature.slice(0, 8)}…${execution.signature.slice(-8)}`
          : "Swap executed successfully.",
      });
    } catch (error) {
      console.error("Swap execution failed:", error);
      const description =
        error instanceof Error
          ? error.message.includes("Reached end of buffer unexpectedly")
            ? "Unable to decode the swap transaction produced by the router. Please refresh the quote and retry."
            : error.message
          : "An unknown error occurred.";
      toast({
        title: "Swap Failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIsSwapping(false);
    }
  }, [
    currentAtomicAmount,
    handleConnectClick,
    hasUserWallet,
    inputDecimals,
    inputMint,
    outputDecimals,
    outputMint,
    swapMode,
    toast,
  ]);

  const sellUsdDisplay = useMemo(() => {
    if (quote?.inUsdValue !== undefined) {
      return formatUsd(quote.inUsdValue);
    }
    if (isFetchingQuote && hasPositiveAtomicAmount(atomicSellAmount)) {
      return "…";
    }
    return spotSellAmount ? "~" : "$0";
  }, [quote, isFetchingQuote, atomicSellAmount, spotSellAmount]);

  const buyUsdDisplay = useMemo(() => {
    if (quote?.outUsdValue !== undefined) {
      return formatUsd(quote.outUsdValue);
    }
    if (isFetchingQuote && hasPositiveAtomicAmount(atomicBuyAmount)) {
      return "…";
    }
    return spotBuyAmount ? "~" : "$0";
  }, [quote, isFetchingQuote, atomicBuyAmount, spotBuyAmount]);

  const priceImpactDisplay = useMemo(() => {
    if (!quote) return null;
    if (quote.priceImpactPct !== undefined && quote.priceImpactPct !== null) {
      const numeric = Number(quote.priceImpactPct);
      if (Number.isFinite(numeric)) {
        return `${(numeric * 100).toFixed(2)}%`;
      }
      if (typeof quote.priceImpactPct === "string") {
        return quote.priceImpactPct.includes("%")
          ? quote.priceImpactPct
          : `${quote.priceImpactPct}%`;
      }
    }
    if (quote.priceImpact !== undefined && Number.isFinite(quote.priceImpact)) {
      return `${quote.priceImpact.toFixed(2)}%`;
    }
    return null;
  }, [quote]);

  const routeLabel = useMemo(() => {
    return quote?.routePlan?.[0]?.swapInfo?.label ?? null;
  }, [quote]);

  const atomicAmountForQuote = currentAtomicAmount;
  const hasFreshQuote =
    Boolean(quote) &&
    Boolean(quoteMeta) &&
    quoteMeta?.swapMode === swapMode &&
    quoteMeta?.atomicAmount === atomicAmountForQuote &&
    !quoteError;

  const swapButtonDisabled = hasUserWallet
    ? !isSwapAvailable ||
    !hasFreshQuote ||
    !atomicAmountForQuote ||
    !hasPositiveAtomicAmount(atomicAmountForQuote) ||
    isFetchingQuote ||
    isSwapping
    : false;

  const swapButtonLabel = hasUserWallet
    ? isSwapping
      ? "SWAPPING..."
      : isFetchingQuote
        ? "FETCHING ROUTE..."
        : "SWAP"
    : "CONNECT WALLET";
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
          // attempt to fetch Jupiter token data for this market's mint so we can show Jupiter-provided liquidity/metrics
          try {
            const jTokenForMarket = await fetchJupiterTokenByMint(existingMarket.mintAddress);
            if (!cancelled && jTokenForMarket) {
              setJupiterToken(jTokenForMarket);
            } else {
              setJupiterToken(null);
            }
          } catch (err) {
            // ignore and continue with registry data
            setJupiterToken(null);
          }
          setMarket(existingMarket);
          setLimitPrice(existingMarket.metrics.currentPrice.toFixed(4));

          const ob = await fetchOrderBook(existingMarket.id);
          let recentTrades: Trade[] = [];
          try {
            if (existingMarket.mintAddress) {
              // Prefer GMGN token trades when a mint address is available
              recentTrades = await fetchGmgnTokenTrades(existingMarket.mintAddress);
            } else {
              recentTrades = await fetchRecentTrades(existingMarket.id);
            }
          } catch (err) {
            recentTrades = await fetchRecentTrades(existingMarket.id);
          }

          if (cancelled) return;
          setOrderBook(ob);
          setTrades(recentTrades);
          setIsMarketLoading(false);
          return;
        }

        // If the route param was a mint id (or the user navigated using an id), try fetching the Jupiter token by mint
        try {
          const tokenByMint = await fetchJupiterTokenByMint(routeSymbol);
          if (!cancelled && tokenByMint) {
            const mockMarket = createMockMarketFromToken(tokenByMint);
            const mockOrderBook = generateMockOrderBook(tokenByMint, mockMarket.metrics.currentPrice);

            setIsMockMarket(true);
            setJupiterToken(tokenByMint);
            setMarket(mockMarket);
            setOrderBook(mockOrderBook);
            // If the user navigated using a mint-like route, try fetching GMGN trades
            if (isProbablyMint(routeSymbol)) {
              try {
                const gmgnTrades = await fetchGmgnTokenTrades(routeSymbol);
                if (!cancelled) setTrades(gmgnTrades);
              } catch (err) {
                if (!cancelled) setTrades([]);
              }
            } else {
              setTrades([]);
            }
            setLimitPrice(mockMarket.metrics.currentPrice.toFixed(6));
            // store under the normalized symbol for faster future lookups
            storeTokenForSymbol(normalizedSymbol || symbol, tokenByMint);
            setIsMarketLoading(false);
            return;
          }
        } catch (err) {
          // ignore and continue to other resolution methods
        }

        if (storedToken) {
          const mockMarket = createMockMarketFromToken(storedToken);
          const mockOrderBook = generateMockOrderBook(storedToken, mockMarket.metrics.currentPrice);

          if (cancelled) return;
          setIsMockMarket(true);
          setJupiterToken(storedToken);
          setMarket(mockMarket);
          setOrderBook(mockOrderBook);
          if (isProbablyMint(routeSymbol)) {
            try {
              const gmgnTrades = await fetchGmgnTokenTrades(routeSymbol);
              if (!cancelled) setTrades(gmgnTrades);
            } catch (err) {
              if (!cancelled) setTrades([]);
            }
          } else {
            setTrades([]);
          }
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

          if (cancelled) return;
          setIsMockMarket(true);
          setJupiterToken(matchedToken);
          setMarket(mockMarket);
          setOrderBook(mockOrderBook);
          if (isProbablyMint(routeSymbol)) {
            try {
              const gmgnTrades = await fetchGmgnTokenTrades(routeSymbol);
              if (!cancelled) setTrades(gmgnTrades);
            } catch (err) {
              if (!cancelled) setTrades([]);
            }
          } else {
            setTrades([]);
          }
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
    setTradeMode("slab");
  }, [symbol]);

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
        // UX: automatically reveal wallet selection UI when user wallets are available
        // so the user can easily pick wallets to trade with (avoids hidden "SELECT_WALLETS_TO_TRADE" message).
        if (wallets.length > 0) setShowWalletSelection(true);
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
    if (lastEditedSpotField !== "sell") return;

    if (!isSwapAvailable || !inputMint || !outputMint) {
      setQuote(null);
      setQuoteMeta(null);
      setQuoteError(tokenMint ? null : "Swap unavailable for this market");
      setSpotBuyAmount("");
      return;
    }

    if (!atomicSellAmount || !hasPositiveAtomicAmount(atomicSellAmount)) {
      setQuote(null);
      setQuoteMeta(null);
      setQuoteError(null);
      setSpotBuyAmount("");
      return;
    }

    let isActive = true;
    let isRunning = false;
    const controllers: AbortController[] = [];

    const fetchQuote = async () => {
      if (!isActive || isRunning) return;
      if (Date.now() < quoteRateLimitUntilRef.current) {
        return;
      }
      if (Date.now() < quoteRateLimitUntilRef.current) {
        return;
      }
      isRunning = true;
      const controller = new AbortController();
      controllers.push(controller);
      setIsFetchingQuote(true);
      try {
        const order = await getJupiterUltraOrder(
          {
            inputMint,
            outputMint,
            amount: atomicSellAmount,
            swapMode: "ExactIn",
            mode: "ExactIn",
            slippageBps: DEFAULT_SLIPPAGE_BPS,
            taker: takerAddress,
          },
          controller.signal
        );
        if (!isActive) return;
        setQuote(order);
        setQuoteMeta({ swapMode: "ExactIn", atomicAmount: atomicSellAmount });
        setQuoteError(null);
        setSpotBuyAmount(fromAtomicAmount(order.outAmount, outputDecimals));
      } catch (error) {
        if (!isActive || controller.signal?.aborted) return;
        const message = error instanceof Error ? error.message : "Failed to fetch swap route";
        if (message.includes("429")) {
          quoteRateLimitUntilRef.current = Date.now() + 15_000;
          setQuoteError("Router rate limited. Retrying automatically…");
        } else {
          setQuote(null);
          setQuoteMeta(null);
          setQuoteError(message);
          setSpotBuyAmount("");
        }
      } finally {
        isRunning = false;
        if (isActive) {
          setIsFetchingQuote(false);
        }
      }
    };

    const debounceId = window.setTimeout(fetchQuote, 250);
    const intervalId = window.setInterval(fetchQuote, 5000);

    return () => {
      isActive = false;
      controllers.forEach((controller) => controller.abort());
      window.clearTimeout(debounceId);
      window.clearInterval(intervalId);
      setIsFetchingQuote(false);
    };
  }, [
    lastEditedSpotField,
    isSwapAvailable,
    inputMint,
    outputMint,
    atomicSellAmount,
    takerAddress,
    outputDecimals,
    tokenMint,
  ]);

  useEffect(() => {
    if (lastEditedSpotField !== "buy") return;

    if (!isSwapAvailable || !inputMint || !outputMint) {
      setQuote(null);
      setQuoteMeta(null);
      setQuoteError(tokenMint ? null : "Swap unavailable for this market");
      setSpotSellAmount("");
      return;
    }

    if (!atomicBuyAmount || !hasPositiveAtomicAmount(atomicBuyAmount)) {
      setQuote(null);
      setQuoteMeta(null);
      setQuoteError(null);
      setSpotSellAmount("");
      return;
    }

    let isActive = true;
    let isRunning = false;
    const controllers: AbortController[] = [];

    const fetchQuote = async () => {
      if (!isActive || isRunning) return;
      isRunning = true;
      const controller = new AbortController();
      controllers.push(controller);
      setIsFetchingQuote(true);
      try {
        const order = await getJupiterUltraOrder(
          {
            inputMint,
            outputMint,
            amount: atomicBuyAmount,
            swapMode: "ExactOut",
            mode: "ExactOut",
            slippageBps: DEFAULT_SLIPPAGE_BPS,
            taker: takerAddress,
          },
          controller.signal
        );
        if (!isActive) return;
        setQuote(order);
        setQuoteMeta({ swapMode: "ExactOut", atomicAmount: atomicBuyAmount });
        setQuoteError(null);
        setSpotSellAmount(fromAtomicAmount(order.inAmount, inputDecimals));
      } catch (error) {
        if (!isActive || controller.signal?.aborted) return;
        const message = error instanceof Error ? error.message : "Failed to fetch swap route";
        if (message.includes("429")) {
          quoteRateLimitUntilRef.current = Date.now() + 15_000;
          setQuoteError("Router rate limited. Retrying automatically…");
        } else {
          setQuote(null);
          setQuoteMeta(null);
          setQuoteError(message);
          setSpotSellAmount("");
        }
      } finally {
        isRunning = false;
        if (isActive) {
          setIsFetchingQuote(false);
        }
      }
    };

    const debounceId = window.setTimeout(fetchQuote, 250);
    const intervalId = window.setInterval(fetchQuote, 5000);

    return () => {
      isActive = false;
      controllers.forEach((controller) => controller.abort());
      window.clearTimeout(debounceId);
      window.clearInterval(intervalId);
      setIsFetchingQuote(false);
    };
  }, [
    lastEditedSpotField,
    isSwapAvailable,
    inputMint,
    outputMint,
    atomicBuyAmount,
    takerAddress,
    inputDecimals,
    tokenMint,
  ]);

  useEffect(() => {
    if (!market) return;

    const interval = setInterval(async () => {
      try {
        // Determine mint to fetch trades for. Prefer jupiterToken -> market.mintAddress -> route param mint
        const routeMint = isProbablyMint(routeSymbol) ? routeSymbol : null;
        const mint = jupiterToken?.id ?? (typeof market?.mintAddress === "string" ? market.mintAddress : null) ?? routeMint;

        if (mint) {
          const recentTrades = await fetchGmgnTokenTrades(mint);
          setTrades(recentTrades);
        } else if (!isMockMarket) {
          const recentTrades = await fetchRecentTrades(market.id);
          setTrades(recentTrades);
        } else {
          // mock market and no mint available -> keep trades empty
          setTrades([]);
        }
      } catch (error) {
        console.error("Failed to refresh trades:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [market, isMockMarket, jupiterToken]);

  // Load holders for the token when we have a mint address
  useEffect(() => {
    let cancelled = false;
    const loadHoldersPage = async (cursor?: string, append = false) => {
      const routeMint = isProbablyMint(routeSymbol) ? routeSymbol : null;
      const mint = jupiterToken?.id ?? (typeof market?.mintAddress === "string" ? market.mintAddress : null) ?? routeMint;
      if (!mint) {
        setHoldersPages([]);
        setHoldersPageIndex(0);
        setHoldersNext(null);
        return;
      }

      setHoldersLoading(true);
      try {
        const limit = holdersFilter === "top10" ? 10 : holdersFilter === "top30" ? 30 : 50;
        const { holders: fetched, next } = await fetchGmgnTokenHolders(mint, limit, cursor);
        if (cancelled) return;

        if (append) {
          setHoldersPages((prev) => [...prev, fetched]);
          setHoldersPageIndex((prev) => prev + 1);
        } else {
          setHoldersPages([fetched]);
          setHoldersPageIndex(0);
        }
        setHoldersNext(next ?? null);
      } catch (err) {
        console.error("Failed to load holders:", err);
        if (!cancelled && !append) setHoldersPages([]);
      } finally {
        if (!cancelled) setHoldersLoading(false);
      }
    };

    // initial load
    loadHoldersPage();

    return () => {
      cancelled = true;
    };
  }, [market, jupiterToken, routeSymbol, holdersFilter]);

  const loadNextPage = async () => {
    // if we already have a next page cached, just advance index
    if (holdersPageIndex < holdersPages.length - 1) {
      setHoldersPageIndex((i) => i + 1);
      return;
    }

    if (!holdersNext) return;
    const routeMint = isProbablyMint(routeSymbol) ? routeSymbol : null;
    const mint = jupiterToken?.id ?? (typeof market?.mintAddress === "string" ? market.mintAddress : null) ?? routeMint;
    if (!mint) return;
    setHoldersLoading(true);
    try {
      const limit = holdersFilter === "top10" ? 10 : holdersFilter === "top30" ? 30 : 50;
      const { holders: fetched, next } = await fetchGmgnTokenHolders(mint, limit, holdersNext);
      setHoldersPages((prev) => [...prev, fetched]);
      setHoldersPageIndex((i) => i + 1);
      setHoldersNext(next ?? null);
    } catch (err) {
      console.error("Failed to load next holders page:", err);
    } finally {
      setHoldersLoading(false);
    }
  };

  const loadPrevPage = () => {
    if (holdersPageIndex > 0) setHoldersPageIndex((i) => i - 1);
  };

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
  const sellingSymbol = isSellingSol ? "SOL" : displaySymbol;
  const sellingIcon = isSellingSol
    ? SOL_ICON_URL
    : jupiterToken?.logoURI ?? market?.imageUrl ?? undefined;
  const buyingSymbol = isSellingSol ? displaySymbol : "SOL";
  const buyingIcon = isSellingSol
    ? jupiterToken?.logoURI ?? market?.imageUrl ?? undefined
    : SOL_ICON_URL;

  const handleCopyMint = useCallback(() => {
    const text = mintAddress;
    if (!text) {
      toast({ title: "No address", description: "No mint address available to copy.", variant: "destructive" });
      return;
    }

    const copySuccess = (msg?: string) =>
      toast({ title: "Copied", description: msg ?? "Mint address copied to clipboard." });

    const copyFail = (msg?: string) =>
      toast({ title: "Copy failed", description: msg ?? "Unable to copy address.", variant: "destructive" });

    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard
        .writeText(text)
        .then(() => copySuccess())
        .catch((err) => {
          console.error("clipboard.writeText failed:", err);
          // fallback to execCommand
          try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "absolute";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            copySuccess();
          } catch (e) {
            console.error("fallback copy failed:", e);
            copyFail();
          }
        });
      return;
    }

    // Fallback for older browsers
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      copySuccess();
    } catch (e) {
      console.error("fallback copy failed:", e);
      copyFail();
    }
  }, [mintAddress, toast]);
  const gmgnInterval: "1S" | "1" | "5" | "15" | "60" | "240" | "720" | "1D" = chartMode === "candles" ? "1S" : "240";

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
              <StatusBadge status={market.status} graduationProgress={market.metrics?.graduationProgress} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs">
          {market.status === "perps" && market.metrics.fundingRate !== undefined && (
            <div>
              <div className="text-muted-foreground mb-1">FUNDING</div>
              <div className="font-mono font-bold text-primary" data-numeric="true">
                {(market.metrics.fundingRate * 100).toFixed(4)}%
              </div>
            </div>
          )}

          {/* Copy mint address button placed to the right of the header */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={handleCopyMint}
              disabled={!mintAddress}
              title={mintAddress ? `Copy ${mintAddress}` : "No mint address"}
              aria-label="Copy mint address"
              className="ml-2 flex items-center gap-2 px-2 py-1 rounded border border-primary/20 bg-background/80 text-xs hover:bg-primary/10 disabled:opacity-40"
            >
              <Copy className="w-4 h-4 text-primary" />
              <span className="font-mono text-xs text-primary">{mintAddress ? `${mintAddress.slice(0, 6)}…${mintAddress.slice(-4)}` : "—"}</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main 3-column layout: Chart | OrderBook | Trade */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* Left: Chart */}
        <div className="xl:col-span-6">
          <Card className="p-4 border-primary/20 bg-card h-full flex flex-col">
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

              <div className="flex items-center gap-4">
                <div>
                  <div className="text-muted-foreground text-[10px]">MC</div>
                  <div className="font-mono font-bold text-foreground" data-numeric="true">
                    {formatUsd(jupiterToken?.mcap ?? jupiterToken?.fdv ?? jupiterToken?.liquidity ?? market?.metrics?.liquidity)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 -mx-4 overflow-hidden border border-primary/10 bg-background/60 flex-1">
              <GMGNWidget mintAddress={mintAddress || ""} interval={gmgnInterval} height={420} />
            </div>

          </Card>
        </div>

        {/* Middle: Holders / Order Book (tabbed) */}
        <div className="xl:col-span-3">
          <Card className="border-primary/20 bg-card overflow-hidden h-full flex flex-col">
            <div className="p-3 border-b border-primary/20">
              <h3 className="text-xs font-bold text-primary">ORDER_BOOK.DB</h3>
            </div>
            {/* Fixed height container for orderbook/holders so both tabs can scroll independently */}
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="holders" className="h-[50vh]">
                <div className="border-b border-primary/20">
                  <TabsList className="bg-transparent border-0 w-full grid grid-cols-2">
                    <TabsTrigger value="holders" className="text-[10px] font-mono tracking-wide w-full flex justify-center items-center data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">
                      Holders
                    </TabsTrigger>
                    <TabsTrigger value="orderbook" className="text-[10px] font-mono tracking-wide w-full flex justify-center items-center data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary">
                      Order Book
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="holders" className="h-full overflow-y-auto p-2 flex flex-col">
                  {/* Filters */}
                  <div className="px-2 pb-2 flex items-center gap-2">
                    <label className="text-[11px] text-muted-foreground">Show</label>
                    <select
                      value={holdersFilter}
                      onChange={(e) => setHoldersFilter(e.target.value as any)}
                      className="text-xs rounded border border-primary/10 bg-card px-2 py-1"
                    >
                      <option value="top10">Top 10</option>
                      <option value="top30">Top 30</option>
                      <option value="all">All</option>
                    </select>
                    {/* page info and total loaded */}
                    <div className="ml-auto text-[10px] text-muted-foreground">
                      {holdersPages.length === 0 ? "0 holders" : `${(holdersPages[holdersPageIndex] ?? []).length} on page ${holdersPageIndex + 1}`}
                    </div>
                  </div>

                  {/* Holders list */}
                  <div className="flex-1">
                    <div className="flex flex-col h-full">
                      <div className="flex-1">
                        <HoldersList
                          holders={holdersPages[holdersPageIndex] ?? []}
                          loading={holdersLoading}
                          tokenPrice={jupiterToken?.usdPrice ?? market?.metrics?.currentPrice}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2">
                        <button
                          type="button"
                          onClick={loadPrevPage}
                          disabled={holdersPageIndex <= 0}
                          className="px-3 py-1 text-xs rounded border border-primary/10 bg-card disabled:opacity-50"
                        >
                          ← Back
                        </button>

                        <div className="text-[11px] text-muted-foreground">Page {holdersPageIndex + 1}</div>

                        <button
                          type="button"
                          onClick={loadNextPage}
                          disabled={holdersNext == null && holdersPageIndex >= holdersPages.length - 1}
                          className="px-3 py-1 text-xs rounded border border-primary/10 bg-card disabled:opacity-50"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="orderbook" className="h-full p-2">
                  <div className="h-full overflow-y-auto">
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      No Slab market active on this token
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </Card>
        </div>

        {/* Right: Trade */}
        <div className="xl:col-span-3">
          <Card className="border-primary/20 bg-card h-full flex flex-col">
            <div className="p-3 border-b border-primary/20">
              <h3 className="text-xs font-bold text-primary">TRADE</h3>
            </div>
            <Tabs defaultValue="slab" className="flex-1">
              <div className="border-b border-primary/20">
                <TabsList className="bg-transparent border-0 w-full grid grid-cols-2">
                  <TabsTrigger
                    value="slab"
                    className="text-[10px] font-mono tracking-wide w-full flex justify-center items-center data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
                    data-testid="trade-tab-slab"
                  >
                    [SLAB]
                  </TabsTrigger>
                  <TabsTrigger
                    value="spot"
                    className="text-[10px] font-mono tracking-wide w-full flex justify-center items-center data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
                    data-testid="trade-tab-spot"
                  >
                    [SPOT]
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="flex-1 flex flex-col">
                <TabsContent
                  value="slab"
                  className="mt-0 h-full text-muted-foreground text-xs flex flex-col gap-3"
                >
                  {/* Slab trade UI (leverage) */}
                  <div className="px-4 pt-3">
                    <label className="text-[10px] font-semibold text-muted-foreground block mb-2">Select Slab</label>
                    <select
                      className="w-full rounded-md border border-primary/20 bg-card px-3 py-2 text-sm text-foreground"
                      defaultValue=""
                      aria-label="Select Slab"
                    >
                      <option value="" disabled>
                        -- Select Slab --
                      </option>
                    </select>
                  </div>

                  <div className="px-4">
                    <Card className="w-full border-primary/20 bg-background/80 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                      <div className="px-4 py-5 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <button
                              className={`text-[11px] px-3 py-1 rounded ${orderType === 'market' ? 'bg-primary text-primary-foreground' : 'bg-transparent border border-primary/10'}`}
                              onClick={() => setOrderType('market')}
                              type="button"
                            >
                              Market
                            </button>
                            <button
                              className={`text-[11px] px-3 py-1 rounded ${orderType === 'limit' ? 'bg-primary text-primary-foreground' : 'bg-transparent border border-primary/10'}`}
                              onClick={() => setOrderType('limit')}
                              type="button"
                            >
                              Limit
                            </button>
                          </div>
                          <div className="text-xs text-muted-foreground">Leverage: <span className="font-mono">{multiplier[0]}x</span></div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-[10px] uppercase font-semibold text-muted-foreground">Side</div>
                            <div className="mt-1">
                              <select value={side} onChange={(e) => setSide(e.target.value as any)} className="w-full rounded-md border border-primary/20 bg-card px-3 py-2 text-sm text-foreground">
                                <option value="buy">Buy</option>
                                <option value="sell">Sell</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] uppercase font-semibold text-muted-foreground">Size</div>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={size}
                              onChange={(e) => setSize(sanitizeNumericInput(e.target.value))}
                              placeholder="0.00"
                              className="w-full rounded-md border border-primary/20 bg-card px-3 py-2 text-sm text-foreground text-right"
                            />
                          </div>
                        </div>

                        {orderType === 'limit' && (
                          <div>
                            <div className="text-[10px] uppercase font-semibold text-muted-foreground">Limit Price</div>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={limitPrice}
                              onChange={(e) => setLimitPrice(sanitizeNumericInput(e.target.value))}
                              placeholder="0.00000000"
                              className="w-full rounded-md border border-primary/20 bg-card px-3 py-2 text-sm text-foreground text-right mt-1"
                            />
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] uppercase font-semibold text-muted-foreground">Multiplier</div>
                            <div className="text-xs font-mono">{multiplier[0]}x</div>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={10}
                            step={0.5}
                            value={multiplier[0]}
                            onChange={(e) => setMultiplier([Number(e.target.value)])}
                            className="w-full mt-2"
                          />
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="text-[10px] text-muted-foreground">Estimated Entry</div>
                          <div className="font-mono text-foreground">{limitPrice || market.metrics.currentPrice.toFixed(8)}</div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="text-[10px] text-muted-foreground">Total</div>
                          <div className="font-mono text-foreground">${(parseFloat(size || '0') * (parseFloat(limitPrice || String(market.metrics.currentPrice)) || market.metrics.currentPrice)).toFixed(6)}</div>
                        </div>

                        <div>
                          <button
                            className="w-full h-12 text-[11px] font-bold uppercase tracking-[0.35em] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 rounded"
                            onClick={async () => {
                              if (!market) return;
                              const numericSize = parseFloat(size || '0');
                              if (!numericSize || numericSize <= 0) {
                                toast({ title: 'Invalid size', description: 'Enter a valid trade size', variant: 'destructive' });
                                return;
                              }
                              try {
                                const res = await simulateTrade(market.id, side, numericSize, Number(limitPrice || market.metrics.currentPrice));
                                if (res?.success) {
                                  toast({ title: 'Order submitted', description: `Tx: ${res.txId}` });
                                } else {
                                  toast({ title: 'Order failed', description: 'Failed to create order', variant: 'destructive' });
                                }
                              } catch (err) {
                                console.error('Place order failed', err);
                                toast({ title: 'Order error', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
                              }
                            }}
                            type="button"
                          >
                            PLACE ORDER
                          </button>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Message & launch action when no slabs exist */}
                  <div className="px-4 text-center text-xs text-muted-foreground">
                    <div className="py-4">0 Slabs exist for this token. Launch its first slab.</div>
                    <div>
                      <Button size="sm" className="text-[10px] uppercase tracking-wide" onClick={() => setLocation('/launch')}>
                        Go to Launch Page
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent
                  value="spot"
                  className="mt-0 h-full text-muted-foreground text-xs flex items-center justify-center"
                >
                  <Card className="w-full border-primary/20 bg-background/80 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
                    <div className="px-4 py-5 space-y-5">
                      <div className="space-y-3">
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                          Selling
                        </div>
                        <div className="rounded-2xl border border-primary/20 bg-card/70 px-4 py-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 rounded-full border border-primary/10 bg-background/80 px-3 py-1.5">
                              <TokenAvatar symbol={sellingSymbol} iconUrl={sellingIcon} size={28} />
                              <div className="text-xs font-semibold text-foreground">{sellingSymbol}</div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="0.00"
                              value={spotSellAmount}
                              onChange={handleSellAmountChange}
                              className="w-full bg-transparent text-right font-mono text-2xl text-foreground tracking-tight focus:outline-none focus:ring-0"
                            />
                            <div className="text-[10px] text-muted-foreground">{sellUsdDisplay}</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-full border border-primary/30 bg-background/90 text-primary hover:bg-primary/10 disabled:opacity-60"
                          aria-label="Switch tokens"
                          onClick={handleToggleDirection}
                          disabled={!isSwapAvailable}
                          type="button"
                        >
                          <ArrowUpDown className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                          Buying
                        </div>
                        <div className="rounded-2xl border border-primary/20 bg-card/70 px-4 py-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 rounded-full border border-primary/10 bg-background/80 px-3 py-1.5">
                              <TokenAvatar symbol={buyingSymbol} iconUrl={buyingIcon} size={28} />
                              <div className="text-xs font-semibold text-foreground">{buyingSymbol}</div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="0.00"
                              value={spotBuyAmount}
                              onChange={handleBuyAmountChange}
                              className="w-full bg-transparent text-right font-mono text-2xl text-foreground tracking-tight focus:outline-none focus:ring-0"
                            />
                            <div className="text-[10px] text-muted-foreground">{buyUsdDisplay}</div>
                          </div>
                        </div>
                      </div>

                      {quoteError && (
                        <div className="text-[10px] text-destructive text-center uppercase tracking-[0.2em]">
                          {quoteError}
                        </div>
                      )}

                      {quote && !quoteError && hasFreshQuote && (
                        <div className="rounded-2xl border border-primary/20 bg-background/70 px-4 py-3 space-y-2 text-[10px]">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Route</span>
                            <span className="font-mono text-foreground">
                              {routeLabel || quote.router || "Jupiter"}
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Price Impact</span>
                            <span className="font-mono text-foreground">
                              {priceImpactDisplay ?? "--"}
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Slippage</span>
                            <span className="font-mono text-foreground">
                              {(DEFAULT_SLIPPAGE_BPS / 100).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      )}

                      <Button
                        className="w-full h-12 text-[11px] font-bold uppercase tracking-[0.35em] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                        onClick={hasUserWallet ? handleSwap : handleConnectClick}
                        disabled={hasUserWallet ? swapButtonDisabled : false}
                        aria-busy={isSwapping}
                        type="button"
                      >
                        {isSwapping ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            SWAPPING...
                          </span>
                        ) : (
                          swapButtonLabel
                        )}
                      </Button>
                    </div>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
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
            <div className="h-[50vh]">
              {/* wrapper ensures TradesFeed gets a fixed-height container and scrolls internally */}
              <div className="h-full overflow-y-auto">
                <TradesFeed trades={trades} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="positions" className="p-6">
            <div className="text-center py-8 text-muted-foreground text-xs">
              nothing here yet, open a slab trade first
            </div>
          </TabsContent>

          <TabsContent value="orders" className="p-6">
            <div className="text-center py-8 text-muted-foreground text-xs">
              nothing here yet, open a slab trade first
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

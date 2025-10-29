import { KPIStat } from "@/components/shared/KPIStat";
import { MarketTile } from "@/components/shared/MarketTile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchJupiterTokenByMint, type JupiterToken } from "@/lib/api";
import { fetchFirebaseCreatorTokens } from "@/lib/fetchFirebaseCreatorTokens";
import type { StoredMarketToken } from "@/lib/localMarkets";
import type { Market } from "@shared/schema";
import { motion } from "framer-motion";
import { DollarSign, Rocket, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";

const DEFAULT_BONDING_CONFIG: Market["bondingConfig"] = {
  curveType: "linear",
  startPrice: 0,
  creatorTax: 0,
  protocolTax: 0,
  seedVaultTax: 0,
};

const DEFAULT_GRADUATION: Market["graduationTriggers"] = {
  minLiquidity: 0,
  minHolders: 0,
  minAgeHours: 0,
};

const DEFAULT_PERPS_CONFIG: Market["perpsConfig"] = {
  tickSize: 0,
  lotSize: 0,
  maxLeverage: 1,
  initialMargin: 0,
  maintenanceMargin: 0,
  priceBandBps: 0,
  fundingK: 0,
  warmupHours: 0,
  warmupShortLevCap: 1,
};

const DEFAULT_FEES: Market["fees"] = {
  takerBps: 0,
  makerBps: 0,
  creatorFeePct: 0,
  referrerFeePct: 10,
};

const coerceString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const coerceNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const coerceStats24h = (
  value: unknown,
): { priceChange?: number; buyVolume?: number; sellVolume?: number } | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const stats = value as Record<string, unknown>;
  const priceChange = coerceNumber(stats.priceChange);
  const buyVolume = coerceNumber(stats.buyVolume);
  const sellVolume = coerceNumber(stats.sellVolume);
  if (priceChange === undefined && buyVolume === undefined && sellVolume === undefined) {
    return undefined;
  }
  return { priceChange, buyVolume, sellVolume };
};

const toMarketFromStored = (token: StoredMarketToken, jupiter?: JupiterToken): Market => {
  const launchedAt = token.launchedAt ?? Date.now();
  const ageHours = Math.max(0, (Date.now() - launchedAt) / (1000 * 60 * 60));
  const fallbackId = token.id || token.mintAddress;
  const tokenRecord = token as Record<string, unknown>;
  const firebaseStats = coerceStats24h(tokenRecord.stats24h);
  const jupiterRecord = jupiter ? (jupiter as Record<string, unknown>) : undefined;
  const jupiterStats = jupiterRecord ? coerceStats24h(jupiterRecord.stats24h) : undefined;
  const stats24h = jupiterStats ?? firebaseStats;
  const referralFeeOverride = coerceNumber(tokenRecord.referrerFeePct);
  const priceChangeOverride = coerceNumber(tokenRecord.priceChange24h);
  const volumeOverride = coerceNumber(tokenRecord.volume24h);
  const description = coerceString(tokenRecord.description) ?? (jupiterRecord ? coerceString(jupiterRecord.description) : undefined);
  const telegram = coerceString(tokenRecord.telegram) ?? (jupiterRecord ? coerceString(jupiterRecord.telegram) : undefined);
  const website = coerceString(tokenRecord.website) ?? (jupiterRecord ? coerceString(jupiterRecord.website) : undefined);
  const twitter = coerceString(tokenRecord.twitter) ?? (jupiterRecord ? coerceString(jupiterRecord.twitter) : undefined);
  const jupiterSymbol = coerceString(jupiter?.symbol);
  const tokenSymbol = coerceString(token.symbol) ?? coerceString(token.id) ?? coerceString(token.mintAddress);
  const symbol = (jupiterSymbol ?? tokenSymbol ?? "SLAB").toUpperCase();
  const name = coerceString(jupiter?.name) ?? coerceString(token.name) ?? symbol;
  const imageUrl = coerceString(jupiter?.icon) ?? coerceString(token.imageUrl) ?? coerceString(token.icon);
  const currentPrice = coerceNumber(jupiter?.usdPrice) ?? token.usdPrice ?? 0;
  const statsVolume = (stats24h?.buyVolume ?? 0) + (stats24h?.sellVolume ?? 0);
  const volume24h = volumeOverride ?? statsVolume;
  const jupiterLiquidity = jupiterRecord ? coerceNumber(jupiterRecord.liquidity) : undefined;
  const jupiterFdv = jupiterRecord ? coerceNumber(jupiterRecord.fdv) : undefined;
  const liquidity = jupiterLiquidity ?? (jupiterFdv ? jupiterFdv * 0.01 : undefined) ?? token.liquidity ?? 0;
  const holders = (jupiterRecord ? coerceNumber(jupiterRecord.holderCount) : undefined) ?? token.holderCount ?? 0;
  const priceChange24h = stats24h?.priceChange ?? priceChangeOverride ?? 0;
  const graduationProgress = coerceNumber(tokenRecord.graduationProgress) ?? 0;

  return {
    id: fallbackId ?? `${token.symbol ?? ""}-${launchedAt}`,
    symbol,
    name,
    imageUrl: imageUrl ?? token.imageUrl ?? token.icon,
    status: "bonding",
    createdAt: launchedAt,
    creatorAddress: token.creator,
    website: website ?? token.website,
    twitter: twitter ?? token.twitter,
    telegram,
    description,
    bondingConfig: { ...DEFAULT_BONDING_CONFIG },
    graduationTriggers: { ...DEFAULT_GRADUATION },
    perpsConfig: { ...DEFAULT_PERPS_CONFIG },
    fees: {
      ...DEFAULT_FEES,
      referrerFeePct: referralFeeOverride ?? DEFAULT_FEES.referrerFeePct,
    },
    metrics: {
      currentPrice,
      priceChange24h,
      volume24h,
      openInterest: liquidity,
      liquidity,
      holders,
      ageHours,
      graduationProgress,
    },
  };
};

const formatCompactCurrency = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  if (value >= 1) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${value.toFixed(2)}`;
};

export default function Creator() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const hasPromptedAuthRef = useRef(false);
  const [firebaseMarkets, setFirebaseMarkets] = useState<StoredMarketToken[]>([]);
  const [tokenStatus, setTokenStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [jupiterMap, setJupiterMap] = useState<Record<string, JupiterToken>>({});
  const [jupiterStatus, setJupiterStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [jupiterError, setJupiterError] = useState<string | null>(null);

  const walletAddress = user?.wallet?.publicKey ?? null;

  const triggerLoginModal = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("slab-open-login-modal"));
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      hasPromptedAuthRef.current = false;
      return;
    }

    if (!isLoading && !hasPromptedAuthRef.current) {
      hasPromptedAuthRef.current = true;
      toast({
        title: "Authentication Required",
        description: "Connect your wallet to access creator tools.",
        variant: "destructive",
      });
      triggerLoginModal();
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    if (!isAuthenticated || !walletAddress) {
      setFirebaseMarkets([]);
      setTokenStatus("idle");
      setTokenError(null);
      setJupiterMap({});
      setJupiterStatus("idle");
      setJupiterError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setTokenStatus("loading");
      setTokenError(null);
      try {
        const tokens = await fetchFirebaseCreatorTokens({ signer: walletAddress });
        if (!cancelled) {
          setFirebaseMarkets(tokens);
          setTokenStatus("success");
        }
      } catch (error) {
        console.error("Failed to load creator tokens from Firebase", error);
        if (!cancelled) {
          setTokenStatus("error");
          setTokenError(error instanceof Error ? error.message : String(error));
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, walletAddress]);

  useEffect(() => {
    if (!isAuthenticated || !walletAddress) {
      setJupiterMap({});
      setJupiterStatus("idle");
      setJupiterError(null);
      return;
    }

    const uniqueMints = Array.from(
      new Set(
        firebaseMarkets
          .map((token) => token.mintAddress ?? token.id)
          .filter((mint): mint is string => typeof mint === "string" && mint.length > 0),
      ),
    );

    if (uniqueMints.length === 0) {
      setJupiterMap({});
      setJupiterStatus("idle");
      setJupiterError(null);
      return;
    }

    let cancelled = false;

    const loadQuotes = async () => {
      setJupiterStatus("loading");
      setJupiterError(null);

      try {
        const results = await Promise.all(
          uniqueMints.map(async (mint) => {
            const token = await fetchJupiterTokenByMint(mint);
            return { mint, token } as const;
          }),
        );

        if (cancelled) {
          return;
        }

        const nextMap: Record<string, JupiterToken> = {};
        for (const { mint, token } of results) {
          if (token) {
            nextMap[mint.toLowerCase()] = token;
          }
        }

        setJupiterMap(nextMap);
        setJupiterStatus("success");
      } catch (error) {
        if (cancelled) {
          return;
        }
        setJupiterStatus("error");
        setJupiterError(error instanceof Error ? error.message : String(error));
      }
    };

    loadQuotes();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, walletAddress, firebaseMarkets]);

  const allCreatorMarkets = useMemo(() => {
    const byMint = new Map<string, StoredMarketToken>();

    for (const token of firebaseMarkets) {
      const key = (token.mintAddress ?? token.id)?.toLowerCase();
      if (!key) continue;
      const existing = byMint.get(key);
      if (!existing || (token.launchedAt ?? 0) > (existing.launchedAt ?? 0)) {
        byMint.set(key, token);
      }
    }

    return Array.from(byMint.values()).sort((a, b) => (b.launchedAt ?? 0) - (a.launchedAt ?? 0));
  }, [firebaseMarkets]);

  const marketCards = useMemo(
    () =>
      allCreatorMarkets.map((token) => {
        const key = (token.mintAddress ?? token.id)?.toLowerCase();
        const jupiter = key ? jupiterMap[key] : undefined;
        return toMarketFromStored(token, jupiter);
      }),
    [allCreatorMarkets, jupiterMap],
  );

  const rollupStats = useMemo(() => {
    const totals = {
      markets: marketCards.length,
      volume: 0,
      liquidity: 0,
      holders: 0,
    };

    for (const market of marketCards) {
      totals.volume += Number.isFinite(market.metrics.volume24h) ? market.metrics.volume24h : 0;
      totals.liquidity += Number.isFinite(market.metrics.liquidity) ? market.metrics.liquidity : 0;
      totals.holders += Number.isFinite(market.metrics.holders) ? market.metrics.holders : 0;
    }

    return totals;
  }, [marketCards]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <Rocket className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-mono mb-2 text-foreground">Authentication Required</h1>
          <p className="text-muted-foreground mb-6">
            You need to be logged in to access creator analytics and earnings.
          </p>
          <Button onClick={triggerLoginModal} className="w-full" data-testid="button-login-creator">
            Connect Wallet
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h1 className="text-3xl font-bold mb-2">Creator Dashboard</h1>
            <p className="text-muted-foreground">Track the markets you have launched and manage referrals.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 border-card-border bg-card">
              <KPIStat icon={Rocket} label="Markets Launched" value={rollupStats.markets} />
            </Card>
            <Card className="p-6 border-card-border bg-card">
              <KPIStat icon={TrendingUp} label="24h Volume" value={formatCompactCurrency(rollupStats.volume)} />
            </Card>
            <Card className="p-6 border-card-border bg-card">
              <KPIStat icon={DollarSign} label="Liquidity" value={formatCompactCurrency(rollupStats.liquidity)} />
            </Card>
            <Card className="p-6 border-card-border bg-card">
              <KPIStat icon={Users} label="Total Holders" value={rollupStats.holders} />
            </Card>
          </div>

          <Card className="p-6 border-card-border bg-card">
            <h3 className="text-lg font-semibold mb-4">Referral Code</h3>
            <p className="text-sm text-muted-foreground">Coming soon.</p>
          </Card>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Your Markets</h2>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {rollupStats.markets} Active
              </Badge>
            </div>

            {tokenStatus === "loading" && (
              <Alert className="mb-4">
                <AlertTitle>Fetching creator launches…</AlertTitle>
                <AlertDescription>Loading your SLAB launches from the registry.</AlertDescription>
              </Alert>
            )}

            {tokenStatus === "error" && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Live data unavailable</AlertTitle>
                <AlertDescription>
                  {tokenError ? `Firebase registry error: ${tokenError}` : "We couldn't load your launch data right now."}
                </AlertDescription>
              </Alert>
            )}

            {jupiterStatus === "loading" && firebaseMarkets.length > 0 && (
              <Alert className="mb-4">
                <AlertTitle>Refreshing market prices…</AlertTitle>
                <AlertDescription>Syncing live metrics from Jupiter.</AlertDescription>
              </Alert>
            )}

            {jupiterStatus === "error" && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Market metrics unavailable</AlertTitle>
                <AlertDescription>
                  {jupiterError ? `Jupiter data error: ${jupiterError}` : "We couldn't refresh market metrics right now."}
                </AlertDescription>
              </Alert>
            )}

            {marketCards.length === 0 ? (
              <Card className="p-6 border-card-border bg-card text-center">
                <p className="text-muted-foreground mb-4">You have not launched any markets yet.</p>
                <Button asChild>
                  <Link href="/launch">Launch your first market</Link>
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {marketCards.map((market) => (
                  <motion.div key={market.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <MarketTile market={market} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          <Card className="p-6 border-card-border bg-card">
            <h2 className="text-xl font-semibold mb-2">Payout History</h2>
            <p className="text-sm text-muted-foreground">On-chain payout tracking will appear here once earnings are distributed.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

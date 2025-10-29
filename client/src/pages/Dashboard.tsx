import { GMGNWidget } from "@/components/shared/GMGNWidget";
import { KPIStat } from "@/components/shared/KPIStat";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ProgressRing } from "@/components/shared/ProgressRing";
import { TokenAvatar } from "@/components/shared/TokenAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  fetchJupiterRecentTokens,
  fetchJupiterTokenByMint,
  fetchMarkets,
  startRealtimeUpdates,
  stopRealtimeUpdates,
  subscribeToJupiterRecentTokens,
  type JupiterToken,
} from "@/lib/api";
import { useMarketsStore } from "@/stores/useMarketsStore";
import { motion } from "framer-motion";
import { Clock, Droplet, TrendingUp, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const integerFormatter = new Intl.NumberFormat("en-US");

const formatUsd = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  if (value >= 1) {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }

  if (value >= 0.01) {
    return `$${value.toFixed(4)}`;
  }

  return `$${value.toPrecision(2)}`;
};

const formatCompactUsd = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return `$${compactNumberFormatter.format(value)}`;
};

const formatCount = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return integerFormatter.format(Math.round(value));
};

const tokenListOptions = [10, 20, 30, 50, 100];
const MAX_DISPLAYED_TOKENS = 200;

const DEFAULT_MINT_ADDRESS = "GUp3rW94BfVDCDtgFVTFFCaSceArov3Ws64Fzs5Hpump";

export default function Dashboard() {
  const { markets, setMarkets, updateMarketMetrics, addTrade } = useMarketsStore();
  const [jupiterTokens, setJupiterTokens] = useState<JupiterToken[]>([]);
  const [queuedTokens, setQueuedTokens] = useState<JupiterToken[]>([]);
  const initializedRef = useRef(false);
  const latestTokensRef = useRef<JupiterToken[]>([]);
  const [jupiterLoading, setJupiterLoading] = useState(true);
  const [jupiterError, setJupiterError] = useState<string | null>(null);
  const [jupiterLimit, setJupiterLimit] = useState(20);
  const [selectedToken, setSelectedToken] = useState<JupiterToken | null>(null);
  const [defaultToken, setDefaultToken] = useState<JupiterToken | null>(null);
  const [defaultTokenLoading, setDefaultTokenLoading] = useState(true);

  useEffect(() => {
    // Load default token from Jupiter API
    const loadDefaultToken = async () => {
      setDefaultTokenLoading(true);
      try {
        const token = await fetchJupiterTokenByMint(DEFAULT_MINT_ADDRESS);
        if (token) {
          setDefaultToken(token);
          setSelectedToken(token); // Set as selected by default
        } else {
          setJupiterError("Failed to load default token");
        }
      } catch (error) {
        console.error("Error loading default token:", error);
        setJupiterError("Failed to load default token");
      } finally {
        setDefaultTokenLoading(false);
      }
    };

    loadDefaultToken();

    // Keep the markets loading for backward compatibility (if needed elsewhere)
    fetchMarkets().then(setMarkets);

    startRealtimeUpdates(
      (marketId, price) => {
        updateMarketMetrics(marketId, { currentPrice: price });
      },
      (trade) => {
        addTrade(trade.marketId, trade);
      }
    );

    return () => {
      stopRealtimeUpdates();
    };
  }, []);

  // Polling effect for updating selected token data every 5 seconds
  useEffect(() => {
    const currentToken = selectedToken || defaultToken;
    if (!currentToken?.id) return;

    const updateTokenData = async () => {
      try {
        const updatedToken = await fetchJupiterTokenByMint(currentToken.id);
        if (updatedToken) {
          if (selectedToken && selectedToken.id === currentToken.id) {
            setSelectedToken(updatedToken);
          }
          if (defaultToken && defaultToken.id === currentToken.id) {
            setDefaultToken(updatedToken);
          }
        }
      } catch (error) {
        console.error("Error updating token data:", error);
      }
    };

    // Set up polling interval (10 seconds to avoid rate limiting)
    const pollInterval = setInterval(updateTokenData, 10000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [selectedToken, defaultToken]);

  useEffect(() => {
    let isMounted = true;

    const applySnapshot = (snapshot: { tokens: JupiterToken[]; fetchedAt: string | null; error?: string }) => {
      if (!isMounted) return;
      const incoming = (snapshot.tokens ?? []).filter((token) => Boolean(token?.id));

      if (!initializedRef.current) {
        initializedRef.current = true;

        if (incoming.length > 0) {
          const seen = new Set<string>();
          const deduped: JupiterToken[] = [];
          for (const token of incoming) {
            if (!token?.id || seen.has(token.id)) continue;
            seen.add(token.id);
            deduped.push(token);
          }
          const [first, ...rest] = deduped;
          if (first) {
            setJupiterTokens([first]);
            latestTokensRef.current = [first];
            setQueuedTokens(rest.slice(0, MAX_DISPLAYED_TOKENS * 3));
          } else {
            setJupiterTokens([]);
            latestTokensRef.current = [];
            setQueuedTokens([]);
          }
        } else {
          setJupiterTokens([]);
          latestTokensRef.current = [];
          setQueuedTokens([]);
        }
      } else {
        const incomingMap = new Map(incoming.map((token) => [token.id, token]));
        const currentTokens = latestTokensRef.current;

        setJupiterTokens((prev) => {
          const updated = prev.map((token) => incomingMap.get(token.id) ?? token);
          latestTokensRef.current = updated;
          return updated;
        });

        setQueuedTokens((prevQueue) => {
          const existingIds = new Set([
            ...currentTokens.map((token) => token.id),
            ...prevQueue.map((token) => token.id),
          ]);
          const additions: JupiterToken[] = [];
          const updatedQueue = prevQueue.map((token) => incomingMap.get(token.id) ?? token);

          for (const token of incoming) {
            if (!existingIds.has(token.id)) {
              additions.push(token);
              existingIds.add(token.id);
            }
          }

          if (!additions.length) {
            return updatedQueue;
          }

          const combinedQueue = [...updatedQueue, ...additions];
          return combinedQueue.slice(0, MAX_DISPLAYED_TOKENS * 3);
        });
      }

      setJupiterError(snapshot.error ?? null);
      setJupiterLoading(false);
    };

    const loadInitial = async () => {
      setJupiterLoading(true);
      const snapshot = await fetchJupiterRecentTokens();
      if (snapshot) {
        applySnapshot(snapshot);
      } else if (isMounted) {
        setJupiterError("Unable to fetch Jupiter tokens");
        setJupiterLoading(false);
      }
    };

    void loadInitial();

    const unsubscribe = subscribeToJupiterRecentTokens(
      (snapshot) => applySnapshot(snapshot),
      (error) => {
        console.error("Jupiter stream error:", error);
        if (!isMounted) return;
        setJupiterError("Realtime stream interrupted");
        setJupiterLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    latestTokensRef.current = jupiterTokens;
  }, [jupiterTokens]);

  useEffect(() => {
    if (!queuedTokens.length) return;

    const nextToken = queuedTokens[0];
    if (!nextToken) return;

    const timer = setTimeout(() => {
      setJupiterTokens((prev) => {
        const existingIndex = prev.findIndex((token) => token.id === nextToken.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = nextToken;
          latestTokensRef.current = updated;
          return updated;
        }
        const inserted = [nextToken, ...prev];
        const limited = inserted.slice(0, MAX_DISPLAYED_TOKENS);
        latestTokensRef.current = limited;
        return limited;
      });

      setQueuedTokens((prev) => prev.slice(1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [queuedTokens]);

  if (defaultTokenLoading || (!defaultToken && !selectedToken)) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <LoadingSkeleton className="h-96" />
          </div>
          <div className="lg:col-span-4">
            <LoadingSkeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  const featuredMarket = markets[0]; // Keep for fallback/legacy purposes
  const displayedJupiterTokens = jupiterTokens.slice(0, jupiterLimit);

  return (
    <div className="space-y-6 px-4 py-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold mb-2 text-primary">
          $ {(selectedToken || defaultToken)
            ? `${(selectedToken || defaultToken)?.symbol || (selectedToken || defaultToken)?.name}/TERMINAL`
            : "SLAB/TERMINAL"
          }
        </h1>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <motion.div
          className="lg:col-span-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="p-6 border-primary/20 bg-card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold mb-1 text-primary">
                  {selectedToken ? (selectedToken.symbol || selectedToken.name) : (defaultToken ? (defaultToken.symbol || defaultToken.name) : "Loading...")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selectedToken ? selectedToken.name : (defaultToken ? defaultToken.name : "Loading token data...")}
                </p>
              </div>
              {selectedToken && selectedToken !== defaultToken && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground hover:text-primary"
                  onClick={() => setSelectedToken(defaultToken)}
                >
                  [CLEAR]
                </Button>
              )}
            </div>

            <GMGNWidget
              mintAddress={(selectedToken || defaultToken)?.id || ""}
              height={360}
              interval="1S"
              className="mb-6"
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <KPIStat
                icon={Droplet}
                label="LIQUIDITY"
                value={formatCompactUsd((selectedToken || defaultToken)?.liquidity)}
                trend="up"
              />
              <KPIStat
                icon={Users}
                label="HOLDERS"
                value={formatCount((selectedToken || defaultToken)?.holderCount)}
                trend="up"
              />
              <KPIStat
                icon={Clock}
                label="FDV"
                value={formatCompactUsd((selectedToken || defaultToken)?.fdv)}
                trend="neutral"
              />
              <KPIStat
                icon={TrendingUp}
                label="PRICE"
                value={formatUsd((selectedToken || defaultToken)?.usdPrice)}
                trend="up"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-background/50 border border-primary/20">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    BONDING CURVE
                  </span>
                  <span className="text-xs font-bold text-primary">
                    {`${((selectedToken || defaultToken)?.bondingCurve || 0).toFixed(2)}%`}
                  </span>
                </div>
                <div className="h-1 bg-muted/20 border border-primary/20 overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(selectedToken || defaultToken)?.bondingCurve || 0}%`
                    }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
              <ProgressRing
                progress={(selectedToken || defaultToken)?.bondingCurve || 0}
                size={60}
                className="ml-4"
              />
            </div>


          </Card>
        </motion.div>

        <motion.div
          className="lg:col-span-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="p-6 border-primary/20 bg-card h-full flex flex-col">
            <div className="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 rounded-md">
              <img src="/slablogo.png" alt="SLAB Logo" className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold mb-2 text-primary">LAUNCH SLAB</h3>
            <p className="text-xs text-muted-foreground mb-6 flex-1">
              &gt; Create perpetual market with custom bonding curve
              <br />
              &gt; Earn fees from trades and graduation
            </p>
            <Link href="/launch">
              <Button className="w-full border-primary/30 bg-transparent text-primary hover:bg-primary/10" variant="outline" data-testid="button-launch-market">
                [LAUNCH]
              </Button>
            </Link>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.35 }}
      >
        <Card className="border-primary/20 bg-card overflow-hidden" style={{ height: "70vh" }}>
          <div className="p-4 border-b border-primary/20 flex items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-primary">JUPITER_MINTS.DB</h2>
            <div className="flex items-center gap-4 ml-auto">
              <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                LIST {jupiterLimit}
              </div>
              <div className="flex items-center gap-2">
                {tokenListOptions.map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant="ghost"
                    className={`h-6 px-2 text-[10px] border ${jupiterLimit === option ? "border-primary/50 text-primary bg-primary/10" : "border-primary/10 text-muted-foreground"
                      }`}
                    onClick={() => setJupiterLimit(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto" style={{ height: "calc(70vh - 64px)", overflowY: "auto" }}>
            {jupiterLoading ? (
              <div className="p-4 space-y-3">
                <LoadingSkeleton className="h-6 w-full" />
                <LoadingSkeleton className="h-6 w-full" />
                <LoadingSkeleton className="h-6 w-full" />
              </div>
            ) : (
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-primary/20 text-muted-foreground">
                    <th className="text-left p-3 font-medium text-foreground">TOKEN</th>
                    <th className="text-right p-3 font-medium text-foreground">PRICE</th>
                    <th className="text-right p-3 font-medium text-foreground">LIQUIDITY</th>
                    <th className="text-right p-3 font-medium text-foreground">FDV</th>
                    <th className="text-right p-3 font-medium text-foreground">HOLDERS</th>
                    <th className="text-right p-3 font-medium text-foreground">LAUNCHPAD</th>
                    <th className="text-right p-3 font-medium text-foreground">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedJupiterTokens.length ? (
                    displayedJupiterTokens.map((token, index) => {
                      const tags = Array.isArray(token["tags"]) ? (token["tags"] as string[]) : [];
                      const launchLabel = token.launchpad || tags[0] || "unknown";
                      const iconUrl = typeof token.icon === "string" ? token.icon : undefined;

                      const targetSymbol = (
                        token.symbol ||
                        token.name ||
                        token.id
                      )
                        .toString()
                        .replace(/[^a-zA-Z0-9]/g, "")
                        .toUpperCase() || token.id.slice(0, 6).toUpperCase();

                      return (
                        <motion.tr
                          key={token.id}
                          className="border-b border-primary/10 last:border-0 hover:bg-primary/5 cursor-pointer"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.03 }}
                          onClick={() => {
                            // Update the chart to show this token
                            setSelectedToken(token);
                          }}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <TokenAvatar
                                symbol={token.symbol}
                                name={token.name}
                                iconUrl={iconUrl}
                                size={28}
                              />
                              <div className="flex flex-col">
                                <span className="font-bold text-primary">{token.symbol ?? token.name}</span>
                                <span className="text-[10px] text-muted-foreground">{token.name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right text-foreground" data-numeric="true">
                            {formatUsd(typeof token.usdPrice === "number" ? token.usdPrice : undefined)}
                          </td>
                          <td className="p-3 text-right text-foreground" data-numeric="true">
                            {formatCompactUsd(typeof token.liquidity === "number" ? token.liquidity : undefined)}
                          </td>
                          <td className="p-3 text-right text-foreground" data-numeric="true">
                            {formatCompactUsd(typeof token.fdv === "number" ? token.fdv : undefined)}
                          </td>
                          <td className="p-3 text-right text-foreground" data-numeric="true">
                            {formatCount(typeof token.holderCount === "number" ? token.holderCount : undefined)}
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {launchLabel.toUpperCase()}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="border border-primary/20 text-primary hover:bg-primary/10 text-[10px]"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent row click
                                // Store the token data in localStorage for the market page to use
                                const storageKey = `jupiter-token-${token.id}`;
                                localStorage.setItem(storageKey, JSON.stringify({
                                  token,
                                  storedAt: Date.now()
                                }));

                                // Navigate to market with the token's mint address (id) or symbol
                                const routeParam = token.symbol || token.id;
                                window.location.href = `/market/${routeParam}`;
                              }}
                            >
                              [TRADE]
                            </Button>
                          </td>
                        </motion.tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="p-4 text-center text-muted-foreground" colSpan={7}>
                        {jupiterError ? `[ERROR] ${jupiterError}` : "No recent launches yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}


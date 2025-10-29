import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { TokenAvatar } from "@/components/shared/TokenAvatar";
import { TrendingTokenCard } from "@/components/shared/TrendingTokenCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  fetchJupiterTopTrendingTokens,
  subscribeToJupiterTopTrendingTokens,
  type JupiterTopTrendingToken,
} from "@/lib/api";
import { fetchAllFirebaseTokens } from "@/lib/fetchFirebaseCreatorTokens";
import type { StoredMarketToken } from "@/lib/localMarkets";
import { motion } from "framer-motion";
import { Droplet, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type LaunchpadFilter = "any" | "with-launchpad" | string;
type CommunityTagFilter = "any" | "community-assist" | "birdeye-trending";

type DiscoverFilters = {
  verifiedOnly: boolean;
  launchpad: LaunchpadFilter;
  communityTag: CommunityTagFilter;
};

type DisplayLimitValue = "10" | "25" | "50" | "100" | "all";
type SlabSortOption = "newest" | "top";

const COMMUNITY_TAG_LABELS: Record<Exclude<CommunityTagFilter, "any">, string> = {
  "community-assist": "Community Assist",
  "birdeye-trending": "Birdeye Trending",
};

const formatLaunchpadLabel = (value: string) =>
  value
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatCurrency = (value: number | undefined, decimals = 2) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "$0.00";
  }

  const absolute = Math.abs(value);
  const fixedDecimals = decimals;

  if (absolute >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(fixedDecimals)}B`;
  }
  if (absolute >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(fixedDecimals)}M`;
  }
  if (absolute >= 1_000) {
    return `$${(value / 1_000).toFixed(fixedDecimals)}K`;
  }

  return `$${value.toFixed(fixedDecimals)}`;
};

const formatNumberCompact = (value: number | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toLocaleString();
};

const coerceNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const coerceString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const formatLaunchDateLabel = (timestamp: number | undefined) => {
  if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
    return "Unknown launch";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Unknown launch";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const shortenAddress = (address: string | undefined) => {
  if (!address) {
    return "Unknown creator";
  }

  if (address.length <= 10) {
    return address;
  }

  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const getCreatorAddress = (token: StoredMarketToken): string | undefined => {
  const record = token as Record<string, unknown>;
  return coerceString(record.creator) ?? coerceString(record.signer) ?? token.creator;
};

const getTopScore = (token: StoredMarketToken): number => {
  const record = token as Record<string, unknown>;
  const volume = coerceNumber(record.volume24h);
  const liquidity = coerceNumber(record.liquidity);
  return volume ?? liquidity ?? 0;
};

interface FirebaseTokenCardProps {
  token: StoredMarketToken;
}

function FirebaseTokenCard({ token }: FirebaseTokenCardProps) {
  const tokenRecord = token as Record<string, unknown>;
  const usdPrice = coerceNumber(tokenRecord.usdPrice ?? token.usdPrice);
  const priceDecimals = usdPrice !== undefined && usdPrice > 0 && usdPrice < 1 ? 4 : 2;
  const launchpadLabel = coerceString(tokenRecord.launchpad) ?? coerceString(tokenRecord.metaLaunchpad) ?? "SLAB";
  const clusterLabel = coerceString(tokenRecord.cluster)?.toUpperCase() ?? null;
  const launchedAt = coerceNumber(tokenRecord.launchedAt) ?? token.launchedAt;
  const launchedLabel = formatLaunchDateLabel(launchedAt);
  const creatorValue = coerceString(tokenRecord.creator) ?? coerceString(tokenRecord.signer) ?? token.creator;
  const creatorLabel = shortenAddress(creatorValue);
  const volumeValue = coerceNumber(tokenRecord.volume24h);
  const liquidityValue = coerceNumber(tokenRecord.liquidity);
  const holdersValue = coerceNumber(tokenRecord.holderCount);
  const volumeDisplay = formatCurrency(volumeValue);
  const liquidityDisplay = formatCurrency(liquidityValue);
  const holdersDisplay = formatNumberCompact(holdersValue);
  const iconUrl = coerceString(tokenRecord.icon) ?? coerceString(tokenRecord.imageUrl);
  const symbolValue = coerceString(tokenRecord.symbol) ?? token.symbol ?? token.name ?? token.mintAddress;
  const nameValue = coerceString(tokenRecord.name) ?? token.name ?? token.mintAddress;

  return (
    <Card className="p-4 bg-card border border-card-border hover-elevate">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TokenAvatar
            symbol={symbolValue}
            name={nameValue}
            iconUrl={iconUrl}
            size={40}
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">
                {symbolValue ?? token.mintAddress}
              </h3>
              {clusterLabel && (
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                  {clusterLabel}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {nameValue ?? token.mintAddress}
            </p>
          </div>
        </div>
        {launchpadLabel && (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {launchpadLabel}
          </Badge>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <div className="text-xl font-mono font-semibold text-foreground" data-numeric="true">
            {formatCurrency(usdPrice, priceDecimals)}
          </div>
          <p className="text-xs text-muted-foreground">Launched {launchedLabel}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Creator</div>
          <div className="font-mono text-foreground" title={creatorValue}>
            {creatorLabel}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        <div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wide">
            <TrendingUp className="w-3 h-3" />
            Volume 24h
          </div>
          <div className="text-xs font-mono font-semibold text-foreground" data-numeric="true">
            {volumeDisplay}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wide">
            <Droplet className="w-3 h-3" />
            Liquidity
          </div>
          <div className="text-xs font-mono font-semibold text-foreground" data-numeric="true">
            {liquidityDisplay}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wide">
            <Users className="w-3 h-3" />
            Holders
          </div>
          <div className="text-xs font-mono font-semibold text-foreground" data-numeric="true">
            {holdersDisplay}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Discover() {
  const [firebaseTokens, setFirebaseTokens] = useState<StoredMarketToken[]>([]);
  const [firebaseLoading, setFirebaseLoading] = useState(true);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [creatorQuery, setCreatorQuery] = useState("");
  const [slabSort, setSlabSort] = useState<SlabSortOption>("newest");
  const [topTrendingTokens, setTopTrendingTokens] = useState<JupiterTopTrendingToken[]>([]);
  const [topTrendingFetchedAt, setTopTrendingFetchedAt] = useState<string | null>(null);
  const [topTrendingError, setTopTrendingError] = useState<string | null>(null);
  const [topTrendingLoading, setTopTrendingLoading] = useState(true);
  const [filters, setFilters] = useState<DiscoverFilters>({
    verifiedOnly: false,
    launchpad: "any",
    communityTag: "any",
  });
  const [displayLimit, setDisplayLimit] = useState<DisplayLimitValue>("all");

  useEffect(() => {
    let cancelled = false;

    const loadFirebaseTokens = async () => {
      setFirebaseLoading(true);
      setFirebaseError(null);

      try {
        const tokens = await fetchAllFirebaseTokens();
        if (!cancelled) {
          setFirebaseTokens(tokens);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch Firebase tokens", error);
          const message = error instanceof Error ? error.message : "Failed to load creator tokens";
          setFirebaseError(message);
        }
      } finally {
        if (!cancelled) {
          setFirebaseLoading(false);
        }
      }
    };

    void loadFirebaseTokens();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const load = async () => {
      try {
        const snapshot = await fetchJupiterTopTrendingTokens();
        if (!isMounted) return;

        if (snapshot) {
          setTopTrendingTokens(snapshot.tokens ?? []);
          setTopTrendingFetchedAt(snapshot.fetchedAt ?? null);
          // Filter out rate limit errors - they're expected and not user-actionable
          const error = snapshot.error;
          setTopTrendingError(
            error && !error.includes('429') && !error.includes('rate limit')
              ? error
              : null
          );
        }
      } catch (error) {
        console.error("Failed to fetch top trending tokens:", error);
        if (isMounted) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          // Filter out rate limit errors
          setTopTrendingError(
            errorMsg.includes('429') || errorMsg.includes('rate limit')
              ? null
              : errorMsg
          );
        }
      } finally {
        if (isMounted) {
          setTopTrendingLoading(false);
        }
      }

      unsubscribe = subscribeToJupiterTopTrendingTokens(
        (snapshot) => {
          if (!isMounted) return;
          setTopTrendingTokens(snapshot.tokens ?? []);
          setTopTrendingFetchedAt(snapshot.fetchedAt ?? null);
          // Filter out rate limit errors
          const error = snapshot.error;
          setTopTrendingError(
            error && !error.includes('429') && !error.includes('rate limit')
              ? error
              : null
          );
        },
        (err) => {
          console.error("Top trending SSE error:", err);
        },
      );
    };

    void load();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  const firebaseCatalog = useMemo(() => {
    const byMint = new Map<string, StoredMarketToken>();

    firebaseTokens.forEach((token) => {
      const mintAddress = typeof token.mintAddress === "string" ? token.mintAddress.toLowerCase() : undefined;
      const fallbackId = typeof token.id === "string" ? token.id.toLowerCase() : undefined;
      const key = mintAddress ?? fallbackId;
      if (!key) {
        return;
      }

      const existing = byMint.get(key);
      const launchedAt = typeof token.launchedAt === "number" ? token.launchedAt : undefined;
      const existingLaunch = typeof existing?.launchedAt === "number" ? existing.launchedAt : undefined;
      if (!existing || (launchedAt ?? 0) > (existingLaunch ?? 0)) {
        byMint.set(key, token);
      }
    });

    return Array.from(byMint.values()).sort((a, b) => {
      const aLaunch = typeof a.launchedAt === "number" ? a.launchedAt : 0;
      const bLaunch = typeof b.launchedAt === "number" ? b.launchedAt : 0;
      return bLaunch - aLaunch;
    });
  }, [firebaseTokens]);

  const filteredFirebaseTokens = useMemo(() => {
    const normalizedQuery = creatorQuery.trim().toLowerCase();

    const filtered = normalizedQuery
      ? firebaseCatalog.filter((token) => {
        const creator = getCreatorAddress(token)?.toLowerCase() ?? "";
        return creator.includes(normalizedQuery);
      })
      : firebaseCatalog;

    if (slabSort === "top") {
      return [...filtered].sort((a, b) => getTopScore(b) - getTopScore(a));
    }

    // Default to newest (already sorted desc by launchedAt in firebaseCatalog)
    return filtered;
  }, [creatorQuery, slabSort, firebaseCatalog]);

  const handleVerifiedToggle = (checked: boolean) => {
    setFilters((prev) => ({ ...prev, verifiedOnly: checked }));
  };

  const launchpadOptions = useMemo(() => {
    const unique = new Map<string, string>();
    topTrendingTokens.forEach((token) => {
      if (typeof token.launchpad === "string" && token.launchpad.trim().length) {
        const value = token.launchpad.trim();
        unique.set(value.toLowerCase(), value);
      }
      if (typeof token.metaLaunchpad === "string" && token.metaLaunchpad.trim().length) {
        const value = token.metaLaunchpad.trim();
        unique.set(value.toLowerCase(), value);
      }
    });
    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }, [topTrendingTokens]);

  useEffect(() => {
    if (
      filters.launchpad !== "any" &&
      filters.launchpad !== "with-launchpad" &&
      !launchpadOptions.some((option) => option.toLowerCase() === filters.launchpad.toLowerCase())
    ) {
      setFilters((prev) => ({ ...prev, launchpad: "any" }));
    }
  }, [filters.launchpad, launchpadOptions]);

  const handleLaunchpadChange = (value: string) => {
    setFilters((prev) => ({ ...prev, launchpad: value as LaunchpadFilter }));
  };

  const communityTagAvailability = useMemo(() => {
    let communityAssist = false;
    let birdeyeTrending = false;

    topTrendingTokens.forEach((token) => {
      const rawTags = Array.isArray(token.tags) ? token.tags : [];
      const normalizedTags = rawTags
        .map((tag) => (typeof tag === "string" ? tag.toLowerCase() : null))
        .filter((tag): tag is string => Boolean(tag));
      if (normalizedTags.includes("community-assist")) {
        communityAssist = true;
      }
      if (normalizedTags.includes("birdeye-trending")) {
        birdeyeTrending = true;
      }
    });

    return { communityAssist, birdeyeTrending };
  }, [topTrendingTokens]);

  useEffect(() => {
    if (filters.communityTag === "community-assist" && !communityTagAvailability.communityAssist) {
      setFilters((prev) => ({ ...prev, communityTag: "any" }));
    } else if (filters.communityTag === "birdeye-trending" && !communityTagAvailability.birdeyeTrending) {
      setFilters((prev) => ({ ...prev, communityTag: "any" }));
    }
  }, [filters.communityTag, communityTagAvailability]);

  const handleCommunityTagChange = (value: string) => {
    setFilters((prev) => ({ ...prev, communityTag: value as CommunityTagFilter }));
  };

  const handleDisplayLimitChange = (value: string) => {
    setDisplayLimit(value as DisplayLimitValue);
  };

  const filteredTokens = useMemo(() => {
    return topTrendingTokens.filter((token) => {
      const rawTags = Array.isArray(token.tags) ? token.tags : [];
      const normalizedTags = rawTags
        .map((tag) => (typeof tag === "string" ? tag.toLowerCase() : null))
        .filter((tag): tag is string => Boolean(tag));

      if (filters.verifiedOnly) {
        const hasVerifiedTag = normalizedTags.some((tag) => tag.includes("verified"));
        const isVerifiedToken = Boolean(token.isVerified || hasVerifiedTag);
        if (!isVerifiedToken) {
          return false;
        }
      }

      if (filters.launchpad !== "any") {
        const launchpadValue = filters.launchpad;
        const launchpadMatchesMetadata = (value: unknown) =>
          typeof value === "string" && value.toLowerCase() === launchpadValue.toLowerCase();

        if (launchpadValue === "with-launchpad") {
          const hasLaunchpadMetadata =
            typeof token.launchpad === "string" || typeof token.metaLaunchpad === "string";
          if (!hasLaunchpadMetadata) {
            return false;
          }
        } else if (!launchpadMatchesMetadata(token.launchpad) && !launchpadMatchesMetadata(token.metaLaunchpad)) {
          return false;
        }
      }

      if (filters.communityTag !== "any" && !normalizedTags.includes(filters.communityTag)) {
        return false;
      }

      return true;
    });
  }, [filters, topTrendingTokens]);

  const displayedTokens = useMemo(() => {
    if (displayLimit === "all") {
      return filteredTokens;
    }
    const limit = Number(displayLimit);
    return filteredTokens.slice(0, limit);
  }, [displayLimit, filteredTokens]);

  const totalCount = topTrendingTokens.length;
  const filteredCount = filteredTokens.length;
  const displayedCount = displayedTokens.length;

  return (
    <div className="space-y-6 px-4 py-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold mb-2">Discover Markets</h1>
      </motion.div>

      <motion.section
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">SLAB Creator Tokens</h2>
          <p className="text-sm text-muted-foreground">
            Tokens made by creators across the SLAB ecosystem.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            value={creatorQuery}
            onChange={(event) => setCreatorQuery(event.target.value)}
            placeholder="Search creator address"
            className="w-full md:max-w-sm"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={slabSort === "top" ? "default" : "outline"}
              onClick={() => setSlabSort("top")}
            >
              Sort by top SLAB tokens
            </Button>
            <Button
              type="button"
              variant={slabSort === "newest" ? "default" : "outline"}
              onClick={() => setSlabSort("newest")}
            >
              Sort by newest SLAB tokens
            </Button>
          </div>
        </div>

        {firebaseError && (
          <span className="text-xs text-destructive">Error: {firebaseError}</span>
        )}

        {firebaseLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <LoadingSkeleton className="h-40 w-full" count={6} />
          </div>
        ) : filteredFirebaseTokens.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredFirebaseTokens.map((token) => (
              <FirebaseTokenCard key={(typeof token.mintAddress === "string" ? token.mintAddress : token.id) ?? token.id} token={token} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-md border border-dashed border-border/60 py-12 text-sm text-muted-foreground">
            No creator tokens found.
          </div>
        )}
      </motion.section>

      <motion.section
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Trending tokens across Solana Eco</h2>
            {topTrendingError && !topTrendingError.includes('429') && !topTrendingError.includes('rate limit') && (
              <span className="text-xs text-destructive">Error: {topTrendingError}</span>
            )}
          </div>
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <Label
              htmlFor="discover-limit"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Show
            </Label>
            <Select value={displayLimit} onValueChange={handleDisplayLimitChange}>
              <SelectTrigger
                id="discover-limit"
                className="w-28 border border-border/60 bg-card/60 text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="25">Top 25</SelectItem>
                <SelectItem value="50">Top 50</SelectItem>
                <SelectItem value="100">Top 100</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
              <div className="flex flex-col text-left">
                <Label
                  htmlFor="discover-filter-verified"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Verified
                </Label>
                <span className="text-xs text-muted-foreground">Only show tokens with verification signals</span>
              </div>
              <Switch
                id="discover-filter-verified"
                checked={filters.verifiedOnly}
                onCheckedChange={handleVerifiedToggle}
              />
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-3">
              <div className="flex flex-col text-left">
                <Label
                  htmlFor="discover-filter-launchpad"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Launchpads
                </Label>
                <span className="text-xs text-muted-foreground">
                  Pick a specific launchpad or view tokens with launchpad data
                </span>
              </div>
              <Select value={filters.launchpad} onValueChange={handleLaunchpadChange}>
                <SelectTrigger
                  id="discover-filter-launchpad"
                  className="w-full border border-border/60 bg-card/70 text-sm"
                >
                  <SelectValue placeholder="All launchpads" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">All launchpads</SelectItem>
                  <SelectItem value="with-launchpad">Any launchpad metadata</SelectItem>
                  {launchpadOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {formatLaunchpadLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-3">
              <div className="flex flex-col text-left">
                <Label
                  htmlFor="discover-filter-community"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Community Signals
                </Label>
                <span className="text-xs text-muted-foreground">
                  Filter by community-assist or Birdeye-trending tags
                </span>
              </div>
              <Select value={filters.communityTag} onValueChange={handleCommunityTagChange}>
                <SelectTrigger
                  id="discover-filter-community"
                  className="w-full border border-border/60 bg-card/70 text-sm"
                >
                  <SelectValue placeholder="All signals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">All community signals</SelectItem>
                  <SelectItem value="community-assist" disabled={!communityTagAvailability.communityAssist}>
                    {COMMUNITY_TAG_LABELS["community-assist"]}
                  </SelectItem>
                  <SelectItem value="birdeye-trending" disabled={!communityTagAvailability.birdeyeTrending}>
                    {COMMUNITY_TAG_LABELS["birdeye-trending"]}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {topTrendingLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <LoadingSkeleton className="h-40 w-full" count={6} />
          </div>
        ) : filteredTokens.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayedTokens.map((token) => (
              <TrendingTokenCard key={token.id} token={token} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-md border border-dashed border-border/60 py-12 text-sm text-muted-foreground">
            No tokens match the current filters.
          </div>
        )}
      </motion.section>
    </div>
  );
}

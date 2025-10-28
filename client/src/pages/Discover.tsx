import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { TrendingTokenCard } from "@/components/shared/TrendingTokenCard";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  fetchJupiterTopTrendingTokens,
  subscribeToJupiterTopTrendingTokens,
  type JupiterTopTrendingToken,
} from "@/lib/api";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type LaunchpadFilter = "any" | "with-launchpad" | string;
type CommunityTagFilter = "any" | "community-assist" | "birdeye-trending";

type DiscoverFilters = {
  verifiedOnly: boolean;
  launchpad: LaunchpadFilter;
  communityTag: CommunityTagFilter;
};

type DisplayLimitValue = "10" | "25" | "50" | "100" | "all";

const COMMUNITY_TAG_LABELS: Record<Exclude<CommunityTagFilter, "any">, string> = {
  "community-assist": "Community Assist",
  "birdeye-trending": "Birdeye Trending",
};

const formatLaunchpadLabel = (value: string) =>
  value
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function Discover() {
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

  const handleVerifiedToggle = (checked: boolean) => {
    setFilters((prev) => ({ ...prev, verifiedOnly: checked }));
  };

  const launchpadOptions = useMemo(() => {
    const unique = new Map<string, string>();
    topTrendingTokens.forEach((token) => {
      if (token.launchpad) {
        unique.set(token.launchpad.toLowerCase(), token.launchpad);
      }
      if (token.metaLaunchpad) {
        unique.set(token.metaLaunchpad.toLowerCase(), token.metaLaunchpad);
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
      const normalizedTags = (token.tags ?? []).map((tag) => tag.toLowerCase());
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
      const normalizedTags = (token.tags ?? []).map((tag) => tag.toLowerCase());

      if (filters.verifiedOnly) {
        const hasVerifiedTag = normalizedTags.some((tag) => tag.includes("verified"));
        const isVerifiedToken = Boolean(token.isVerified || hasVerifiedTag);
        if (!isVerifiedToken) {
          return false;
        }
      }

      if (filters.launchpad !== "any") {
        const launchpadValue = filters.launchpad;
        const launchpadMatchesMetadata = (value: string | undefined) =>
          typeof value === "string" && value.toLowerCase() === launchpadValue.toLowerCase();

        if (launchpadValue === "with-launchpad") {
          const hasLaunchpadMetadata = Boolean(token.launchpad || token.metaLaunchpad);
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
        <p className="text-muted-foreground">
          Top trending tokens
        </p>
      </motion.div>

      <motion.section
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Remove timestamp and count display for cleaner UI */}
          {/* Only show real errors, not rate limit messages */}
          {topTrendingError && !topTrendingError.includes('429') && !topTrendingError.includes('rate limit') && (
            <span className="text-xs text-destructive">Error: {topTrendingError}</span>
          )}
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

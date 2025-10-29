import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { JupiterTopTrendingToken } from "@/lib/api";
import clsx from "clsx";
import { Activity, Droplet, TrendingDown, TrendingUp, Users } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useCallback } from "react";
import { useLocation } from "wouter";
import { TokenAvatar } from "./TokenAvatar";

interface TrendingTokenCardProps {
  token: JupiterTopTrendingToken;
  className?: string;
}

const formatNumber = (value: number | undefined, options: { currency?: boolean; decimals?: number } = {}) => {
  const { currency = false, decimals = 2 } = options;
  if (value === undefined || Number.isNaN(value)) {
    return currency ? "$0.00" : "0";
  }

  if (currency) {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(decimals)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(decimals)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(decimals)}K`;
    return `$${value.toFixed(decimals)}`;
  }

  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(decimals)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(decimals)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(decimals)}K`;
  return value.toFixed(decimals);
};

export function TrendingTokenCard({ token, className = "" }: TrendingTokenCardProps) {
  const priceChange5m = token.stats5m?.priceChange ?? 0;
  const isPriceUp = priceChange5m >= 0;
  const [, setLocation] = useLocation();

  const navigateToMarket = useCallback(() => {
    if (!token || !token.id) return;
    setLocation(`/market/${encodeURIComponent(token.id)}`);
  }, [setLocation, token]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigateToMarket();
    }
  }, [navigateToMarket]);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={navigateToMarket}
      onKeyDown={handleKeyDown}
      className={clsx("p-4 bg-card border border-card-border hover-elevate cursor-pointer", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TokenAvatar
            symbol={token.symbol}
            name={token.name}
            iconUrl={token.icon}
            size={40}
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">{token.symbol}</h3>
              {token.isVerified && (
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{token.name}</p>
          </div>
        </div>
        {token.tags && token.tags.length > 0 && (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {token.tags[0]}
          </Badge>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <div className="text-xl font-mono font-semibold text-foreground" data-numeric="true">
            {formatNumber(token.usdPrice ?? 0, { currency: true, decimals: 4 })}
          </div>
          <div
            className={clsx(
              "flex items-center gap-1 text-xs font-semibold",
              isPriceUp ? "text-success" : "text-destructive",
            )}
          >
            {isPriceUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPriceUp ? "+" : ""}
            {priceChange5m.toFixed(2)}%
            <span className="text-muted-foreground ml-1">(5m)</span>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{token.launchpad || token.metaLaunchpad || "Unknown Launchpad"}</div>
          <div className="font-mono">{token.holderCount ? `${token.holderCount.toLocaleString()} holders` : "N/A"}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        <div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1 uppercase tracking-wide">
            <Droplet className="w-3 h-3" />
            Liquidity
          </div>
          <div className="text-xs font-mono font-semibold text-foreground" data-numeric="true">
            {formatNumber(token.liquidity ?? 0, { currency: true })}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1 uppercase tracking-wide">
            <Activity className="w-3 h-3" />
            Volume 5m
          </div>
          <div className="text-xs font-mono font-semibold text-foreground" data-numeric="true">
            {formatNumber(token.stats5m?.buyVolume ?? 0, { currency: true })}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1 uppercase tracking-wide">
            <Users className="w-3 h-3" />
            Traders
          </div>
          <div className="text-xs font-mono font-semibold text-foreground" data-numeric="true">
            {(token.stats5m?.numTraders ?? 0).toLocaleString()}
          </div>
        </div>
      </div>
    </Card>
  );
}

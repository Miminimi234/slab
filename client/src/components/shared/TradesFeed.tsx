import { Trade } from "@shared/schema";
import { AnimatePresence, motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";

interface TradesFeedProps {
  trades: Trade[];
  className?: string;
}

export function TradesFeed({ trades, className = "" }: TradesFeedProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  };
  const isGmgn = (t?: Trade) => Boolean(t && (t as any).gmgnRaw !== undefined);

  const firstIsGmgn = trades && trades.length > 0 && isGmgn(trades[0]);

  return (
    <div className={`${className}`}>
      {/* Header: dynamic columns for GMGN payloads */}
      <div
        className={
          firstIsGmgn
            ? "grid grid-cols-5 gap-2 px-3 py-2 text-xs text-foreground uppercase tracking-wide border-b border-border"
            : "grid grid-cols-4 gap-2 px-3 py-2 text-xs text-foreground uppercase tracking-wide border-b border-border"
        }
      >
        <div className="flex items-center gap-2">
          <span>Time</span>
          <span className="text-[10px] text-muted-foreground lowercase">event</span>
        </div>
        <div className="text-right">Price (USD)</div>
        {firstIsGmgn ? (
          <>
            <div className="text-right">Amount</div>
            <div className="text-right">Quote</div>
            <div className="text-right">Maker</div>
          </>
        ) : (
          <>
            <div className="text-right">Size</div>
            <div className="text-right">Side</div>
          </>
        )}
      </div>

      <div className="h-full overflow-y-auto">
        <AnimatePresence initial={false}>
          {trades.map((trade, index) => {
            const gm = (trade as any).gmgnRaw;
            return (
              <motion.div
                key={trade.id}
                className={gm ? "grid grid-cols-5 gap-2 px-3 py-2 hover-elevate border-b border-border/50 last:border-0" : "grid grid-cols-4 gap-2 px-3 py-2 hover-elevate border-b border-border/50 last:border-0"}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.15 }}
                data-testid={`trade-${index}`}
              >
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground font-mono" data-numeric="true">
                    {formatTime(trade.timestamp)}
                  </div>
                  <div className={`text-[10px] font-mono uppercase ${((gm && gm.event) || trade.side) === "buy" ? "text-success" : "text-destructive"}`}>
                    {(((gm && gm.event) || trade.side) ?? "").toString().toUpperCase()}
                  </div>
                </div>

                <div className={`text-xs font-mono text-right ${trade.side === "buy" ? "text-success" : "text-destructive"}`} data-numeric="true">
                  {trade.price ? Number(trade.price).toFixed(6) : "0.000000"}
                </div>

                {gm ? (
                  <>
                    <div className="text-xs font-mono text-right text-foreground" data-numeric="true">{Number(gm.base_amount ?? trade.size ?? 0).toLocaleString()}</div>
                    <div className="text-xs font-mono text-right text-foreground" data-numeric="true">{Number(gm.quote_amount ?? 0).toLocaleString()}</div>
                    <div className="text-xs font-mono text-right text-foreground">
                      {gm?.maker ? (
                        <a
                          href={`https://solscan.io/account/${gm.maker}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={gm.maker}
                          className="text-xs font-mono text-right text-foreground hover:underline"
                        >
                          {`${(gm.maker as string).slice(0, 6)}…${(gm.maker as string).slice(-4)}`}
                        </a>
                      ) : (
                        <span title={gm?.maker ?? ""}>{(gm?.maker || "").slice(0, 6) + (gm?.maker ? `…${(gm?.maker as string).slice(-4)}` : "")}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-mono text-right text-foreground" data-numeric="true">
                      {trade.size ? Number(trade.size).toFixed(2) : "0.00"}
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      {trade.side === "buy" ? (
                        <TrendingUp className="w-3 h-3 text-success" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-destructive" />
                      )}
                      <span className={`text-xs font-medium ${trade.side === "buy" ? "text-success" : "text-destructive"}`}>
                        {trade.side?.toUpperCase?.() ?? "-"}
                      </span>
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

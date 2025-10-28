import { Trade } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TradesFeedProps {
  trades: Trade[];
  className?: string;
}

export function TradesFeed({ trades, className = "" }: TradesFeedProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  };

  return (
    <div className={`${className}`}>
      <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs text-foreground uppercase tracking-wide border-b border-border">
        <div>Time</div>
        <div className="text-right">Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Side</div>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {trades.map((trade, index) => (
            <motion.div
              key={trade.id}
              className="grid grid-cols-4 gap-2 px-3 py-2 hover-elevate border-b border-border/50 last:border-0"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
              data-testid={`trade-${index}`}
            >
              <div className="text-xs text-muted-foreground font-mono" data-numeric="true">
                {formatTime(trade.timestamp)}
              </div>
              <div className={`text-xs font-mono text-right ${trade.side === "buy" ? "text-success" : "text-destructive"}`} data-numeric="true">
                {trade.price.toFixed(4)}
              </div>
              <div className="text-xs font-mono text-right text-foreground" data-numeric="true">
                {trade.size.toFixed(2)}
              </div>
              <div className="flex items-center justify-end gap-1">
                {trade.side === "buy" ? (
                  <TrendingUp className="w-3 h-3 text-success" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-destructive" />
                )}
                <span className={`text-xs font-medium ${trade.side === "buy" ? "text-success" : "text-destructive"}`}>
                  {trade.side.toUpperCase()}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

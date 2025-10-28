import { OrderBookEntry } from "@shared/schema";
import { motion } from "framer-motion";

interface OrderBookProps {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  className?: string;
}

export function OrderBook({ bids, asks, className = "" }: OrderBookProps) {
  const formatPrice = (price: number) => price.toFixed(4);
  const formatSize = (size: number) => size.toFixed(2);

  const renderRow = (entry: OrderBookEntry, type: "bid" | "ask", index: number) => {
    const percentage = (entry.size / entry.total) * 100;
    const bgColor = type === "bid" ? "bg-success/10" : "bg-destructive/10";
    
    return (
      <motion.div
        key={`${type}-${index}`}
        className="relative grid grid-cols-3 gap-2 px-3 py-1 hover-elevate cursor-pointer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.02 }}
        data-testid={`orderbook-${type}-${index}`}
      >
        <div
          className={`absolute inset-y-0 ${type === "bid" ? "left-0" : "right-0"} ${bgColor}`}
          style={{ width: `${percentage}%` }}
        />
        <div className={`relative font-mono text-sm ${type === "bid" ? "text-success" : "text-destructive"}`} data-numeric="true">
          {formatPrice(entry.price)}
        </div>
        <div className="relative font-mono text-sm text-right text-foreground" data-numeric="true">
          {formatSize(entry.size)}
        </div>
        <div className="relative font-mono text-sm text-right text-foreground" data-numeric="true">
          {formatSize(entry.total)}
        </div>
      </motion.div>
    );
  };

  return (
    <div className={`${className}`}>
      <div className="grid grid-cols-3 gap-2 px-3 py-2 text-xs text-foreground uppercase tracking-wide border-b border-border">
        <div>Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Total</div>
      </div>

      {/* Asks (reversed to show lowest at bottom) */}
      <div className="flex flex-col-reverse">
        {asks.slice(0, 8).map((ask, i) => renderRow(ask, "ask", i))}
      </div>

      {/* Spread */}
      <div className="px-3 py-2 bg-muted/20 border-y border-border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Spread</span>
          <span className="font-mono font-medium text-foreground" data-numeric="true">
            {asks[0] && bids[0] ? (asks[0].price - bids[0].price).toFixed(4) : "—"}
          </span>
        </div>
      </div>

      {/* Bids */}
      <div>
        {bids.slice(0, 8).map((bid, i) => renderRow(bid, "bid", i))}
      </div>
    </div>
  );
}

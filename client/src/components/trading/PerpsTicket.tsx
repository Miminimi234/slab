import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface PerpsTicketProps {
  symbol: string;
  currentPrice: number;
  maxLeverage: number;
  takerFeeBps: number;
  isWarmup?: boolean;
  shortLevCap?: number;
  className?: string;
}

export function PerpsTicket({ 
  symbol, 
  currentPrice, 
  maxLeverage,
  takerFeeBps,
  isWarmup = false,
  shortLevCap = 1,
  className = "" 
}: PerpsTicketProps) {
  const [side, setSide] = useState<"long" | "short">("long");
  const [size, setSize] = useState("");
  const [leverage, setLeverage] = useState([5]);

  const effectiveMaxLeverage = isWarmup && side === "short" ? shortLevCap : maxLeverage;

  useEffect(() => {
    if (leverage[0] > effectiveMaxLeverage) {
      setLeverage([effectiveMaxLeverage]);
    }
  }, [side, effectiveMaxLeverage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      if (e.key === "ArrowLeft") {
        setLeverage([Math.max(1, leverage[0] - 1)]);
      } else if (e.key === "ArrowRight") {
        setLeverage([Math.min(effectiveMaxLeverage, leverage[0] + 1)]);
      } else if (e.key === "+" || e.key === "=") {
        setSize(String(parseFloat(size || "0") + 1));
      } else if (e.key === "-" || e.key === "_") {
        setSize(String(Math.max(0, parseFloat(size || "0") - 1)));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [size, leverage, effectiveMaxLeverage]);

  const positionValue = parseFloat(size || "0") * currentPrice;
  const margin = positionValue / leverage[0];
  const fee = positionValue * (takerFeeBps / 10000);

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Trade</h3>
        {isWarmup && (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
            Warmup Mode
          </Badge>
        )}
      </div>

      <Tabs value={side} onValueChange={(v) => setSide(v as "long" | "short")} className="mb-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger 
            value="long" 
            className="data-[state=active]:bg-success/20 data-[state=active]:text-success"
            data-testid="tab-long"
          >
            Long
          </TabsTrigger>
          <TabsTrigger 
            value="short" 
            className="data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive"
            disabled={isWarmup}
            data-testid="tab-short"
          >
            Short {isWarmup && "🔒"}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isWarmup && side === "short" && (
        <div className="p-3 mb-4 bg-warning/10 border border-warning/30 rounded-md text-xs text-warning">
          Shorts unlock after warmup & health checks complete
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="size-input" className="text-xs text-muted-foreground mb-2">
            Size ({symbol})
          </Label>
          <Input
            id="size-input"
            type="number"
            placeholder="0.00"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="font-mono text-lg h-12"
            data-testid="input-size"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Keyboard: +/− to adjust size
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground">
              Leverage
            </Label>
            <span className="text-sm font-bold font-mono text-primary" data-numeric="true">
              {leverage[0]}x
            </span>
          </div>
          <Slider
            value={leverage}
            onValueChange={setLeverage}
            max={effectiveMaxLeverage}
            min={1}
            step={1}
            className="mb-1"
            data-testid="slider-leverage"
          />
          <p className="text-xs text-muted-foreground">
            Keyboard: ←/→ to adjust leverage
          </p>
        </div>

        <div className="space-y-2 text-sm p-3 bg-muted/10 rounded-md">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Entry Price</span>
            <span className="font-mono font-medium" data-numeric="true">${currentPrice.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Position Value</span>
            <span className="font-mono font-medium" data-numeric="true">${positionValue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Margin Required</span>
            <span className="font-mono font-medium" data-numeric="true">${margin.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Est. Fee ({takerFeeBps}bps)</span>
            <span className="font-mono font-medium" data-numeric="true">${fee.toFixed(4)}</span>
          </div>
        </div>

        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            className={`w-full h-11 font-semibold ${
              side === "long" 
                ? "bg-success hover:bg-success/90 text-black" 
                : "bg-destructive hover:bg-destructive/90"
            }`}
            disabled={!size || parseFloat(size) <= 0}
            data-testid="button-trade-submit"
          >
            Open {side === "long" ? "Long" : "Short"}
          </Button>
        </motion.div>

        <div className="text-xs text-center text-muted-foreground space-y-1">
          <p>Reserve → Cap TTL → Commit (mock)</p>
          <p>Press Enter to submit</p>
        </div>
      </div>
    </Card>
  );
}

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";

interface BondingPanelProps {
  symbol: string;
  currentPrice: number;
  creatorTax: number;
  protocolTax: number;
  seedVaultTax: number;
  className?: string;
}

export function BondingPanel({ 
  symbol, 
  currentPrice, 
  creatorTax, 
  protocolTax, 
  seedVaultTax,
  className = "" 
}: BondingPanelProps) {
  const [amount, setAmount] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");

  const totalTax = creatorTax + protocolTax + seedVaultTax;
  const estimatedOutput = amount ? parseFloat(amount) * currentPrice * (1 - totalTax / 100) : 0;

  return (
    <Card className={`p-4 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Bonding Curve</h3>

      <Tabs value={side} onValueChange={(v) => setSide(v as "buy" | "sell")} className="mb-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="buy" className="data-[state=active]:bg-success/20 data-[state=active]:text-success" data-testid="tab-buy">
            Buy
          </TabsTrigger>
          <TabsTrigger value="sell" className="data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive" data-testid="tab-sell">
            Sell
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        <div>
          <Label htmlFor="bonding-amount" className="text-xs text-muted-foreground mb-2">
            Amount ({symbol})
          </Label>
          <Input
            id="bonding-amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="font-mono text-lg h-12"
            data-testid="input-bonding-amount"
          />
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Price</span>
            <span className="font-mono font-medium" data-numeric="true">${currentPrice.toFixed(4)}</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Total Tax</span>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="text-xs space-y-1">
                    <div>Creator: {creatorTax}%</div>
                    <div>Protocol: {protocolTax}%</div>
                    <div>Seed Vault: {seedVaultTax}%</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="font-mono font-medium" data-numeric="true">{totalTax.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="font-medium">You receive</span>
            <span className="font-mono font-bold text-primary" data-numeric="true">
              ${estimatedOutput.toFixed(2)}
            </span>
          </div>
        </div>

        <motion.div whileTap={{ scale: 0.98 }}>
          <Button
            className={`w-full h-11 font-semibold ${
              side === "buy" 
                ? "bg-success hover:bg-success/90 text-black" 
                : "bg-destructive hover:bg-destructive/90"
            }`}
            disabled={!amount || parseFloat(amount) <= 0}
            data-testid="button-bonding-submit"
          >
            {side === "buy" ? "Buy" : "Sell"} {symbol}
          </Button>
        </motion.div>

        <p className="text-xs text-muted-foreground text-center">
          Slippage may occur on larger trades
        </p>
      </div>
    </Card>
  );
}

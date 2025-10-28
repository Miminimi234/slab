import { KPIStat } from "@/components/shared/KPIStat";
import { MarketTile } from "@/components/shared/MarketTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Market } from "@shared/schema";
import { motion } from "framer-motion";
import { Copy, DollarSign, ExternalLink, Rocket, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function Creator() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [referralCode] = useState("SLAB-CREATOR-XYZ123");
  const hasPromptedAuthRef = useRef(false);

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

  // Show authentication required message
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
          <Button
            onClick={triggerLoginModal}
            className="w-full"
            data-testid="button-login-creator"
          >
            Connect Wallet
          </Button>
        </Card>
      </div>
    );
  }

  const mockStats = {
    totalEarnings: 12543.67,
    earningsChange: 23.45,
    totalVolume: 8750000,
    volumeChange: 18.23,
    marketsCreated: 5,
    marketsChange: 25,
    referralEarnings: 1234.56,
  };

  const mockPayouts = [
    { date: "2025-10-20", amount: 543.21, market: "BONK", type: "Creator Fee" },
    { date: "2025-10-19", amount: 287.43, market: "WIF", type: "Creator Fee" },
    { date: "2025-10-18", amount: 156.78, market: "BONK", type: "Referral" },
    { date: "2025-10-17", amount: 892.34, market: "MYRO", type: "Creator Fee" },
  ];

  const mockMarkets: Market[] = Array.from({ length: 5 }, (_, i) => ({
    id: `market-${i}`,
    symbol: ["BONK", "WIF", "MYRO", "POPCAT", "SILLY"][i],
    name: ["Bonk Inu", "Dogwifhat", "Myro", "Popcat", "Silly Dragon"][i],
    status: (["warmup", "perps", "bonding", "perps", "warmup"] as const)[i],
    createdAt: Date.now() - i * 86400000,
    creatorAddress: "creator123",
    bondingConfig: {
      curveType: "linear",
      startPrice: 0.001,
      creatorTax: 2,
      protocolTax: 1,
      seedVaultTax: 2,
    },
    graduationTriggers: {
      minLiquidity: 1000000,
      minHolders: 1000,
      minAgeHours: 72,
    },
    perpsConfig: {
      tickSize: 0.0001,
      lotSize: 1,
      maxLeverage: 20,
      initialMargin: 5,
      maintenanceMargin: 2.5,
      priceBandBps: 1000,
      fundingK: 0.0001,
      warmupHours: 24,
      warmupShortLevCap: 1,
    },
    fees: {
      takerBps: 10,
      makerBps: -2,
      creatorFeePct: 30,
      referrerFeePct: 10,
    },
    metrics: {
      currentPrice: 0.00001234 * (1 + i * 0.2),
      priceChange24h: -10 + Math.random() * 40,
      volume24h: 500000 + i * 300000,
      openInterest: i % 2 === 0 ? 250000 + i * 100000 : 0,
      liquidity: 800000 + i * 150000,
      holders: 1000 + i * 500,
      ageHours: 24 + i * 12,
      graduationProgress: Math.min(100, 40 + i * 15),
    },
  }));

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast({
      title: "Copied!",
      description: "Referral code copied to clipboard",
      duration: 2000,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-3xl font-bold mb-2">Creator Dashboard</h1>
            <p className="text-muted-foreground">
              Track your earnings, markets, and referrals
            </p>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card className="p-6 border-card-border bg-card">
                <KPIStat
                  icon={DollarSign}
                  label="Total Earnings"
                  value={`$${mockStats.totalEarnings.toLocaleString()}`}
                  change={mockStats.earningsChange}
                  trend="up"
                />
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="p-6 border-card-border bg-card">
                <KPIStat
                  icon={TrendingUp}
                  label="Total Volume"
                  value={`$${(mockStats.totalVolume / 1e6).toFixed(2)}M`}
                  change={mockStats.volumeChange}
                  trend="up"
                />
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Card className="p-6 border-card-border bg-card">
                <KPIStat
                  icon={Rocket}
                  label="Markets Created"
                  value={mockStats.marketsCreated}
                  change={mockStats.marketsChange}
                  trend="up"
                />
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <Card className="p-6 border-card-border bg-card">
                <KPIStat
                  icon={DollarSign}
                  label="Referral Earnings"
                  value={`$${mockStats.referralEarnings.toLocaleString()}`}
                  trend="up"
                />
              </Card>
            </motion.div>
          </div>

          {/* Referral Code */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <Card className="p-6 border-card-border bg-card">
              <h3 className="text-lg font-semibold mb-4">Referral Code</h3>
              <div className="flex gap-3">
                <Input
                  value={referralCode}
                  readOnly
                  className="font-mono bg-background/50"
                  data-testid="input-referral-code"
                />
                <Button
                  variant="outline"
                  onClick={copyReferralCode}
                  className="border-primary/30 hover:bg-primary/10"
                  data-testid="button-copy-referral"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Share your code to earn {mockMarkets[0]?.fees.referrerFeePct || 10}% of trading fees from referred users
              </p>
            </Card>
          </motion.div>

          {/* Launched Markets */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Your Markets</h2>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {mockMarkets.length} Active
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockMarkets.map((market, index) => (
                <motion.div
                  key={market.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <MarketTile market={market} />
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Payout History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.7 }}
          >
            <h2 className="text-xl font-semibold mb-4">Recent Payouts</h2>
            <Card className="border-card-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Market</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                      <th className="text-right p-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockPayouts.map((payout, index) => (
                      <tr
                        key={index}
                        className="border-b border-border/50 last:border-0 hover-elevate"
                        data-testid={`row-payout-${index}`}
                      >
                        <td className="p-3 text-sm text-muted-foreground">{payout.date}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="font-mono">{payout.market}</Badge>
                        </td>
                        <td className="p-3 text-sm">{payout.type}</td>
                        <td className="p-3 text-right font-mono font-semibold text-success" data-numeric="true">
                          +${payout.amount.toFixed(2)}
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm" data-testid={`button-view-tx-${index}`}>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

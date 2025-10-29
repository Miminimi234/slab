import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { TokenAvatar } from "@/components/shared/TokenAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchJupiterTokenByMint, type JupiterToken } from "@/lib/api";
import { connection } from "@/percolator/connection";
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey, type ParsedAccountData } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { Copy, Lock, RefreshCw } from "lucide-react";
import { useMemo } from "react";

const WRAPPED_SOL_MINT = NATIVE_MINT.toBase58();
const SOL_FALLBACK_ICON = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png";

interface WalletTokenBalance {
  mint: string;
  symbol: string;
  name: string;
  icon?: string;
  uiAmount: number;
  decimals: number;
  usdPrice?: number;
  valueUsd?: number;
  isNative?: boolean;
}

const formatCurrency = (
  value: number | undefined,
  { decimals, compact = true }: { decimals?: number; compact?: boolean } = {},
): string => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  const precision = decimals ?? (value >= 1 ? 2 : 4);

  if (!compact) {
    return `$${value.toFixed(precision)}`;
  }

  if (Math.abs(value) >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(precision)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(precision)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(precision)}K`;
  }
  return `$${value.toFixed(precision)}`;
};

const formatTokenAmount = (amount: number, decimals = 4): string => {
  if (!Number.isFinite(amount)) {
    return "0";
  }
  if (Math.abs(amount) >= 1_000_000) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (Math.abs(amount) >= 1) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return amount.toFixed(decimals);
};

const shortenAddress = (address: string | undefined): string => {
  if (!address) {
    return "—";
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const aggregateTokenAccounts = (accounts: Array<{ account: { data: ParsedAccountData } }>) => {
  const aggregated = new Map<string, { uiAmount: number; decimals: number }>();

  accounts.forEach(({ account }) => {
    const data = account.data;
    if (!data || data.program !== "spl-token" || !data.parsed) {
      return;
    }

    const parsed = data.parsed as Record<string, any>;
    const info = parsed?.info;
    const mint: string | undefined = info?.mint;
    const tokenAmount = info?.tokenAmount;
    const uiAmount = Number(tokenAmount?.uiAmount);
    const decimals = Number(tokenAmount?.decimals);

    if (!mint || !Number.isFinite(uiAmount) || uiAmount <= 0 || !Number.isFinite(decimals)) {
      return;
    }

    const existing = aggregated.get(mint);
    if (existing) {
      existing.uiAmount += uiAmount;
    } else {
      aggregated.set(mint, { uiAmount, decimals });
    }
  });

  return aggregated;
};

const loadWalletTokenBalances = async (walletAddress: string): Promise<WalletTokenBalance[]> => {
  const owner = new PublicKey(walletAddress);

  const [solLamports, tokenAccounts] = await Promise.all([
    connection.getBalance(owner, "confirmed"),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }, "confirmed"),
  ]);

  const balances: WalletTokenBalance[] = [];
  const solUiAmount = solLamports / LAMPORTS_PER_SOL;

  balances.push({
    mint: WRAPPED_SOL_MINT,
    symbol: "SOL",
    name: "Solana",
    icon: SOL_FALLBACK_ICON,
    uiAmount: solUiAmount,
    decimals: 9,
    isNative: true,
  });

  const aggregatedTokens = aggregateTokenAccounts(tokenAccounts.value as Array<{ account: { data: ParsedAccountData } }>);

  aggregatedTokens.forEach((value, mint) => {
    balances.push({
      mint,
      symbol: mint.slice(0, 4).toUpperCase(),
      name: mint,
      uiAmount: value.uiAmount,
      decimals: value.decimals,
    });
  });

  const metadataMints = Array.from(aggregatedTokens.keys());
  const metadataResults = await Promise.all(
    metadataMints.map(async (mint) => {
      try {
        const token = await fetchJupiterTokenByMint(mint);
        return { mint, token };
      } catch (error) {
        console.warn("Failed to fetch Jupiter metadata for", mint, error);
        return { mint, token: null as JupiterToken | null };
      }
    }),
  );

  const wrappedSolMeta = await fetchJupiterTokenByMint(WRAPPED_SOL_MINT).catch(() => null);
  const metadataMap = new Map(metadataResults.map(({ mint, token }) => [mint, token]));

  balances.forEach((entry) => {
    const meta = entry.isNative ? wrappedSolMeta : metadataMap.get(entry.mint) ?? null;
    if (meta) {
      entry.symbol = typeof meta.symbol === "string" && meta.symbol.trim().length > 0 ? meta.symbol : entry.symbol;
      entry.name = typeof meta.name === "string" && meta.name.trim().length > 0 ? meta.name : entry.name;
      if (typeof meta.icon === "string" && meta.icon.trim().length > 0) {
        entry.icon = meta.icon;
      }
      if (typeof meta.usdPrice === "number" && Number.isFinite(meta.usdPrice)) {
        entry.usdPrice = meta.usdPrice;
        entry.valueUsd = entry.uiAmount * meta.usdPrice;
      }
    }

    if (!entry.icon && entry.isNative) {
      entry.icon = SOL_FALLBACK_ICON;
    }
  });

  balances.sort((a, b) => {
    const valueDiff = (b.valueUsd ?? 0) - (a.valueUsd ?? 0);
    if (Math.abs(valueDiff) > 0.000001) {
      return valueDiff;
    }
    return b.uiAmount - a.uiAmount;
  });

  return balances;
};

export default function Portfolio() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const walletAddress = user?.wallet?.publicKey ?? null;

  const {
    data: walletTokens = [],
    isLoading: balancesLoading,
    isError: balancesError,
    refetch: refetchBalances,
    isFetching: balancesFetching,
  } = useQuery({
    queryKey: ["wallet-token-balances", walletAddress],
    enabled: isAuthenticated && Boolean(walletAddress),
    queryFn: () => loadWalletTokenBalances(walletAddress!),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const totalUsdValue = useMemo(
    () =>
      walletTokens.reduce((sum, token) => {
        const price = typeof token.usdPrice === "number" && Number.isFinite(token.usdPrice) ? token.usdPrice : 0;
        const value = token.valueUsd ?? price * token.uiAmount;
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [walletTokens],
  );

  const solEntry = walletTokens.find((token) => token.isNative);
  const solBalance = solEntry?.uiAmount ?? 0;
  const tokenCount = walletTokens.filter((token) => !token.isNative).length;

  const handleCopyAddress = async () => {
    if (!walletAddress || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      toast({
        title: "Copy failed",
        description: "Clipboard is unavailable in this environment.",
        variant: "destructive",
      });
      return;
    }

    await navigator.clipboard.writeText(walletAddress);
    toast({
      title: "Wallet copied",
      description: "Public key copied to clipboard.",
      duration: 2000,
    });
  };

  const handleRefreshBalances = () => {
    if (!balancesLoading) {
      void refetchBalances();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="space-y-4 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading account...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <Lock className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-mono mb-2 text-foreground">Authentication Required</h1>
          <p className="text-muted-foreground mb-6">
            You need to be logged in to access your portfolio.
          </p>
          <Button
            onClick={() => {
              const loginButton = document.querySelector('[data-testid="button-login"]') as HTMLButtonElement | null;
              loginButton?.click();
            }}
            className="w-full"
            data-testid="button-login-portfolio"
          >
            Log In to Continue
          </Button>
        </Card>
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <h1 className="text-2xl font-semibold mb-2 text-foreground">Wallet Not Linked</h1>
          <p className="text-muted-foreground">
            Connect a wallet to view your spot balances.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-portfolio">Portfolio</h1>
        <p className="text-muted-foreground">Track spot holdings across your connected wallet.</p>
      </div>

      <Tabs defaultValue="spot" className="w-full">
        <TabsList className="mb-6" data-testid="tabs-portfolio">
          <TabsTrigger value="spot" data-testid="tab-spot">Spot</TabsTrigger>
          <TabsTrigger value="perpetuals" data-testid="tab-perpetuals">Perpetuals</TabsTrigger>
        </TabsList>

        <TabsContent value="spot" data-testid="content-spot">
          <Card className="border-card-border bg-card">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Spot Balances</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Live SPL token balances fetched directly from the Solana blockchain.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAddress}
                  data-testid="button-copy-wallet"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy Wallet
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshBalances}
                  disabled={balancesLoading || balancesFetching}
                  data-testid="button-refresh-balances"
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${balancesFetching ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Wallet</span>
                  <span className="font-mono text-sm text-foreground" data-testid="text-wallet-address">
                    {shortenAddress(walletAddress)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Value</div>
                    <div className="text-lg font-semibold text-foreground" data-numeric="true" data-testid="text-total-value">
                      {formatCurrency(totalUsdValue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">SOL Balance</div>
                    <div className="text-lg font-semibold text-foreground" data-numeric="true" data-testid="text-sol-balance">
                      {formatTokenAmount(solBalance, 5)} SOL
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Tokens</div>
                    <div className="text-lg font-semibold text-foreground" data-testid="text-token-count">
                      {tokenCount}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {balancesLoading ? (
                <div className="space-y-3" data-testid="loading-wallet-balances">
                  <LoadingSkeleton className="h-16 w-full" count={3} />
                </div>
              ) : balancesError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  Failed to load wallet balances. Try refreshing.
                </div>
              ) : walletTokens.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No token balances detected for this wallet.
                </div>
              ) : (
                <div className="space-y-3">
                  {walletTokens.map((token) => (
                    <div
                      key={`${token.mint}-${token.symbol}`}
                      className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card/60 p-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <TokenAvatar
                          symbol={token.symbol}
                          name={token.name}
                          iconUrl={token.icon}
                          size={40}
                        />
                        <div>
                          <div className="text-sm font-semibold text-foreground">{token.symbol}</div>
                          <div className="text-xs text-muted-foreground">{token.name}</div>
                        </div>
                      </div>
                      <div className="grid w-full grid-cols-1 gap-3 text-right sm:grid-cols-3">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Amount</div>
                          <div className="text-sm font-mono text-foreground" data-numeric="true">
                            {formatTokenAmount(token.uiAmount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Price</div>
                          <div className="text-sm font-mono text-foreground" data-numeric="true">
                            {formatCurrency(token.usdPrice, { compact: false, decimals: token.usdPrice && token.usdPrice < 1 ? 6 : 2 })}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">Value</div>
                          <div className="text-sm font-mono text-foreground" data-numeric="true" data-testid={`text-token-value-${token.mint}`}>
                            {formatCurrency(token.valueUsd)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="perpetuals" data-testid="content-perpetuals">
          <Card className="border-card-border bg-card">
            <CardHeader>
              <CardTitle>Open Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                No open positions
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

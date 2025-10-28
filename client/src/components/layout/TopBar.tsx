import { LoginModal } from "@/components/auth/LoginModal";
import SearchPeek from "@/components/layout/SearchPeek";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Compass, Copy, Download, Gift, Home, Key, LogOut, Menu, RefreshCw, Rocket, Search, Shield, Upload, User, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

// Small debounce hook used by TopBar search
function useDebounce<T>(value: T, delay = 200) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced as T;
}

const navItems = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: Shield, label: "Vaults", path: "/vaults" },
  { icon: Compass, label: "Discover", path: "/discover" },
  { icon: Wallet, label: "Portfolio", path: "/portfolio" },
  { icon: User, label: "Creator", path: "/creator" },
  { icon: Gift, label: "Rewards", path: "/rewards" },
];

export function TopBar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [location, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  useEffect(() => {
    const openListener = () => setLoginModalOpen(true);
    window.addEventListener("slab-open-login-modal", openListener);
    return () => window.removeEventListener("slab-open-login-modal", openListener);
  }, []);

  // Export private key mutation
  const exportKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wallet/export-key", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to export private key");
      return res.json();
    },
    onSuccess: (data: { privateKey: string }) => {
      navigator.clipboard.writeText(data.privateKey);
      toast({
        title: "Private Key Copied",
        description: "Your private key has been copied to clipboard. Keep it safe!",
        variant: "destructive",
        duration: 5000,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to export private key",
        variant: "destructive",
      });
    },
  });

  // Refresh balance mutation
  const refreshBalanceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wallet/balance", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to refresh balance");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Balance Updated",
        description: "Your wallet balance has been refreshed",
        duration: 2000,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to refresh balance",
        variant: "destructive",
      });
    },
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: async (data: { recipientAddress: string; amount: string }) => {
      const res = await apiRequest("POST", "/api/wallet/withdraw", data);
      return await res.json();
    },
    onSuccess: (data: { signature: string; newBalance: number; explorerUrl: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setWithdrawAmount("");
      setRecipientAddress("");
      toast({
        title: "Withdrawal Successful",
        description: `Transaction: ${data.signature.slice(0, 8)}... New balance: ${data.newBalance.toFixed(4)} SOL`,
        duration: 5000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message || "Failed to withdraw SOL",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const copyAddress = () => {
    if (user?.wallet?.publicKey) {
      navigator.clipboard.writeText(user.wallet.publicKey);
      toast({
        title: "Copied",
        description: "Wallet address copied to clipboard",
        duration: 2000,
      });
    }
  };

  const exportPrivateKey = () => {
    exportKeyMutation.mutate();
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const openWalletDialog = (tab: "deposit" | "withdraw") => {
    setActiveTab(tab);
    setWalletDialogOpen(true);
  };

  const handleWithdraw = () => {
    if (!recipientAddress || !withdrawAmount) {
      toast({
        title: "Invalid Input",
        description: "Please enter recipient address and amount",
        variant: "destructive",
      });
      return;
    }
    withdrawMutation.mutate({ recipientAddress, amount: withdrawAmount });
  };

  return (
    <header className="h-14 bg-background border-b border-primary/20 flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Left: Logo + Desktop Navigation */}
      <div className="flex items-center gap-6">
        <img
          src="/slablogo.png"
          alt="SLAB Logo"
          className="w-16 h-16 cursor-pointer"
          onClick={() => navigate("/")}
        />

        {/* Desktop Horizontal Navigation */}
        <nav className="hidden lg:flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;

            return (
              <Button
                key={item.path}
                variant="ghost"
                size="sm"
                onClick={() => navigate(item.path)}
                className={`gap-2 border ${isActive ? 'border-primary/50 bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-primary/20'}`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="text-xs">[{item.label.toUpperCase()}]</span>
              </Button>
            );
          })}
        </nav>

        {/* Mobile Menu */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden border border-primary/20" data-testid="button-mobile-menu">
              <Menu className="w-4 h-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-background border-r border-primary/20">
            <nav className="flex flex-col gap-2 mt-8">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;

                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleNavigation(item.path)}
                    className={`justify-start gap-3 border ${isActive ? 'border-primary/50 bg-primary/10 text-primary' : 'border-transparent text-muted-foreground'}`}
                    data-testid={`nav-mobile-${item.label.toLowerCase()}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs">{item.label.toUpperCase()}</span>
                  </Button>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-6 hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/50" />
          <Input
            id="global-search"
            type="search"
            value={searchTerm}
            placeholder="$ SEARCH MARKETS..."
            className="pl-10 pr-16 bg-background/50 border-primary/20 h-9 text-xs placeholder:text-muted-foreground focus:border-primary/40"
            onFocus={() => setSearchFocused(true)}
            onChange={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
            data-testid="input-search"
          />
          <SearchPeek
            query={debouncedSearchTerm}
            isOpen={searchFocused || Boolean(searchTerm)}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onClose={() => {
              setSearchFocused(false);
              setSearchTerm("");
            }}
            onSelect={(token: any) => {
              // Store the token data in localStorage for the market page to use
              const storageKey = `jupiter-token-${token.id}`;
              localStorage.setItem(storageKey, JSON.stringify({
                token,
                storedAt: Date.now()
              }));

              // Navigate to market with the token's mint address (id) or symbol
              const routeParam = token.symbol || token.id;
              navigate(`/market/${routeParam}`);
              setSearchFocused(false);
              setSearchTerm("");
            }}
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] text-primary/70 bg-background border border-primary/20">
            ^K
          </kbd>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Launch Button */}
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
          onClick={() => navigate("/launch")}
          data-testid="button-launch"
        >
          <Rocket className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-xs">LAUNCH</span>
        </Button>

        {/* Login / Wallet Display */}
        {!isAuthenticated ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
            onClick={() => setLoginModalOpen(true)}
            data-testid="button-login"
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">LOGIN</span>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
                data-testid="button-wallet-menu"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs font-mono">
                  {user?.wallet?.publicKey ? truncateAddress(user.wallet.publicKey) : "WALLET"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-background border-primary/20">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                YOUR WALLET
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-primary/20" />

              {/* Wallet Address */}
              <div className="px-2 py-2 space-y-1">
                <div className="text-xs text-muted-foreground">Address</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs font-mono text-primary break-all" data-testid="text-wallet-address">
                    {user?.wallet?.publicKey || "Loading..."}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => {
                      if (user?.wallet?.publicKey) {
                        navigator.clipboard.writeText(user.wallet.publicKey);
                        toast({
                          title: "Address Copied",
                          description: "Wallet address copied to clipboard",
                        });
                      }
                    }}
                    data-testid="button-copy-address"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Balance */}
              <div className="px-2 py-2 space-y-1">
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className="text-xs font-mono text-primary" data-testid="text-wallet-balance">
                  {user?.wallet?.balance || "0"} SOL
                </div>
              </div>

              <DropdownMenuSeparator className="bg-primary/20" />

              <DropdownMenuItem onClick={() => openWalletDialog("deposit")} className="text-xs hover:bg-primary/10" data-testid="menu-deposit">
                <Download className="w-3.5 h-3.5 mr-2" />
                Deposit SOL
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => openWalletDialog("withdraw")} className="text-xs hover:bg-primary/10" data-testid="menu-withdraw">
                <Upload className="w-3.5 h-3.5 mr-2" />
                Withdraw SOL
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => refreshBalanceMutation.mutate()} disabled={refreshBalanceMutation.isPending} className="text-xs hover:bg-primary/10" data-testid="menu-refresh-balance">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${refreshBalanceMutation.isPending ? "animate-spin" : ""}`} />
                Refresh Balance
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-primary/20" />

              <DropdownMenuItem onClick={copyAddress} className="text-xs hover:bg-primary/10" data-testid="menu-copy-address">
                <Copy className="w-3.5 h-3.5 mr-2" />
                Copy Address
              </DropdownMenuItem>

              <DropdownMenuItem onClick={exportPrivateKey} className="text-xs hover:bg-primary/10" data-testid="menu-export-key">
                <Key className="w-3.5 h-3.5 mr-2" />
                Export Private Key
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-primary/20" />

              <DropdownMenuItem
                onClick={() => window.location.href = "/api/logout"}
                className="text-xs text-destructive hover:bg-destructive/10"
                data-testid="menu-logout"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Wallet Dialog */}
      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent className="bg-background border-primary/20 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-primary text-xs font-bold">WALLET.MANAGEMENT</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              &gt; DEPOSIT_OR_WITHDRAW_SOL
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "deposit" | "withdraw")} className="mt-4">
            <TabsList className="grid w-full grid-cols-2 bg-background border border-primary/20">
              <TabsTrigger
                value="deposit"
                className="text-[10px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                data-testid="tab-deposit"
              >
                [DEPOSIT]
              </TabsTrigger>
              <TabsTrigger
                value="withdraw"
                className="text-[10px] data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                data-testid="tab-withdraw"
              >
                [WITHDRAW]
              </TabsTrigger>
            </TabsList>

            {/* Deposit Tab */}
            <TabsContent value="deposit" className="space-y-4 mt-4">
              <div className="p-4 bg-background/50 border border-primary/20 space-y-3">
                <div className="text-[10px] text-muted-foreground">
                  &gt; SEND_SOL_TO_THIS_ADDRESS
                </div>
                <div className="p-3 bg-background border border-primary/20 break-all">
                  <div className="text-xs font-mono text-primary" data-testid="text-deposit-address">
                    {user?.wallet?.publicKey || "Loading..."}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyAddress}
                  className="w-full border-primary/30 text-primary hover:bg-primary/10"
                  data-testid="button-copy-deposit-address"
                >
                  <Copy className="w-3.5 h-3.5 mr-2" />
                  COPY_ADDRESS
                </Button>
              </div>

              <div className="p-3 bg-warning/10 border border-warning/30 text-[10px] text-warning">
                &gt; DEVNET_ONLY: Use Solana devnet faucet to get test SOL
              </div>

              <div className="text-[9px] text-muted-foreground text-center">
                &gt; TRANSACTION_CONFIRMATIONS: 2-3 BLOCKS (~1-2 MIN)
              </div>
            </TabsContent>

            {/* Withdraw Tab */}
            <TabsContent value="withdraw" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="recipient-address" className="text-[10px] text-muted-foreground mb-1.5 block">
                    RECIPIENT_ADDRESS
                  </Label>
                  <Input
                    id="recipient-address"
                    type="text"
                    placeholder="Enter Solana address..."
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className="font-mono text-xs h-9 bg-background border-primary/20"
                    data-testid="input-recipient-address"
                  />
                </div>

                <div>
                  <Label htmlFor="withdraw-amount" className="text-[10px] text-muted-foreground mb-1.5 block">
                    AMOUNT (SOL)
                  </Label>
                  <Input
                    id="withdraw-amount"
                    type="number"
                    step="0.001"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="font-mono text-sm h-9 bg-background border-primary/20"
                    data-testid="input-withdraw-amount"
                  />
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Available: {user?.wallet?.balance || "0"} SOL
                  </div>
                </div>

                <div className="p-3 bg-background/50 border border-primary/20 space-y-1.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">EST_FEE</span>
                    <span className="font-mono" data-numeric="true">~0.00001 SOL</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-primary/20">
                    <span className="text-primary">TOTAL</span>
                    <span className="font-mono font-bold text-primary" data-numeric="true">
                      {withdrawAmount ? (parseFloat(withdrawAmount) + 0.00001).toFixed(5) : "0.00000"} SOL
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleWithdraw}
                  disabled={!recipientAddress || !withdrawAmount || withdrawMutation.isPending}
                  className="w-full border-primary/30 text-primary hover:bg-primary/10"
                  data-testid="button-withdraw-submit"
                >
                  {withdrawMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                      PROCESSING...
                    </>
                  ) : (
                    "[WITHDRAW_SOL]"
                  )}
                </Button>
              </div>

              <div className="text-[9px] text-muted-foreground text-center">
                &gt; TRANSACTION_FINALITY: ~30-60 SEC
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Login Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />
    </header>
  );
}

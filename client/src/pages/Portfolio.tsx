import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Plus, Copy, Archive, RefreshCw, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";

interface Wallet {
  id: string;
  name: string;
  publicKey: string;
  balance: string;
  isPrimary: string;
  isArchived: string;
  createdAt: string;
}

export default function Portfolio() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const [visiblePrivateKeys, setVisiblePrivateKeys] = useState<Record<string, string>>({});
  const [newWalletName, setNewWalletName] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Fetch all wallets
  const { data: wallets = [], isLoading: walletsLoading } = useQuery<Wallet[]>({
    queryKey: ["/api/wallets"],
  });

  // Create wallet mutation
  const createWalletMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/wallets", { name });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      setNewWalletName("");
      setIsCreateDialogOpen(false);
      toast({
        title: "Wallet created",
        description: "Your new wallet has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create wallet",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Archive wallet mutation
  const archiveWalletMutation = useMutation({
    mutationFn: async ({ walletId, isArchived }: { walletId: string; isArchived: string }) => {
      const response = await apiRequest("PATCH", `/api/wallets/${walletId}`, { isArchived });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({
        title: "Wallet updated",
        description: "Wallet status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update wallet",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Refresh balance mutation
  const refreshBalanceMutation = useMutation({
    mutationFn: async (walletId: string) => {
      const response = await fetch(`/api/wallets/${walletId}/balance`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to refresh balance");
      }
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({
        title: "Balance refreshed",
        description: "Wallet balance has been updated from the blockchain.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to refresh balance",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Show/hide private key
  const togglePrivateKey = async (walletId: string) => {
    if (visiblePrivateKeys[walletId]) {
      // Hide private key
      const newKeys = { ...visiblePrivateKeys };
      delete newKeys[walletId];
      setVisiblePrivateKeys(newKeys);
    } else {
      // Fetch and show private key
      try {
        const response = await fetch(`/api/wallets/${walletId}/export-key`, {
          credentials: "include",
        });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || "Failed to export key");
        }

        setVisiblePrivateKeys({
          ...visiblePrivateKeys,
          [walletId]: data.privateKey,
        });
      } catch (error: any) {
        toast({
          title: "Failed to export private key",
          description: error.message || "An error occurred",
          variant: "destructive",
        });
      }
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: `${label} has been copied to your clipboard.`,
    });
  };

  // Filter wallets
  const displayedWallets = wallets.filter(w => showArchived || w.isArchived === "false");

  // Show authentication required if not logged in
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
              // This will trigger the login modal from the TopBar
              const loginButton = document.querySelector('[data-testid="button-login"]') as HTMLButtonElement;
              if (loginButton) {
                loginButton.click();
              }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-portfolio">Portfolio</h1>
        <p className="text-muted-foreground">Manage your wallets and positions</p>
      </div>

      <Tabs defaultValue="wallets" className="w-full">
        <TabsList className="mb-6" data-testid="tabs-portfolio">
          <TabsTrigger value="spot" data-testid="tab-spot">Spot</TabsTrigger>
          <TabsTrigger value="wallets" data-testid="tab-wallets">Wallets</TabsTrigger>
          <TabsTrigger value="perpetuals" data-testid="tab-perpetuals">Perpetuals</TabsTrigger>
        </TabsList>

        {/* Spot Tab */}
        <TabsContent value="spot" data-testid="content-spot">
          <Card className="border-card-border bg-card">
            <CardHeader>
              <CardTitle>Spot Balances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground">
                Total SOL Balance: {wallets.reduce((sum, w) => sum + parseFloat(w.balance || "0"), 0).toFixed(4)} SOL
              </div>
              <Separator className="my-4" />
              <div className="space-y-2">
                {displayedWallets.map((wallet) => (
                  <div key={wallet.id} className="flex items-center justify-between p-3 rounded-md bg-card/50 border">
                    <div>
                      <div className="font-medium">{wallet.name}</div>
                      <div className="text-sm text-muted-foreground font-mono">{wallet.publicKey.slice(0, 8)}...{wallet.publicKey.slice(-8)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono" data-numeric="true">{parseFloat(wallet.balance || "0").toFixed(4)} SOL</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wallets Tab */}
        <TabsContent value="wallets" data-testid="content-wallets">
          <Card className="border-card-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Your Wallets</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowArchived(!showArchived)}
                    data-testid="button-toggle-archived"
                  >
                    {showArchived ? "Hide Archived" : "Show Archived"}
                  </Button>
                  <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-create-wallet">
                        <Plus className="w-4 h-4 mr-1" />
                        Create Wallet
                      </Button>
                    </DialogTrigger>
                    <DialogContent data-testid="dialog-create-wallet">
                      <DialogHeader>
                        <DialogTitle>Create New Wallet</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label htmlFor="wallet-name">Wallet Name</Label>
                          <Input
                            id="wallet-name"
                            placeholder="e.g., Trading Wallet"
                            value={newWalletName}
                            onChange={(e) => setNewWalletName(e.target.value)}
                            data-testid="input-wallet-name"
                          />
                        </div>
                        <Button
                          onClick={() => createWalletMutation.mutate(newWalletName)}
                          disabled={!newWalletName || createWalletMutation.isPending}
                          className="w-full"
                          data-testid="button-confirm-create"
                        >
                          {createWalletMutation.isPending ? "Creating..." : "Create Wallet"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {walletsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading wallets...</div>
                ) : displayedWallets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {showArchived ? "No wallets found" : "No active wallets"}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayedWallets.map((wallet) => (
                      <Card key={wallet.id} className={wallet.isArchived === "true" ? "opacity-60" : ""} data-testid={`card-wallet-${wallet.id}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium" data-testid={`text-wallet-name-${wallet.id}`}>{wallet.name}</span>
                                {wallet.isPrimary === "true" && (
                                  <Badge variant="default" data-testid={`badge-primary-${wallet.id}`}>Primary</Badge>
                                )}
                                {wallet.isArchived === "true" && (
                                  <Badge variant="secondary" data-testid={`badge-archived-${wallet.id}`}>Archived</Badge>
                                )}
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Balance:</span>
                                  <span className="font-mono" data-numeric="true" data-testid={`text-balance-${wallet.id}`}>
                                    {parseFloat(wallet.balance || "0").toFixed(4)} SOL
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => refreshBalanceMutation.mutate(wallet.id)}
                                    disabled={refreshBalanceMutation.isPending}
                                    data-testid={`button-refresh-${wallet.id}`}
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Public Key:</span>
                                  <code className="text-xs font-mono" data-testid={`text-publickey-${wallet.id}`}>
                                    {wallet.publicKey}
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => copyToClipboard(wallet.publicKey, "Public key")}
                                    data-testid={`button-copy-publickey-${wallet.id}`}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                                {visiblePrivateKeys[wallet.id] && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">Private Key:</span>
                                    <code className="text-xs font-mono text-destructive" data-testid={`text-privatekey-${wallet.id}`}>
                                      {visiblePrivateKeys[wallet.id]}
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => copyToClipboard(visiblePrivateKeys[wallet.id], "Private key")}
                                      data-testid={`button-copy-privatekey-${wallet.id}`}
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => togglePrivateKey(wallet.id)}
                              data-testid={`button-toggle-privatekey-${wallet.id}`}
                            >
                              {visiblePrivateKeys[wallet.id] ? (
                                <>
                                  <EyeOff className="w-4 h-4 mr-1" />
                                  Hide Private Key
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4 mr-1" />
                                  Show Private Key
                                </>
                              )}
                            </Button>
                            {wallet.isPrimary !== "true" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  archiveWalletMutation.mutate({
                                    walletId: wallet.id,
                                    isArchived: wallet.isArchived === "true" ? "false" : "true",
                                  })
                                }
                                disabled={archiveWalletMutation.isPending}
                                data-testid={`button-archive-${wallet.id}`}
                              >
                                <Archive className="w-4 h-4 mr-1" />
                                {wallet.isArchived === "true" ? "Unarchive" : "Archive"}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        {/* Perpetuals Tab */}
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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WalletService } from "@/lib/wallet";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Wallet, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [isConnecting, setIsConnecting] = useState<"solana" | null>(null);
  const [walletAvailable, setWalletAvailable] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Check if wallet is available when modal opens
  useEffect(() => {
    if (isOpen) {
      const checkAvailability = () => setWalletAvailable(WalletService.isWalletAvailable());
      checkAvailability();
      const interval = window.setInterval(checkAvailability, 1000);
      return () => window.clearInterval(interval);
    }

    setWalletAvailable(WalletService.isWalletAvailable());
    return;
  }, [isOpen]);

  const handleSolanaWallet = async () => {
    setIsConnecting("solana");
    setWalletError(null);
    try {
      console.log("Starting wallet connection process...");

      // Check if wallet is available
      if (!WalletService.isWalletAvailable()) {
        console.error("Wallet not available");
        alert("Please install Phantom wallet or another Solana wallet to continue.");
        setIsConnecting(null);
        return;
      }

      console.log("Wallet is available, attempting connection...");

      // Connect to wallet
      const result = await WalletService.connectWallet();
        if (result) {
        console.log(`Connected to ${result.walletType} wallet:`, result.publicKey);

        // Create a temporary user session with the wallet info
        try {
          console.log("Sending wallet info to backend...");

          // Send wallet connection info to backend to create user session
          const response = await fetch('/api/auth/wallet-connect', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              publicKey: result.publicKey,
              walletType: result.walletType
            })
          });

          if (response.ok) {
            // Invalidate and refetch user data to update the UI
            await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

            // Close the modal and reset state
            onClose();
            setIsConnecting(null);
            console.log("Wallet connected and user session created");
          } else {
            const errorText = await response.text();
            console.error("Failed to create user session:", response.status, errorText);
            setWalletError(`Failed to create wallet session (${response.status})`);
            setIsConnecting(null);
          }
        } catch (sessionError) {
          console.error("Error creating user session:", sessionError);
          setIsConnecting(null);
          setWalletError(
            sessionError instanceof Error
              ? sessionError.message
              : "Failed to connect to server"
          );
        }
      } else {
        console.error("Wallet connection returned null result");
        setWalletError("Failed to connect wallet. Please try again.");
        setIsConnecting(null);
      }
    } catch (error) {
      console.error("Solana wallet connection error:", error);
      setWalletError(
        error instanceof Error ? error.message : "Failed to connect wallet."
      );
      setIsConnecting(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-center text-xl font-mono">
            Welcome to SLAB
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Connect your Solana wallet to get started
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Solana Wallet */}
          <Card
            className={`hover:bg-primary/10 transition-colors cursor-pointer ${!walletAvailable ? 'opacity-50' : ''}`}
            onClick={walletAvailable ? handleSolanaWallet : undefined}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <Wallet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">Solana Wallet</CardTitle>
                  <CardDescription className="text-xs">
                    {walletAvailable
                      ? "Connect your Phantom, Solflare, or other Solana wallet"
                      : "Install Phantom wallet or another Solana wallet to continue"
                    }
                  </CardDescription>
                </div>
                <Badge variant={walletAvailable ? "secondary" : "destructive"} className="text-xs px-1.5 py-0.5">
                  {walletAvailable ? "Web3" : "Not Available"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isConnecting === "solana" || !walletAvailable}
                onClick={handleSolanaWallet}
              >
                {isConnecting === "solana" ? (
                  <>
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                    Connecting...
                  </>
                ) : walletAvailable ? (
                  <>
                    <Zap className="w-3 h-3 mr-2" />
                    Connect Wallet
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3 h-3 mr-2" />
                    Install Wallet
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-xs text-muted-foreground pt-3 border-t">
          {walletError && (
            <p className="mb-2 text-destructive">{walletError}</p>
          )}
          <p>By continuing, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Solana wallet connection utilities
export interface SolanaPublicKey {
  toString(): string;
  toBase58(): string;
}

export interface WalletAdapter {
  publicKey: SolanaPublicKey | null;
  connected: boolean;
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: SolanaPublicKey }>;
  disconnect: () => Promise<void>;
  // Optional signing methods exposed by browser wallets (Phantom, Solflare, etc.)
  signTransaction?: (transaction: any) => Promise<any>;
  signAllTransactions?: (transactions: any[]) => Promise<any[]>;
}

declare global {
  interface Window {
    solana?: WalletAdapter;
    phantom?: {
      solana?: WalletAdapter;
    };
  }
}

export class WalletService {
  static async connectWallet(
    preferredWallet: "phantom" | "solana" = "phantom",
    onlyIfAvailable = false
  ): Promise<{ publicKey: string; walletType: string } | null> {
    const adapters: Array<{
      name: "phantom" | "solana";
      adapter: WalletAdapter | undefined;
    }> = [
        { name: "phantom", adapter: window.phantom?.solana },
        { name: "solana", adapter: window.solana },
      ];

    const sortedAdapters =
      preferredWallet === "phantom"
        ? adapters
        : adapters.reverse();

    try {
      for (const { name, adapter } of sortedAdapters) {
        if (!adapter) {
          continue;
        }

        if (onlyIfAvailable && !adapter.publicKey && !adapter.connected) {
          continue;
        }

        try {
          const response = await adapter.connect();
          const publicKey = response.publicKey?.toString?.() ?? adapter.publicKey?.toString?.();

          if (!publicKey) {
            continue;
          }

          return {
            publicKey,
            walletType: name,
          };
        } catch (error) {
          console.warn(`Wallet connect attempt for ${name} failed:`, error);
        }
      }

      return null;
    } catch (error) {
      console.error("Wallet connection error:", error);
      throw error;
    }
  }

  static async disconnectWallet(): Promise<void> {
    try {
      if (window.phantom?.solana?.disconnect) {
        await window.phantom.solana.disconnect();
      }

      if (window.solana?.disconnect && window.solana !== window.phantom?.solana) {
        await window.solana.disconnect();
      }
    } catch (error) {
      console.error("Wallet disconnection error:", error);
    }
  }

  static isWalletAvailable(): boolean {
    return Boolean(window.phantom?.solana || window.solana);
  }

  static getWalletType(): string | null {
    if (window.phantom?.solana?.isPhantom) return "phantom";
    if (window.solana?.isPhantom) return "solana";
    return null;
  }
}

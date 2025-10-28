import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { AnchorProvider } from '@coral-xyz/anchor';
import { Buffer } from './bufferPolyfill';

/**
 * Wallet signing service for custodial wallets
 * This integrates with the backend wallet service to sign transactions
 */
export class WalletSigningService {
  private connection: Connection;
  private userPublicKey: PublicKey;

  constructor(connection: Connection, userPublicKey: PublicKey) {
    this.connection = connection;
    this.userPublicKey = userPublicKey;
  }

  /**
   * Sign a transaction using the custodial wallet service
   */
  async signTransaction(transaction: Transaction): Promise<Transaction> {
    try {
      // Serialize the transaction
      const serialized = transaction.serialize({ requireAllSignatures: false });
      
      // Convert to base64 using Buffer
      const transactionBase64 = Buffer.from(serialized).toString('base64');
      
      // Send to backend for signing
      const response = await fetch('/api/wallet/sign-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction: transactionBase64,
          publicKey: this.userPublicKey.toBase58()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to sign transaction: ${response.statusText}`);
      }

      const { signedTransaction } = await response.json();
      
      // Convert base64 back to Buffer and deserialize
      return Transaction.from(Buffer.from(signedTransaction, 'base64'));
    } catch (error) {
      console.error('Transaction signing failed:', error);
      throw new Error('Failed to sign transaction');
    }
  }

  /**
   * Sign multiple transactions
   */
  async signAllTransactions(transactions: Transaction[]): Promise<Transaction[]> {
    const signedTransactions: Transaction[] = [];
    
    for (const transaction of transactions) {
      const signed = await this.signTransaction(transaction);
      signedTransactions.push(signed);
    }
    
    return signedTransactions;
  }

  /**
   * Create a wallet object compatible with Anchor
   */
  createWallet() {
    return {
      publicKey: this.userPublicKey,
      signTransaction: this.signTransaction.bind(this),
      signAllTransactions: this.signAllTransactions.bind(this)
    };
  }

  /**
   * Create an Anchor provider
   */
  createProvider() {
    const wallet = this.createWallet();
    return new AnchorProvider(this.connection, wallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed'
    });
  }
}

/**
 * Create a wallet signing service for a user
 */
export function createWalletSigningService(
  connection: Connection, 
  userPublicKey: PublicKey
): WalletSigningService {
  return new WalletSigningService(connection, userPublicKey);
}

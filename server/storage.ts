import { memoryDB, type User, type Wallet } from "./db";
import { WalletService } from "./walletService";

// Define types
export type UpsertUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
};

export type InsertWallet = {
  userId: string;
  publicKey: string;
  encryptedPrivateKey: string;
  name?: string;
  balance?: string;
  isPrimary?: string;
  isArchived?: string;
};

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Wallet operations
  getUserWallet(userId: string): Promise<Wallet | undefined>;
  createWallet(userId: string): Promise<Wallet>;
  updateWalletBalance(walletId: string, balance: string): Promise<Wallet>;

  // Multi-wallet operations
  getAllUserWallets(userId: string): Promise<Wallet[]>;
  createAdditionalWallet(wallet: InsertWallet): Promise<Wallet>;
  getWalletById(walletId: string): Promise<Wallet | undefined>;
  updateWallet(walletId: string, updates: { name?: string; isArchived?: string }): Promise<Wallet>;
}

class MemoryStorage implements IStorage {
  private nextWalletId = 1;

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return memoryDB.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = memoryDB.users.get(userData.id);
    const user: User = {
      ...userData,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    memoryDB.users.set(userData.id, user);
    return user;
  }

  // Wallet operations
  async getUserWallet(userId: string): Promise<Wallet | undefined> {
    const wallets = Array.from(memoryDB.wallets.values());
    return wallets.find(wallet => wallet.userId === userId);
  }

  async createWallet(userId: string): Promise<Wallet> {
    const { publicKey, encryptedPrivateKey } = WalletService.createWallet();

    const wallet: Wallet = {
      id: `wallet-${this.nextWalletId++}`,
      userId,
      publicKey,
      encryptedPrivateKey,
      name: "Main Wallet",
      balance: "0",
      isPrimary: "true",
      isArchived: "false",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    memoryDB.wallets.set(wallet.id, wallet);
    return wallet;
  }

  async updateWalletBalance(walletId: string, balance: string): Promise<Wallet> {
    const wallet = memoryDB.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const updated: Wallet = {
      ...wallet,
      balance,
      updatedAt: new Date(),
    };

    memoryDB.wallets.set(walletId, updated);
    return updated;
  }

  // Multi-wallet operations
  async getAllUserWallets(userId: string): Promise<Wallet[]> {
    const wallets = Array.from(memoryDB.wallets.values());
    return wallets.filter(wallet => wallet.userId === userId);
  }

  async createAdditionalWallet(walletData: InsertWallet): Promise<Wallet> {
    const wallet: Wallet = {
      id: `wallet-${this.nextWalletId++}`,
      name: walletData.name || `Wallet ${this.nextWalletId}`,
      balance: walletData.balance || "0",
      isPrimary: walletData.isPrimary || "false",
      isArchived: walletData.isArchived || "false",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...walletData,
    };

    memoryDB.wallets.set(wallet.id, wallet);
    return wallet;
  }

  async getWalletById(walletId: string): Promise<Wallet | undefined> {
    return memoryDB.wallets.get(walletId);
  }

  async updateWallet(walletId: string, updates: { name?: string; isArchived?: string }): Promise<Wallet> {
    const wallet = memoryDB.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const updated: Wallet = {
      ...wallet,
      ...updates,
      updatedAt: new Date(),
    };

    memoryDB.wallets.set(walletId, updated);
    return updated;
  }
}

export const storage = new MemoryStorage();

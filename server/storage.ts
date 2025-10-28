import { users, wallets, type User, type UpsertUser, type Wallet, type InsertWallet } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { WalletService } from "./walletService";

export interface IStorage {
  // User operations (required for Replit Auth)
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

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Wallet operations
  async getUserWallet(userId: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    return wallet;
  }

  async createWallet(userId: string): Promise<Wallet> {
    const { publicKey, encryptedPrivateKey } = WalletService.createWallet();
    
    const [wallet] = await db
      .insert(wallets)
      .values({
        userId,
        publicKey,
        encryptedPrivateKey,
        balance: "0",
      })
      .returning();
    
    return wallet;
  }

  async updateWalletBalance(walletId: string, balance: string): Promise<Wallet> {
    const [wallet] = await db
      .update(wallets)
      .set({ balance, updatedAt: new Date() })
      .where(eq(wallets.id, walletId))
      .returning();
    
    return wallet;
  }

  // Multi-wallet operations
  async getAllUserWallets(userId: string): Promise<Wallet[]> {
    return await db.select().from(wallets).where(eq(wallets.userId, userId));
  }

  async createAdditionalWallet(wallet: InsertWallet): Promise<Wallet> {
    const [newWallet] = await db
      .insert(wallets)
      .values(wallet)
      .returning();
    
    return newWallet;
  }

  async getWalletById(walletId: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId));
    return wallet;
  }

  async updateWallet(walletId: string, updates: { name?: string; isArchived?: string }): Promise<Wallet> {
    const [wallet] = await db
      .update(wallets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(wallets.id, walletId))
      .returning();
    
    return wallet;
  }
}

// Development mode detection
const isDevelopment = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost');

// Development storage implementation
class DevelopmentStorage implements IStorage {
  private mockUsers = new Map<string, User>();
  private mockWalletsByUser = new Map<string, Wallet[]>();
  private nextWalletId = 1;

  private getWalletsForUser(userId: string): Wallet[] {
    return this.mockWalletsByUser.get(userId) ?? [];
  }

  private upsertWalletsForUser(userId: string, wallets: Wallet[]) {
    this.mockWalletsByUser.set(userId, wallets);
  }

  async getUser(id: string): Promise<User | undefined> {
    // Return mock user if exists, otherwise create one
    if (!this.mockUsers.has(id)) {
      const mockUser: User = {
        id,
        email: "dev@example.com",
        firstName: "Dev",
        lastName: "User",
        profileImageUrl: "https://via.placeholder.com/150",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.mockUsers.set(id, mockUser);
    }
    return this.mockUsers.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const user: User = {
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      profileImageUrl: userData.profileImageUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.mockUsers.set(userData.id, user);
    return user;
  }

  async getUserWallet(userId: string): Promise<Wallet | undefined> {
    return this.getWalletsForUser(userId)[0];
  }

  async createWallet(userId: string): Promise<Wallet> {
    const { publicKey, encryptedPrivateKey } = WalletService.createWallet();
    const now = new Date();

    const walletId = `wallet-${this.nextWalletId++}`;
    const wallet: Wallet = {
      id: walletId,
      userId,
      publicKey,
      encryptedPrivateKey,
      balance: "0",
      name: "Main Wallet",
      isPrimary: "true",
      isArchived: "false",
      createdAt: now,
      updatedAt: now,
    };

    const existingWallets = this.getWalletsForUser(userId);
    this.upsertWalletsForUser(userId, [
      wallet,
      ...existingWallets.map(w => ({
        ...w,
        isPrimary: "false",
        updatedAt: now,
      })),
    ]);
    return wallet;
  }

  async updateWalletBalance(walletId: string, balance: string): Promise<Wallet> {
    let updatedWallet: Wallet | undefined;

    for (const [userId, wallets] of this.mockWalletsByUser.entries()) {
      const nextWallets = wallets.map(wallet => {
        if (wallet.id !== walletId) {
          return wallet;
        }

        updatedWallet = {
          ...wallet,
          balance,
          updatedAt: new Date(),
        };

        return updatedWallet;
      });

      if (updatedWallet) {
        this.upsertWalletsForUser(userId, nextWallets);
        break;
      }
    }

    return updatedWallet!;
  }

  async getAllUserWallets(userId: string): Promise<Wallet[]> {
    return this.getWalletsForUser(userId);
  }

  async createAdditionalWallet(wallet: InsertWallet): Promise<Wallet> {
    const now = new Date();
    const walletId = `wallet-${this.nextWalletId++}`;
    const walletLabel = walletId.replace("wallet-", "");
    const newWallet: Wallet = {
      id: walletId,
      ...wallet,
      name: wallet.name ?? `Wallet ${walletLabel}`,
      balance: wallet.balance ?? "0",
      isPrimary: wallet.isPrimary ?? "false",
      isArchived: wallet.isArchived ?? "false",
      createdAt: now,
      updatedAt: now,
    };

    const existing = this.getWalletsForUser(newWallet.userId);
    const wallets = [newWallet, ...existing];

    // Ensure a single primary wallet flag
    const [first, ...rest] = wallets;
    const normalized = [
      { ...first, isPrimary: first.isPrimary ?? "true", updatedAt: now },
      ...rest.map(w => ({ ...w, isPrimary: "false", updatedAt: now })),
    ];
    const hasPrimary = normalized.some(w => w.isPrimary === "true");
    if (!hasPrimary && normalized.length > 0) {
      normalized[0] = { ...normalized[0], isPrimary: "true" };
    }

    this.upsertWalletsForUser(newWallet.userId, normalized);
    return newWallet;
  }

  async getWalletById(walletId: string): Promise<Wallet | undefined> {
    for (const wallets of this.mockWalletsByUser.values()) {
      const match = wallets.find((wallet) => wallet.id === walletId);
      if (match) {
        return match;
      }
    }
    return undefined;
  }

  async updateWallet(walletId: string, updates: { name?: string; isArchived?: string }): Promise<Wallet> {
    let updatedWallet: Wallet | undefined;

    for (const [userId, wallets] of this.mockWalletsByUser.entries()) {
      const nextWallets = wallets.map(wallet => {
        if (wallet.id !== walletId) {
          return wallet;
        }

        updatedWallet = {
          ...wallet,
          ...updates,
          updatedAt: new Date(),
        };

        return updatedWallet;
      });

      if (updatedWallet) {
        this.upsertWalletsForUser(userId, nextWallets);
        break;
      }
    }

    return updatedWallet!;
  }
}

export const storage = isDevelopment ? new DevelopmentStorage() : new DatabaseStorage();

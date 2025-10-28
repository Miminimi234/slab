import { z } from "zod";
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// ============================================================================
// AUTHENTICATION & WALLET TABLES (Replit Auth + Custodial Wallets)
// ============================================================================

// Session storage table - Required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table - Required for Replit Auth
// IMPORTANT: Keeps default config for id column per Replit Auth blueprint
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

// Wallets table - Custodial Solana wallets for each user (supports multiple wallets)
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull().default("Main Wallet"), // User-defined wallet name
  publicKey: varchar("public_key").notNull().unique(),
  encryptedPrivateKey: text("encrypted_private_key").notNull(), // Encrypted with app secret
  balance: decimal("balance", { precision: 18, scale: 9 }).notNull().default("0"), // SOL balance
  isPrimary: varchar("is_primary").notNull().default("false"), // Primary wallet for user
  isArchived: varchar("is_archived").notNull().default("false"), // Archived/hidden from main view
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;

// Zod schemas for wallet operations
export const createWalletSchema = z.object({
  name: z.string().min(1).max(50),
});

export const updateWalletSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  isArchived: z.string().optional(),
});

// ============================================================================
// TRADING TYPES (unchanged)
// ============================================================================

export type MarketStatus = "bonding" | "warmup" | "perps";

export type BondingCurveType = "linear" | "exponential";

export interface Market {
  id: string;
  symbol: string;
  name: string;
  imageUrl?: string;
  status: MarketStatus;
  createdAt: number;
  creatorAddress: string;
  
  // Social media links
  website?: string;
  twitter?: string;
  telegram?: string;
  description?: string;
  
  bondingConfig: {
    curveType: BondingCurveType;
    startPrice: number;
    creatorTax: number;
    protocolTax: number;
    seedVaultTax: number;
  };
  
  graduationTriggers: {
    minLiquidity: number;
    minHolders: number;
    minAgeHours: number;
  };
  
  perpsConfig: {
    tickSize: number;
    lotSize: number;
    maxLeverage: number;
    initialMargin: number;
    maintenanceMargin: number;
    priceBandBps: number;
    fundingK: number;
    warmupHours: number;
    warmupShortLevCap: number;
  };
  
  fees: {
    takerBps: number;
    makerBps: number;
    creatorFeePct: number;
    referrerFeePct: number;
  };
  
  metrics: {
    currentPrice: number;
    priceChange24h: number;
    volume24h: number;
    openInterest: number;
    liquidity: number;
    holders: number;
    ageHours: number;
    graduationProgress: number;
    fundingRate?: number;
  };
}

export interface Trade {
  id: string;
  marketId: string;
  symbol: string;
  timestamp: number;
  price: number;
  size: number;
  side: "buy" | "sell";
}

export interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

export interface OrderBook {
  marketId: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdate: number;
}

export interface Position {
  id: string;
  marketId: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  margin: number;
  pnl: number;
  pnlPct: number;
  liquidationPrice: number;
}

export interface LaunchFormData {
  step: number;
  
  basics: {
    name: string;
    symbol: string;
    imageUrl?: string;
  };
  
  bondingCurve: {
    curveType: BondingCurveType;
    startPrice: number;
    creatorTax: number;
    protocolTax: number;
    seedVaultTax: number;
  };
  
  graduationTriggers: {
    minLiquidity: number;
    minHolders: number;
    minAgeHours: number;
  };
  
  perpsParams: {
    tickSize: number;
    lotSize: number;
    maxLeverage: number;
    initialMargin: number;
    maintenanceMargin: number;
    priceBandBps: number;
    fundingK: number;
    warmupHours: number;
    warmupShortLevCap: number;
  };
  
  fees: {
    takerBps: number;
    makerBps: number;
    creatorFeePct: number;
    referrerFeePct: number;
  };
}

export interface CreatorStats {
  address: string;
  totalEarnings: number;
  totalVolume: number;
  marketsCreated: number;
  referralCode: string;
  referralEarnings: number;
  markets: Market[];
}

export const launchFormSchema = z.object({
  step: z.number().min(1).max(5),
  basics: z.object({
    name: z.string().min(1).max(50),
    symbol: z.string().min(1).max(10).toUpperCase(),
    imageUrl: z.string().optional(),
  }),
  bondingCurve: z.object({
    curveType: z.enum(["linear", "exponential"]),
    startPrice: z.number().positive(),
    creatorTax: z.number().min(0).max(100),
    protocolTax: z.number().min(0).max(100),
    seedVaultTax: z.number().min(0).max(100),
  }),
  graduationTriggers: z.object({
    minLiquidity: z.number().positive(),
    minHolders: z.number().int().positive(),
    minAgeHours: z.number().positive(),
  }),
  perpsParams: z.object({
    tickSize: z.number().positive(),
    lotSize: z.number().positive(),
    maxLeverage: z.number().min(1).max(100),
    initialMargin: z.number().min(0).max(100),
    maintenanceMargin: z.number().min(0).max(100),
    priceBandBps: z.number().positive(),
    fundingK: z.number(),
    warmupHours: z.number().positive(),
    warmupShortLevCap: z.number().min(1).max(10),
  }),
  fees: z.object({
    takerBps: z.number().min(0),
    makerBps: z.number(),
    creatorFeePct: z.number().min(0).max(100),
    referrerFeePct: z.number().min(0).max(100),
  }),
});

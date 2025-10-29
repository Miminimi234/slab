import { z } from "zod";

// ============================================================================
// AUTHENTICATION & WALLET TYPES (In-Memory Storage)
// ============================================================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UpsertUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
};

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  publicKey: string;
  encryptedPrivateKey: string;
  balance: string;
  isPrimary: string;
  isArchived: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InsertWallet = {
  userId: string;
  name?: string;
  publicKey: string;
  encryptedPrivateKey: string;
  balance?: string;
  isPrimary?: string;
  isArchived?: string;
};

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

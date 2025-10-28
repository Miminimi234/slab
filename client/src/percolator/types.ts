/**
 * Percolator SDK Types
 * Fixed-point arithmetic, enums, and core data structures
 */

import { PublicKey } from "@solana/web3.js";

// ===== Enums =====

export enum Side {
  Bid = 0,
  Ask = 1,
}

export enum TimeInForce {
  GTC = 0,  // Good Till Cancel
  IOC = 1,  // Immediate or Cancel
  FOK = 2,  // Fill or Kill
  POST = 3, // Post Only
}

export enum MakerClass {
  Market = 0,
  Limit = 1,
  PostOnly = 2,
}

export enum MarketStatus {
  Active = 0,
  Warmup = 1,
  Frozen = 2,
  Settled = 3,
}

// ===== Fixed-Point Helpers (6 decimals) =====

export const DECIMALS = 6;
export const SCALE = 10 ** DECIMALS;

/**
 * Convert a float to fixed-point integer (6 decimals)
 */
export function toFixed(value: number): bigint {
  return BigInt(Math.floor(value * SCALE));
}

/**
 * Convert fixed-point integer back to float
 */
export function fromFixed(value: bigint | number): number {
  return Number(value) / SCALE;
}

/**
 * Format fixed-point value for display
 */
export function formatFixed(value: bigint | number, decimals: number = 6): string {
  return fromFixed(value).toFixed(decimals);
}

// ===== Core Data Structures =====

export interface RiskParams {
  initialMarginBps: number;  // Initial margin requirement (bps)
  maintenanceMarginBps: number;  // Maintenance margin requirement (bps)
  bandBps: number;  // Price band width (bps)
  fundingCapBps: number;  // Max funding rate (bps)
  maxLeverage: number;  // Maximum leverage allowed
  openInterestCap: bigint;  // Max open interest
}

export interface WarmupConfig {
  enabled: boolean;
  shortEnabled: boolean;
  shortLeverageCap: number;
  endTimestamp: number;
}

export interface InstrumentConfig {
  symbol: string;
  tickSize: bigint;  // Minimum price increment
  lotSize: bigint;  // Minimum size increment
  contractSize: bigint;  // Contract multiplier
}

export interface SlabHeader {
  marketId: PublicKey;
  authority: PublicKey;
  status: MarketStatus;
  risk: RiskParams;
  warmup: WarmupConfig;
  instruments: InstrumentConfig[];
  lastFundingTimestamp: number;
  openInterest: bigint;
}

export interface HoldReceipt {
  holdId: PublicKey;
  trader: PublicKey;
  instrumentIndex: number;
  side: Side;
  quantity: bigint;
  limitPrice: bigint;
  expiryTimestamp: number;
  commitmentHash: Buffer;
}

export interface CapToken {
  user: PublicKey;
  slab: PublicKey;
  mint: PublicKey;
  amountMax: bigint;
  amountUsed: bigint;
  expiryTimestamp: number;
  nonce: bigint;
}

export interface Position {
  trader: PublicKey;
  instrumentIndex: number;
  size: bigint;  // Signed: positive = long, negative = short
  entryPrice: bigint;
  margin: bigint;
  unrealizedPnl: bigint;
  lastFundingIndex: number;
}

export interface OracleData {
  nowcast: bigint;  // Current price estimate
  realized: bigint;  // Realized price (TWAP)
  validFrom: number;  // Unix timestamp
  validTo: number;  // Unix timestamp
}

// ===== Transaction Parameters =====

export interface CreateMarketParams {
  marketId: PublicKey;
  authority: PublicKey;
  quoteMint: PublicKey;
  risk: RiskParams;
  warmup?: WarmupConfig;
}

export interface MintCapParams {
  user: PublicKey;
  slab: PublicKey;
  mint: PublicKey;
  amountMax: bigint;
  ttlMs: number;  // Time to live in milliseconds (max 120000)
}

export interface ReserveParams {
  routeId: PublicKey;
  instrumentIndex: number;
  side: Side;
  quantity: bigint;
  limitPrice: bigint;
  ttlMs: number;
  commitmentHash: Buffer;
}

export interface CommitParams {
  holdId: PublicKey;
  cap: PublicKey;
}

export interface PlaceOrderParams {
  marketId: string;  // Market symbol
  side: Side;
  quantity: number;  // In base units
  limitPrice?: number;  // Optional for market orders
  timeInForce?: TimeInForce;
}

// ===== Utility Types =====

export interface TransactionResult {
  signature: string;
  success: boolean;
  error?: string;
}

export interface MarketData {
  header: SlabHeader;
  orderbook: {
    bids: Array<{ price: bigint; size: bigint }>;
    asks: Array<{ price: bigint; size: bigint }>;
  };
  recentTrades: Array<{
    price: bigint;
    size: bigint;
    side: Side;
    timestamp: number;
  }>;
}

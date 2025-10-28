/**
 * Percolator Connection Manager
 * RPC connection and priority fee helpers
 */

import { Connection, Commitment, ConnectionConfig } from "@solana/web3.js";

// Environment variables
const RPC_URL = import.meta.env.VITE_SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const WS_URL = import.meta.env.VITE_SOLANA_WS || "wss://api.mainnet-beta.solana.com";

// Connection config
const COMMITMENT: Commitment = "confirmed";
const CONFIG: ConnectionConfig = {
  commitment: COMMITMENT,
  wsEndpoint: WS_URL,
};

/**
 * Global Solana connection instance
 */
export const connection = new Connection(RPC_URL, CONFIG);

/**
 * Get recommended priority fee for transactions
 * Uses recent prioritization fees to estimate
 */
export async function getPriorityFee(): Promise<number> {
  try {
    // Get recent prioritization fees
    const fees = await connection.getRecentPrioritizationFees();
    
    if (fees.length === 0) {
      return 1000; // Default: 1000 micro-lamports
    }

    // Calculate 75th percentile for reliable confirmation
    const sorted = fees
      .map(f => f.prioritizationFee)
      .sort((a, b) => a - b);
    
    const p75Index = Math.floor(sorted.length * 0.75);
    const p75Fee = sorted[p75Index] || 1000;

    // Minimum of 1000, maximum of 100000 micro-lamports
    return Math.max(1000, Math.min(100000, p75Fee));
  } catch (error) {
    console.error("Failed to get priority fee:", error);
    return 5000; // Fallback: 5000 micro-lamports
  }
}

/**
 * Get current slot
 */
export async function getCurrentSlot(): Promise<number> {
  return await connection.getSlot(COMMITMENT);
}

/**
 * Get current block time
 */
export async function getCurrentBlockTime(): Promise<number> {
  const slot = await getCurrentSlot();
  const blockTime = await connection.getBlockTime(slot);
  return blockTime || Math.floor(Date.now() / 1000);
}

/**
 * Wait for transaction confirmation
 */
export async function confirmTransaction(signature: string): Promise<boolean> {
  try {
    const result = await connection.confirmTransaction(signature, COMMITMENT);
    return !result.value.err;
  } catch (error) {
    console.error("Transaction confirmation failed:", error);
    return false;
  }
}

/**
 * Get connection health status
 */
export async function getConnectionHealth(): Promise<{
  healthy: boolean;
  slot: number;
  blockTime: number;
}> {
  try {
    const slot = await getCurrentSlot();
    const blockTime = await getCurrentBlockTime();
    return {
      healthy: true,
      slot,
      blockTime,
    };
  } catch (error) {
    return {
      healthy: false,
      slot: 0,
      blockTime: 0,
    };
  }
}

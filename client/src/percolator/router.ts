/**
 * Percolator Router Transaction Builders
 * Creates transactions for market creation, cap minting, funding settlement
 */

import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import '../lib/bufferPolyfill';
import { Buffer } from "../lib/bufferPolyfill";
import { connection, getPriorityFee } from "./connection";
import {
  findCapPda,
  findEscrowPda,
  findPortfolioPda,
  findRegistryPda,
  findVaultPda,
  ROUTER_PROGRAM_ID,
} from "./pdas";
import type {
  CreateMarketParams,
  MintCapParams,
  TransactionResult,
} from "./types";

/**
 * IMPORTANT: All transaction builders return unsigned transactions with
 * placeholder serialization. Actual parameter serialization requires the
 * Percolator program IDL or layout documentation.
 * 
 * Current status: Stubs for transaction structure only.
 * TODO: Replace placeholder buffers with proper borsh/bincode serialization
 * matching the deployed Percolator programs.
 */

// Instruction discriminators (to be finalized based on actual program)
const DISCRIMINATORS = {
  CREATE_MARKET: 0,
  MINT_CAP: 1,
  SETTLE_FUNDING: 2,
  FREEZE_MARKET: 3,
  UNFREEZE_MARKET: 4,
};

/**
 * Create a new market
 */
export async function createMarket(
  params: CreateMarketParams,
  payer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();

  // Find PDAs
  const [registry] = findRegistryPda();
  const [vault] = findVaultPda(params.quoteMint);

  // TODO: Serialize instruction data based on actual program layout
  // This is a placeholder structure
  const data = Buffer.alloc(256);
  data.writeUInt8(DISCRIMINATORS.CREATE_MARKET, 0);
  // Add serialized params...

  const ix = new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: params.marketId, isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: false, isWritable: false },
      { pubkey: registry, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: params.quoteMint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });

  tx.add(ix);

  // Add priority fee
  const priorityFee = await getPriorityFee();
  tx.add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: payer,  // Dummy transfer for priority fee
      lamports: priorityFee,
    })
  );

  return tx;
}

/**
 * Mint a cap token (time-limited spending authorization)
 * Max TTL: 120000ms (120 seconds)
 */
export async function mintCap(
  params: MintCapParams,
  payer: PublicKey
): Promise<Transaction> {
  // Enforce max TTL
  const ttl = Math.min(params.ttlMs, 120000);
  const expiryTimestamp = Math.floor(Date.now() / 1000) + Math.floor(ttl / 1000);

  // Generate nonce for unique cap PDA
  const nonce = BigInt(Date.now());

  // Find PDAs
  const [escrow] = findEscrowPda(params.user, params.slab, params.mint);
  const [cap] = findCapPda(params.user, params.slab, params.mint, nonce);
  const [portfolio] = findPortfolioPda(params.user);

  const tx = new Transaction();

  // TODO: Serialize instruction data
  const data = Buffer.alloc(128);
  data.writeUInt8(DISCRIMINATORS.MINT_CAP, 0);
  // Add amountMax, expiryTimestamp, nonce...

  const ix = new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: params.user, isSigner: false, isWritable: false },
      { pubkey: params.slab, isSigner: false, isWritable: false },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: cap, isSigner: false, isWritable: true },
      { pubkey: portfolio, isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  tx.add(ix);

  return tx;
}

/**
 * Settle funding payment for a trader
 */
export async function settleFunding(
  trader: PublicKey,
  amount: bigint,
  payer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();

  // TODO: Add actual instruction
  const data = Buffer.alloc(64);
  data.writeUInt8(DISCRIMINATORS.SETTLE_FUNDING, 0);

  const ix = new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: trader, isSigner: false, isWritable: true },
    ],
    data,
  });

  tx.add(ix);

  return tx;
}

/**
 * Freeze a market (emergency stop)
 */
export async function freezeMarket(
  marketId: PublicKey,
  authority: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();

  const data = Buffer.alloc(32);
  data.writeUInt8(DISCRIMINATORS.FREEZE_MARKET, 0);

  const ix = new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: marketId, isSigner: false, isWritable: true },
    ],
    data,
  });

  tx.add(ix);

  return tx;
}

/**
 * Unfreeze a market
 */
export async function unfreezeMarket(
  marketId: PublicKey,
  authority: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();

  const data = Buffer.alloc(32);
  data.writeUInt8(DISCRIMINATORS.UNFREEZE_MARKET, 0);

  const ix = new TransactionInstruction({
    programId: ROUTER_PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: marketId, isSigner: false, isWritable: true },
    ],
    data,
  });

  tx.add(ix);

  return tx;
}

/**
 * Send and confirm a transaction
 */
export async function sendAndConfirm(
  tx: Transaction,
  payer: PublicKey
): Promise<TransactionResult> {
  try {
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer;

    // Sign and send
    // NOTE: In production, this would use wallet adapter for signing
    // For now, this is a placeholder that assumes external signing

    console.warn("Transaction prepared but requires wallet signing");

    return {
      signature: "placeholder_signature",
      success: false,
      error: "Wallet signing not implemented - integrate with Solana wallet adapter",
    };
  } catch (error) {
    return {
      signature: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

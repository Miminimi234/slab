/**
 * Percolator Slab Transaction Builders
 * Creates transactions for order placement, instrument management, liquidations
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
import {
  findHoldPda,
  findPositionPda,
  findSlabAuthorityPda,
  findSlabStatePda,
  SLAB_PROGRAM_ID,
} from "./pdas";
import type {
  CommitParams,
  InstrumentConfig,
  ReserveParams,
  RiskParams,
  Side,
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
  INIT_SLAB: 0,
  ADD_INSTRUMENT: 1,
  RESERVE: 2,
  COMMIT: 3,
  CANCEL: 4,
  BATCH_OPEN: 5,
  FUNDING_TICK: 6,
  POST_ORACLE: 7,
  LIQUIDATE: 8,
};

/**
 * Initialize a new slab (10MB account for orderbook)
 * 
 * NOTE: The PDA account creation is handled by the program using invoke_signed.
 * Client cannot create PDA accounts with SystemProgram.createAccount since
 * PDAs don't have private keys to sign transactions.
 */
export async function initSlab(
  marketId: PublicKey,
  authority: PublicKey,
  risk: RiskParams,
  antiToxicity: boolean,
  payer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();

  // Find slab state PDA (program will create this account)
  const [slabState] = findSlabStatePda(marketId);
  const [slabAuthority] = findSlabAuthorityPda(slabState);

  // TODO: Serialize risk params and config based on actual Percolator program layout
  // Awaiting IDL/program documentation for proper serialization format
  const data = Buffer.alloc(512);
  data.writeUInt8(DISCRIMINATORS.INIT_SLAB, 0);
  // Serialization format:
  // - authority (32 bytes)
  // - initial_margin_bps (2 bytes)
  // - maintenance_margin_bps (2 bytes)
  // - band_bps (2 bytes)
  // - funding_cap_bps (2 bytes)
  // - max_leverage (1 byte)
  // - open_interest_cap (8 bytes)
  // - anti_toxicity flag (1 byte)

  const ix = new TransactionInstruction({
    programId: SLAB_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: marketId, isSigner: false, isWritable: false },
      { pubkey: authority, isSigner: false, isWritable: false },
      { pubkey: slabState, isSigner: false, isWritable: true },
      { pubkey: slabAuthority, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });

  tx.add(ix);

  return tx;
}

/**
 * Add an instrument (tradeable contract) to a slab
 */
export async function addInstrument(
  marketId: PublicKey,
  config: InstrumentConfig,
  authority: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();

  const [slabState] = findSlabStatePda(marketId);

  // TODO: Serialize instrument config
  const data = Buffer.alloc(256);
  data.writeUInt8(DISCRIMINATORS.ADD_INSTRUMENT, 0);
  // Add symbol, tickSize, lotSize, contractSize...

  const ix = new TransactionInstruction({
    programId: SLAB_PROGRAM_ID,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: slabState, isSigner: false, isWritable: true },
    ],
    data,
  });

  tx.add(ix);

  return tx;
}

/**
 * Reserve an order (pre-commit hold)
 * Creates a hold receipt with commitment hash
 */
export async function reserve(
  params: ReserveParams,
  trader: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();

  const expiryTimestamp = Math.floor(Date.now() / 1000) + Math.floor(params.ttlMs / 1000);

  // Generate unique hold ID
  const holdId = PublicKey.unique();
  const [hold] = findHoldPda(holdId);
  const [slabState] = findSlabStatePda(params.routeId);

  // TODO: Serialize reserve params
  const data = Buffer.alloc(256);
  data.writeUInt8(DISCRIMINATORS.RESERVE, 0);
  // Add instrumentIndex, side, quantity, limitPrice, ttl, commitmentHash...

  const ix = new TransactionInstruction({
    programId: SLAB_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: trader, isSigner: false, isWritable: false },
      { pubkey: slabState, isSigner: false, isWritable: true },
      { pubkey: hold, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  tx.add(ix);

  return tx;
}

/**
 * Commit a reserved order using a cap token
 */
export async function commit(
  params: CommitParams,
  trader: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();

  const [hold] = findHoldPda(params.holdId);

  // TODO: Serialize commit params
  const data = Buffer.alloc(128);
  data.writeUInt8(DISCRIMINATORS.COMMIT, 0);

  const ix = new TransactionInstruction({
    programId: SLAB_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: trader, isSigner: false, isWritable: true },
      { pubkey: hold, isSigner: false, isWritable: true },
      { pubkey: params.cap, isSigner: false, isWritable: true },
    ],
    data,
  });

  tx.add(ix);

  return tx;
}

/**
 * Cancel a reserved order
 */
export async function cancel(
  holdId: PublicKey,
  trader: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();

  const [hold] = findHoldPda(holdId);

  const data = Buffer.alloc(64);
  data.writeUInt8(DISCRIMINATORS.CANCEL, 0);

  const ix = new TransactionInstruction({
    programId: SLAB_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: trader, isSigner: false, isWritable: true },
      { pubkey: hold, isSigner: false, isWritable: true },
    ],
    data,
  });

  tx.add(ix);

  return tx;
}

/**
 * Batch open orders for an instrument
 * Matches pending holds and creates positions
 */
export async function batchOpen(
  marketId: PublicKey,
  instrumentIndex: number,
  payer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();

  const [slabState] = findSlabStatePda(marketId);

  const data = Buffer.alloc(32);
  data.writeUInt8(DISCRIMINATORS.BATCH_OPEN, 0);
  data.writeUInt16LE(instrumentIndex, 1);

  const ix = new TransactionInstruction({
    programId: SLAB_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: slabState, isSigner: false, isWritable: true },
    ],
    data,
  });

  tx.add(ix);

  return tx;
}

/**
 * Tick funding rate for an instrument
 */
export async function fundingTick(
  marketId: PublicKey,
  instrumentIndex: number,
  payer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();

  const [slabState] = findSlabStatePda(marketId);

  const data = Buffer.alloc(32);
  data.writeUInt8(DISCRIMINATORS.FUNDING_TICK, 0);
  data.writeUInt16LE(instrumentIndex, 1);

  const ix = new TransactionInstruction({
    programId: SLAB_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: false },
      { pubkey: slabState, isSigner: false, isWritable: true },
    ],
    data,
  });

  tx.add(ix);

  return tx;
}

/**
 * Post oracle price data
 */
export async function postOracle(
  marketId: PublicKey,
  nowcast: bigint,
  realized: bigint,
  validFrom: number,
  validTo: number,
  oracle: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();

  const [slabState] = findSlabStatePda(marketId);

  const data = Buffer.alloc(128);
  data.writeUInt8(DISCRIMINATORS.POST_ORACLE, 0);
  // Add nowcast, realized, validFrom, validTo...

  const ix = new TransactionInstruction({
    programId: SLAB_PROGRAM_ID,
    keys: [
      { pubkey: oracle, isSigner: true, isWritable: false },
      { pubkey: slabState, isSigner: false, isWritable: true },
    ],
    data,
  });

  tx.add(ix);

  return tx;
}

/**
 * Liquidate an undercollateralized position
 */
export async function liquidate(
  marketId: PublicKey,
  trader: PublicKey,
  instrumentIndex: number,
  size: bigint,
  side: Side,
  liquidator: PublicKey,
  payer: PublicKey
): Promise<Transaction> {
  const tx = new Transaction();

  const [slabState] = findSlabStatePda(marketId);
  const [position] = findPositionPda(trader, slabState, instrumentIndex);

  const data = Buffer.alloc(128);
  data.writeUInt8(DISCRIMINATORS.LIQUIDATE, 0);
  // Add size, side...

  const ix = new TransactionInstruction({
    programId: SLAB_PROGRAM_ID,
    keys: [
      { pubkey: liquidator, isSigner: true, isWritable: true },
      { pubkey: trader, isSigner: false, isWritable: true },
      { pubkey: slabState, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
    ],
    data,
  });

  tx.add(ix);

  return tx;
}

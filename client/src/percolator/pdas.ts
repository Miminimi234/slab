/**
 * Percolator PDA (Program Derived Address) Helpers
 * All PDAs for Router and Slab programs
 */

import { PublicKey } from "@solana/web3.js";
import { Buffer } from "../lib/bufferPolyfill";

// Program IDs from environment
export const ROUTER_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_ROUTER_ID || "RoutR1VdCpHqj89WEMJhb6TkGT9cPfr1rVjhM3e2YQr"
);

export const SLAB_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_SLAB_CODE_HASH || "SLabZ6PsDLh2X6HzEoqxFDMqCVcJXDKCNEYuPzUvGPk"
);

/**
 * Find vault PDA for a given mint
 * Seeds: [b"vault", mint]
 */
export function findVaultPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), mint.toBuffer()],
    ROUTER_PROGRAM_ID
  );
}

/**
 * Find escrow PDA for user, slab, and mint
 * Seeds: [b"escrow", user, slab, mint]
 */
export function findEscrowPda(
  user: PublicKey,
  slab: PublicKey,
  mint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      user.toBuffer(),
      slab.toBuffer(),
      mint.toBuffer(),
    ],
    ROUTER_PROGRAM_ID
  );
}

/**
 * Find cap PDA for user, slab, mint, and nonce
 * Seeds: [b"cap", user, slab, mint, nonce_u64]
 */
export function findCapPda(
  user: PublicKey,
  slab: PublicKey,
  mint: PublicKey,
  nonce: bigint
): [PublicKey, number] {
  const nonceBuffer = Buffer.allocUnsafe(8);
  nonceBuffer.writeBigUInt64LE(nonce);

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("cap"),
      user.toBuffer(),
      slab.toBuffer(),
      mint.toBuffer(),
      nonceBuffer,
    ],
    ROUTER_PROGRAM_ID
  );
}

/**
 * Find portfolio PDA for a user
 * Seeds: [b"portfolio", user]
 */
export function findPortfolioPda(user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("portfolio"), user.toBuffer()],
    ROUTER_PROGRAM_ID
  );
}

/**
 * Find registry PDA (global)
 * Seeds: [b"registry"]
 */
export function findRegistryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("registry")],
    ROUTER_PROGRAM_ID
  );
}

/**
 * Find slab state PDA for a market ID
 * Seeds: [b"slab", marketId]
 */
export function findSlabStatePda(marketId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("slab"), marketId.toBuffer()],
    SLAB_PROGRAM_ID
  );
}

/**
 * Find slab authority PDA for a slab
 * Seeds: [b"authority", slab]
 */
export function findSlabAuthorityPda(slab: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("authority"), slab.toBuffer()],
    SLAB_PROGRAM_ID
  );
}

/**
 * Find hold receipt PDA for a hold ID
 * Seeds: [b"hold", holdId]
 */
export function findHoldPda(holdId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("hold"), holdId.toBuffer()],
    SLAB_PROGRAM_ID
  );
}

/**
 * Find position PDA for trader and instrument
 * Seeds: [b"position", trader, slab, instrumentIndex]
 */
export function findPositionPda(
  trader: PublicKey,
  slab: PublicKey,
  instrumentIndex: number
): [PublicKey, number] {
  const indexBuffer = Buffer.allocUnsafe(2);
  indexBuffer.writeUInt16LE(instrumentIndex);

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("position"),
      trader.toBuffer(),
      slab.toBuffer(),
      indexBuffer,
    ],
    SLAB_PROGRAM_ID
  );
}

/**
 * Percolator SDK - Solana Perpetuals Trading
 * 
 * Main entry point for the Percolator TypeScript client SDK
 * Exports all modules for interacting with Router and Slab programs
 */

// Core connection and utilities
export * from "./connection";
export * from "./types";
export * from "./pdas";

// Transaction builders
export * as router from "./router";
export * as slab from "./slab";

// High-level trading flows
export * from "./flows";

// Program IDs
export { ROUTER_PROGRAM_ID, SLAB_PROGRAM_ID } from "./pdas";

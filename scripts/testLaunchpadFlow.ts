import express from "express";
import { AddressInfo } from "node:net";
import "dotenv/config";
import { registerRoutes } from "../server/routes";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const METADATA_URI =
  process.env.TEST_METADATA_URI ||
  "https://arweave.net/FpGhu8NZC9PaXh8HBnaBEc8A4Tgg3PYRcZA93dqpNs68";

async function main() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const server = await registerRoutes(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address() as AddressInfo | null;
  if (!address) {
    throw new Error("Failed to start test server");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Launchpad test server running at ${baseUrl}`);

  const lamportsPerSol = 1_000_000_000;
  const initialSol = Number(process.env.TEST_INITIAL_SOL ?? "0.1");
  const fundraisingTarget = Math.round(initialSol * lamportsPerSol);

  const decimals = 6;
  const totalTokens = 1_000_000_000;
  const tokensForSale = Math.floor((totalTokens * 80) / 100);
  const scale = Math.pow(10, decimals);
  const totalSupplyAtomic = (totalTokens * scale).toString();
  const tokensToSellAtomic = (tokensForSale * scale).toString();

  const walletPrivateKey = process.env.WALLET_PRIVATE_KEY;
  if (!walletPrivateKey) {
    throw new Error("WALLET_PRIVATE_KEY is required for create flow test");
  }

  const secret = decodePrivateKey(walletPrivateKey);
  const keypair = Keypair.fromSecretKey(secret);

  const validationPayload = {
    name: "SLAB Devnet Token",
    symbol: "SLBD",
    uri: METADATA_URI,
    totalSupply: totalSupplyAtomic,
    tokensToSell: tokensToSellAtomic,
    fundraisingTarget: fundraisingTarget.toString(),
    decimals,
  };

  const validateRes = await fetch(`${baseUrl}/api/launchpad/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validationPayload),
  });
  const validateJson = await validateRes.json();
  console.log("Validation status:", validateRes.status, validateJson);

  if (!validateRes.ok) {
    throw new Error("Validation failed");
  }

  const createPayload = {
    walletPublicKey: keypair.publicKey.toBase58(),
    tokenMint: "",
    name: validationPayload.name,
    symbol: validationPayload.symbol,
    uri: validationPayload.uri,
    totalSupply: validationPayload.totalSupply,
    tokensToSell: validationPayload.tokensToSell,
    fundraisingTarget: validationPayload.fundraisingTarget,
    migrateType: "cpmm" as const,
    decimals,
    buyAmount: (1 * lamportsPerSol).toString(),
    creatorFeeOn: true,
    createOnly: false,
  };

  const createRes = await fetch(`${baseUrl}/api/launchpad/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createPayload),
  });
  const createJson = await createRes.json();
  console.log("Create status:", createRes.status, createJson);

  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function decodePrivateKey(key: string): Uint8Array {
  const trimmed = key.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const parsed = JSON.parse(trimmed) as number[];
    return Uint8Array.from(parsed);
  }

  try {
    return bs58.decode(trimmed);
  } catch {
    throw new Error("Failed to decode private key");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

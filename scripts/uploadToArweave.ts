import Bundlr from "@bundlr-network/client";
import BigNumber from "bignumber.js";
import bs58 from "bs58";
import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import mime from "mime";

type CLIOptions = {
  filePath: string;
  contentType?: string;
};

function parseArgs(): CLIOptions {
  const [, , filePath, contentType] = process.argv;

  if (!filePath) {
    console.error("Usage: npm run upload:arweave <filePath> [content-type]");
    process.exit(1);
  }

  return { filePath, contentType };
}

async function ensureFunds(bundlr: Bundlr, price: BigNumber) {
  const loadedBalance = await bundlr.getLoadedBalance();

  if (loadedBalance.gte(price)) {
    return;
  }

  const buffer = price
    .minus(loadedBalance)
    .multipliedBy(1.1)
    .integerValue(BigNumber.ROUND_CEIL);

  console.log(
    `Funding Bundlr node with ${bundlr.utils.fromAtomic(
      buffer
    )} ${bundlr.currency}`
  );
  await bundlr.fund(buffer);
}

async function main() {
  const { filePath, contentType } = parseArgs();

  const resolvedPath = path.resolve(process.cwd(), filePath);
  const data = await fs.readFile(resolvedPath);

  const nodeUrl =
    process.env.BUNDLR_NODE_URL ?? "https://devnet.bundlr.network";
  const currency = process.env.BUNDLR_CURRENCY ?? "solana";
  const privateKey = process.env.BUNDLR_PRIVATE_KEY;
  const providerUrl =
    process.env.BUNDLR_PROVIDER_URL ?? "https://api.devnet.solana.com";

  if (!privateKey) {
    console.error(
      "BUNDLR_PRIVATE_KEY missing. Add it to your environment (base58 Solana secret)."
    );
    process.exit(1);
  }

  const bundlr = new Bundlr(nodeUrl, currency, decodePrivateKey(privateKey), {
    providerUrl,
  });

  console.log(
    `Connected to Bundlr node ${nodeUrl} with currency ${currency}. Loading...`
  );
  await bundlr.ready();

  const type =
    contentType ??
    mime.getType(resolvedPath) ??
    "application/octet-stream";

  const price = await bundlr.getPrice(data.length);
  console.log(
    `Upload cost: ${bundlr.utils.fromAtomic(
      price
    )} ${bundlr.currency}`
  );

  await ensureFunds(bundlr, price);

  console.log("Uploading file to Arweave via Bundlr...");
  const receipt = await bundlr.upload(data, {
    tags: [{ name: "Content-Type", value: type }],
  });

  const arweaveUrl = `https://arweave.net/${receipt.id}`;
  console.log("Upload successful!");
  console.log(`Transaction ID: ${receipt.id}`);
  console.log(`Arweave URL: ${arweaveUrl}`);
}

function decodePrivateKey(key: string): Uint8Array | string {
  const trimmed = key.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const arr = JSON.parse(trimmed) as number[];
      return Uint8Array.from(arr);
    } catch (error) {
      console.warn("Failed to parse JSON key, falling back to raw string.", error);
    }
  }

  try {
    return bs58.decode(trimmed);
  } catch {
    return trimmed;
  }
}

main().catch((error) => {
  console.error("Failed to upload file:", error);
  process.exit(1);
});

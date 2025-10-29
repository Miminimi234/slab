// src/lib/raydiumClient.ts
import {
    DEV_API_URLS,
    DEVNET_PROGRAM_ID,
    getPdaLaunchpadConfigId,
    LAUNCHPAD_PROGRAM,
    LaunchpadConfig,
    Raydium,
    TxBuilder,
    TxVersion,
} from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT } from "@solana/spl-token";
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    TransactionMessage,
    VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import "./bufferPolyfill";

// Monkey patch TxBuilder size checks to inspect instruction sizes when they fail
const txBuilderProto = (TxBuilder as unknown as { prototype: Record<string, any> }).prototype;
if (txBuilderProto && !txBuilderProto.__slabSizeLoggerPatched) {
    const originalSizeCheckBuild = txBuilderProto.sizeCheckBuild;
    const originalSizeCheckBuildV0 = txBuilderProto.sizeCheckBuildV0;
    const originalBuildV0 = txBuilderProto.buildV0;

    const logInstructionSizes = function (this: any, label: string) {
        try {
            const instructions: any[] = this.allInstructions || [];
            console.warn(`[WARN] ${label} failed size check. Instruction count:`, instructions.length);
            instructions.forEach((instruction: any, idx: number) => {
                try {
                    const tx = new Transaction();
                    tx.add(instruction);
                    tx.recentBlockhash = Keypair.generate().publicKey.toBase58();
                    tx.feePayer = Keypair.generate().publicKey;
                    const base64Length = Buffer.from(
                        tx.serialize({ verifySignatures: false })
                    ).toString("base64").length;
                    const accountCount = instruction?.keys?.length ?? 0;
                    const dataLength = instruction?.data?.length ?? 0;
                    const programId = instruction?.programId?.toBase58?.()
                        ?? instruction?.programId?.toString?.()
                        ?? "unknown-program";
                    console.warn(
                        `[WARN] Instruction ${idx} base64 length: ${base64Length} | accounts: ${accountCount} | data bytes: ${dataLength} | programId: ${programId}`
                    );
                    if (Array.isArray(instruction?.keys)) {
                        const accountList = instruction.keys
                            .map((meta: any, metaIdx: number) => {
                                const pubkey = meta?.pubkey?.toBase58?.()
                                    ?? meta?.pubkey?.toString?.()
                                    ?? `unknown-${metaIdx}`;
                                const flags = `${meta?.isSigner ? "S" : "-"}${meta?.isWritable ? "W" : "-"}`;
                                return `${metaIdx}:${flags}:${pubkey}`;
                            })
                            .join(", ");
                        console.warn(`[WARN] Instruction ${idx} accounts: ${accountList}`);
                    }
                    if (instruction?.data) {
                        const hexPreview = instruction.data.subarray(0, 32).toString("hex");
                        console.warn(
                            `[WARN] Instruction ${idx} data[0..32] hex preview: ${hexPreview}`
                        );
                    }

                    try {
                        const msg = new TransactionMessage({
                            payerKey: tx.feePayer!,
                            recentBlockhash: tx.recentBlockhash!,
                            instructions: [instruction],
                        }).compileToV0Message();
                        const versioned = new VersionedTransaction(msg);
                        const raw = versioned.serialize();
                        console.warn(
                            `[WARN] Instruction ${idx} VersionedTransaction byteLen: ${raw.length}`
                        );
                    } catch (serialError) {
                        console.warn("[WARN] Unable to compute versioned tx length:", serialError);
                    }
                } catch (instructionError) {
                    console.warn(`[WARN] Failed to measure instruction ${idx}:`, instructionError);
                }
            });
        } catch (outerError) {
            console.warn("[WARN] Unable to log instruction sizes:", outerError);
        }
    };

    txBuilderProto.sizeCheckBuild = async function (...args: any[]) {
        try {
            return await originalSizeCheckBuild.apply(this, args);
        } catch (error) {
            logInstructionSizes.call(this, "Legacy transaction");
            throw error;
        }
    };

    txBuilderProto.sizeCheckBuildV0 = async function (...args: any[]) {
        try {
            return await originalSizeCheckBuildV0.apply(this, args);
        } catch (error) {
            logInstructionSizes.call(this, "Versioned transaction");
            const instructions: any[] = this.allInstructions || [];
            try {
                if (instructions.length > 0 && typeof originalBuildV0 === "function") {
                    const fallback = await originalBuildV0.apply(this, args);
                    const serialized = fallback?.transaction?.serialize?.();
                    if (serialized) {
                        const byteLength = serialized.length;
                        const base64Length = Buffer.from(serialized).toString("base64").length;
                        console.warn(
                            `[WARN] Fallback buildV0 succeeded (bytes=${byteLength}, base64=${base64Length}). Bypassing Raydium size check.`
                        );
                        if (byteLength < 1232) {
                            return fallback;
                        }
                        console.warn(
                            `[WARN] Fallback transaction still exceeds Solana max size. Allowing original error to propagate.`
                        );
                    }
                }
            } catch (fallbackError) {
                console.warn("[WARN] Fallback buildV0 attempt failed:", fallbackError);
            }
            throw error;
        }
    };

    txBuilderProto.__slabSizeLoggerPatched = true;
}

// -------------------------------------------------------------
// Types
// -------------------------------------------------------------
export interface LaunchpadCreateParams {
    metadata: { name: string; symbol: string; description: string; uri: string };
    buyAmount: string;
    createOnly: boolean;
    cluster: "devnet" | "mainnet";
}

// -------------------------------------------------------------
// Wallet Shim — safely normalize Phantom/Solflare adapters
// -------------------------------------------------------------
function makePureWalletAdapter(userWallet: any) {
    let pk: string;

    try {
        if (userWallet.publicKey instanceof PublicKey) {
            pk = userWallet.publicKey.toBase58();
        } else if (typeof userWallet.publicKey?.toBase58 === "function") {
            pk = userWallet.publicKey.toBase58();
        } else if (typeof userWallet.publicKey === "string") {
            // Validate it's a valid base58 string by attempting to create a PublicKey
            new PublicKey(userWallet.publicKey);
            pk = userWallet.publicKey;
        } else if (typeof userWallet.publicKey?.toString === "function") {
            const pkString = userWallet.publicKey.toString();
            // Validate it's a valid base58 string by attempting to create a PublicKey
            new PublicKey(pkString);
            pk = pkString;
        } else {
            throw new Error("[WalletAdapter] Unable to extract public key from wallet");
        }
    } catch (error) {
        console.error("[WalletAdapter] Public key extraction error:", error);
        throw new Error(`[WalletAdapter] Invalid wallet publicKey: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const publicKey = new PublicKey(pk);

    return {
        publicKey,
        signTransaction: async (tx: any) => {
            const signed = await userWallet.signTransaction(tx);
            signed.serialize = tx.serialize.bind(signed);
            return signed;
        },
        signAllTransactions: async (txs: any[]) => {
            const signed = await userWallet.signAllTransactions(txs);
            signed.forEach((s: any, i: number) => (s.serialize = txs[i].serialize.bind(s)));
            return signed;
        },
    };
}

// -------------------------------------------------------------
// Main Raydium Client SDK Wrapper
// -------------------------------------------------------------
export class RaydiumClientSDK {
    private raydium: Raydium | null = null;
    private connection: Connection;
    private cluster: "devnet" | "mainnet";

    constructor(cluster: "devnet" | "mainnet" = "devnet") {
        this.cluster = cluster;
        this.connection = new Connection(
            cluster === "devnet"
                ? "https://api.devnet.solana.com"
                : "https://api.mainnet-beta.solana.com",
            "confirmed"
        );
    }

    // -----------------------------------------------------------
    // 1️⃣ Initialize SDK with Wallet (FINAL PATCH - NON-MUTATING)
    // -----------------------------------------------------------
    async initialize(userWallet: any): Promise<Raydium> {
        console.log("[RaydiumClient] Initializing SDK...");
        console.log(
            "[RaydiumClient] User wallet:",
            userWallet.publicKey?.toBase58?.() ?? userWallet.publicKey
        );
        console.log(
            "[DEBUG] Wallet publicKey type:",
            userWallet.publicKey?.constructor?.name
        );
        console.log(
            "[DEBUG] Wallet publicKey raw value:",
            userWallet.publicKey
        );

        let normalizedWallet;
        try {
            normalizedWallet = makePureWalletAdapter(userWallet);
            console.log("[DEBUG] Normalized wallet created successfully:", normalizedWallet.publicKey.toBase58());
        } catch (error) {
            console.error("[ERROR] Failed to create normalized wallet:", error);
            throw error;
        }

        this.raydium = await Raydium.load({
            owner: normalizedWallet.publicKey,
            connection: this.connection,
            cluster: this.cluster,
            disableFeatureCheck: true,
            disableLoadToken: false,
            blockhashCommitment: "finalized",
            signAllTransactions: normalizedWallet.signAllTransactions,
            ...(this.cluster === "devnet"
                ? {
                    urlConfigs: {
                        ...DEV_API_URLS,
                        BASE_HOST: "https://api-v3-devnet.raydium.io",
                        OWNER_BASE_HOST: "https://owner-v1-devnet.raydium.io",
                        SWAP_HOST: "https://transaction-v1-devnet.raydium.io",
                        CPMM_LOCK:
                            "https://dynamic-ipfs-devnet.raydium.io/lock/cpmm/position",
                    },
                }
                : {}),
        });

        (this.raydium as any)._normalizedWallet = normalizedWallet;
        this.raydium.setSignAllTransactions(normalizedWallet.signAllTransactions);
        (this.raydium as any)._normalizedWallet = normalizedWallet;
        const raydiumOwner: any = this.raydium.owner;
        console.log(
            "[DEBUG] Raydium owner initialized:",
            {
                type: raydiumOwner?.constructor?.name,
                hasOwner: !!raydiumOwner,
                ownerIsKeypair: raydiumOwner?.isKeyPair ?? false,
                publicKey: raydiumOwner?.publicKey?.toBase58?.() ?? "N/A",
            }
        );

        console.log("[RaydiumClient] SDK initialized with browser wallet adapter");
        return this.raydium;
    }

    // -----------------------------------------------------------
    // 2️⃣ Create Launchpad Pool (FINAL PATCH - DEEP SANITIZATION)
    // -----------------------------------------------------------
    async createLaunchpad(params: LaunchpadCreateParams, userWallet: any) {
        if (!this.raydium) throw new Error("Call initialize() first");

        // Use the already normalized wallet from initialization
        const normalizedWallet = (this.raydium as any)._normalizedWallet || makePureWalletAdapter(userWallet);

        const { metadata } = params;
        console.log(
            "[RaydiumClient] Creating launchpad following official SDK pattern..."
        );

        // --- Mint Keypair ---
        const mintKeypair = Keypair.generate();
        const mintA = new PublicKey(mintKeypair.publicKey.toBase58());

        // --- Configs ---
        const programId = new PublicKey(
            this.cluster === "devnet"
                ? DEVNET_PROGRAM_ID.LAUNCHPAD_PROGRAM
                : LAUNCHPAD_PROGRAM
        );
        const configId = new PublicKey(
            getPdaLaunchpadConfigId(programId, NATIVE_MINT, 0, 0).publicKey
        );

        const configData = await this.raydium!.connection.getAccountInfo(configId);
        if (!configData) throw new Error("config not found");
        const configInfo = LaunchpadConfig.decode(configData.data);
        const mintBInfo = await this.raydium!.token.getTokenInfo(configInfo.mintB);

        // --- Parameters ---
        const buyAmountBN = new BN(params.buyAmount || "0");
        const platformIdStr = import.meta.env.VITE_SLAB_PLATFORM_CONFIG_ID ||
            "9s82BCAuWCtXub1MytzfH93LG2cRM41YEF8CYTZpc8w5";

        console.log("[DEBUG] Platform ID from env:", import.meta.env.VITE_SLAB_PLATFORM_CONFIG_ID);
        console.log("[DEBUG] Using platform ID:", platformIdStr);

        const slabPlatformId = new PublicKey(platformIdStr);

        console.log("[DEBUG] Parameters:", {
            buyAmount: params.buyAmount,
            buyAmountBN: buyAmountBN.toString(),
            createOnly: params.createOnly,
            metadata: metadata.name
        });

        console.log("[DEBUG] About to call createLaunchpad...");
        const metadataUriLength = metadata.uri?.length ?? 0;
        console.log("[DEBUG] Metadata URI length:", metadataUriLength);
        if (typeof metadata.uri === "string") {
            const preview = metadata.uri.length > 120
                ? `${metadata.uri.slice(0, 120)}...`
                : metadata.uri;
            console.log("[DEBUG] Metadata URI preview:", preview);
        }
        if (metadataUriLength > 512 && typeof metadata.uri === "string") {
            console.warn(
                "[WARN] Metadata URI exceeds 512 characters (will increase transaction size)",
                metadata.uri.substring(0, 256) + "..."
            );
        }

        try {
            // Create the launchpad with minimal parameters to avoid transaction size issues
            const createParams = {
                programId: programId,
                mintA: mintA,
                decimals: 6,
                name: metadata.name.substring(0, 32), // Limit name length
                symbol: metadata.symbol.substring(0, 10), // Limit symbol length
                migrateType: "amm" as const,
                uri: metadata.uri,
                configId: configId,
                configInfo,
                mintBDecimals: mintBInfo.decimals,
                platformId: slabPlatformId, // Always include platformId
                txVersion: TxVersion.V0, // Use versioned transactions for larger instruction capacity
                slippage: new BN(500), // 5% slippage
                buyAmount: buyAmountBN,
                createOnly: true,
                extraSigners: [mintKeypair],
            };

            console.log("[DEBUG] CreateLaunchpad params:", createParams);

            const launchpadBuild = await this.raydium!.launchpad.createLaunchpad(createParams);
            const lookupTables = (launchpadBuild as any)?.builder?.lookupTableAddress;
            console.log("[DEBUG] Builder lookup tables:", lookupTables);
            const builderRef = (launchpadBuild as any)?.builder;
            if (builderRef) {
                const defaultLut = this.cluster === "devnet"
                    ? "EFhMuDw1PKEuckuFRW9PavNfTH4LKP5uKHgyXDmWpFCq"
                    : "AcL1Vo8oy1ULiavEcjSUcwfBSForXMudcZvDZy5nzJkU";
                const existing = Array.isArray(builderRef.lookupTableAddress)
                    ? builderRef.lookupTableAddress
                    : [];
                if (!existing.includes(defaultLut)) {
                    builderRef.lookupTableAddress = [...existing, defaultLut];
                }
                console.log("[DEBUG] Applied default LUT:", builderRef.lookupTableAddress);
            }
            const { execute, extInfo } = launchpadBuild;

            const builderInstructions = (launchpadBuild as any)?.builder?.allInstructions ?? [];
            console.log("[DEBUG] Instruction count:", builderInstructions.length);
            builderInstructions.forEach((instruction: any, idx: number) => {
                try {
                    const tx = new Transaction();
                    tx.add(instruction);
                    const blockhash = Keypair.generate().publicKey.toBase58();
                    tx.recentBlockhash = blockhash;
                    tx.feePayer = Keypair.generate().publicKey;
                    const sizeBase64 = Buffer.from(
                        tx.serialize({ verifySignatures: false })
                    ).toString("base64").length;
                    console.log(`[DEBUG] Instruction ${idx} base64 length:`, sizeBase64);
                } catch (instructionError) {
                    console.warn(`[WARN] Failed to measure instruction ${idx} size:`, instructionError);
                }
            });

            console.log("[DEBUG] Launchpad transaction built, executing...");

            // Execute transactions
            const sentInfo = await execute({
                sequentially: true
            });

            console.log("[SUCCESS] Launchpad created!");
            console.log("poolId:", extInfo);
            console.log("sentInfo:", sentInfo);

            return {
                success: true,
                txIds: sentInfo.txIds,
                mintAddress: mintA.toBase58(),
                poolId: extInfo?.toString() || "unknown",
            };
        } catch (e: any) {
            console.error("[ERROR] Launchpad creation failed:", e);
            return {
                success: false,
                error: e.message || "Unknown error",
                details: e,
            };
        }
    }
}

// -------------------------------------------------------------
// Singleton Export
// -------------------------------------------------------------
export const raydiumClient = new RaydiumClientSDK(
    process.env.NODE_ENV === "development" ? "devnet" : "mainnet"
);

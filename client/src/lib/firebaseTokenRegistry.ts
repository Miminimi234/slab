import { ref, set } from "firebase/database";

import { getFirebaseDatabase, hasFirebaseConfig } from "./firebaseClient";

export interface TokenRegistryRecord {
    mintAddress: string;
    name: string;
    symbol: string;
    imageUrl?: string;
    description?: string;
    deployer: string;
    createdAt?: string;
}

const sanitizeRecord = (record: TokenRegistryRecord) => {
    const trimmedDescription = record.description?.trim();
    return {
        mintAddress: record.mintAddress,
        name: record.name.trim(),
        symbol: record.symbol.trim(),
        imageUrl: record.imageUrl?.trim() || null,
        description: trimmedDescription && trimmedDescription.length > 0 ? trimmedDescription : null,
        deployer: record.deployer.trim(),
        createdAt: record.createdAt ?? new Date().toISOString(),
    };
};

export const persistTokenRecord = async (record: TokenRegistryRecord): Promise<boolean> => {
    if (!record.mintAddress || !record.name || !record.symbol || !record.deployer) {
        console.warn("[Firebase] Missing required token registry fields", record);
        return false;
    }

    if (!hasFirebaseConfig()) {
        console.warn("[Firebase] Configuration missing. Skipping token registry persistence.");
        return false;
    }

    const db = getFirebaseDatabase();
    if (!db) {
        console.warn("[Firebase] Database unavailable. Skipping token registry persistence.");
        return false;
    }

    const normalized = sanitizeRecord(record);
    try {
        await set(ref(db, `tokens/${normalized.mintAddress}`), normalized);
        console.info(`[Firebase] Stored token registry entry for ${normalized.mintAddress}`);
        return true;
    } catch (error) {
        console.error("[Firebase] Failed to persist token record", error);
        throw error instanceof Error ? error : new Error(String(error));
    }
};

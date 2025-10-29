import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    databaseURL: string;
    projectId: string;
    appId: string;
    storageBucket?: string;
    messagingSenderId?: string;
}

const configFromEnv = (): FirebaseConfig | null => {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim();
    const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
    const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL?.trim();
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
    const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim();
    const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim();
    const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim();

    const requiredEntries: Record<string, string | undefined> = {
        VITE_FIREBASE_API_KEY: apiKey,
        VITE_FIREBASE_AUTH_DOMAIN: authDomain,
        VITE_FIREBASE_DATABASE_URL: databaseURL,
        VITE_FIREBASE_PROJECT_ID: projectId,
        VITE_FIREBASE_APP_ID: appId,
    };

    const missing = Object.entries(requiredEntries)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missing.length > 0) {
        console.warn(`[Firebase] Missing env vars: ${missing.join(", ")}`);
        return null;
    }

    return {
        apiKey: apiKey!,
        authDomain: authDomain!,
        databaseURL: databaseURL!,
        projectId: projectId!,
        appId: appId!,
        storageBucket: storageBucket || undefined,
        messagingSenderId: messagingSenderId || undefined,
    };
};

let cachedApp: FirebaseApp | null = null;
let cachedDb: Database | null = null;
let loggedAppInit = false;

export const getFirebaseApp = (): FirebaseApp | null => {
    if (cachedApp) return cachedApp;

    const config = configFromEnv();
    if (!config) {
        return null;
    }

    try {
        cachedApp = getApps().length ? getApp() : initializeApp(config);
        if (!loggedAppInit) {
            console.info(`[Firebase] App ready for project ${config.projectId}`);
            loggedAppInit = true;
        }
    } catch (error) {
        console.warn("[Firebase] Failed to initialize app", error);
        return null;
    }

    return cachedApp;
};

export const getFirebaseDatabase = (): Database | null => {
    if (cachedDb) return cachedDb;

    const app = getFirebaseApp();
    if (!app) {
        return null;
    }

    try {
        cachedDb = getDatabase(app);
    } catch (error) {
        console.warn("[Firebase] Failed to initialize database", error);
        return null;
    }

    return cachedDb;
};

export const hasFirebaseConfig = (): boolean => configFromEnv() !== null;

import { useEffect, useMemo, useRef, useState } from "react";

export type GmgnBucketKey = "new" | "nearCompletion" | "completed";

export interface GmgnBuckets {
    new: any[];
    nearCompletion: any[];
    completed: any[];
}

interface GmgnStatus {
    isLoading: boolean;
    isConnected: boolean;
    error: string | null;
    lastUpdatedAt: number | null;
}

interface UseGmgnScopeFeedResult {
    buckets: GmgnBuckets;
    status: GmgnStatus;
}

interface GmgnSnapshotResponse {
    new?: any[];
    nearCompletion?: any[];
    completed?: any[];
    lastNewUpdate?: number;
    lastStatusUpdate?: number;
}

interface GmgnStreamMessage {
    type: string;
    tokens?: any[];
    data?: {
        new?: any[];
        nearCompletion?: any[];
        completed?: any[];
    };
    timestamp?: number;
}

const INITIAL_BUCKETS: GmgnBuckets = {
    new: [],
    nearCompletion: [],
    completed: [],
};

const MAX_NEW_CACHE = 50;
const RETRY_DELAY_MS = 5_000;

function resolveTokenKey(token: any): string {
    if (!token) {
        return "";
    }

    return (
        (typeof token.address === "string" && token.address) ||
        (typeof token.token === "string" && token.token) ||
        (typeof token.id === "string" && token.id) ||
        (typeof token.signature === "string" && token.signature) ||
        JSON.stringify(token)
    );
}

function mergeNewTokens(incoming: any[], existing: any[]): any[] {
    if (incoming.length === 0) {
        return existing;
    }

    const seen = new Set<string>();
    const merged: any[] = [];

    for (const token of [...incoming, ...existing]) {
        const key = resolveTokenKey(token);
        if (!key || seen.has(key)) {
            continue;
        }

        seen.add(key);
        merged.push(token);

        if (merged.length >= MAX_NEW_CACHE) {
            break;
        }
    }

    return merged;
}

function applyTokenUpdates(updatedTokens: any[], current: any[]): any[] {
    if (updatedTokens.length === 0 || current.length === 0) {
        return current;
    }

    const map = new Map(current.map((token) => [resolveTokenKey(token), token]));

    for (const updated of updatedTokens) {
        const key = resolveTokenKey(updated);
        if (!key) {
            continue;
        }

        if (map.has(key)) {
            map.set(key, updated);
        }
    }

    return Array.from(map.values());
}

export function useGmgnScopeFeed(): UseGmgnScopeFeedResult {
    const [buckets, setBuckets] = useState<GmgnBuckets>(INITIAL_BUCKETS);
    const [status, setStatus] = useState<GmgnStatus>({
        isLoading: true,
        isConnected: false,
        error: null,
        lastUpdatedAt: null,
    });

    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    const updateStatus = (partial: Partial<GmgnStatus>) => {
        setStatus((prev) => ({
            ...prev,
            ...partial,
        }));
    };

    useEffect(() => {
        let cancelled = false;

        async function fetchSnapshot() {
            try {
                const response = await fetch("/api/gmgn/tokens", {
                    credentials: "same-origin",
                });

                if (!response.ok) {
                    throw new Error(`Snapshot request failed with status ${response.status}`);
                }

                const json = (await response.json()) as GmgnSnapshotResponse;
                if (cancelled) {
                    return;
                }

                setBuckets({
                    new: Array.isArray(json.new) ? json.new.slice(0, MAX_NEW_CACHE) : [],
                    nearCompletion: Array.isArray(json.nearCompletion) ? json.nearCompletion : [],
                    completed: Array.isArray(json.completed) ? json.completed : [],
                });

                updateStatus({
                    isLoading: false,
                    error: null,
                    lastUpdatedAt: Date.now(),
                });
            } catch (error) {
                if (cancelled) {
                    return;
                }

                const message = error instanceof Error ? error.message : "Failed to load GMGN snapshot";
                updateStatus({
                    isLoading: false,
                    error: message,
                });
            }
        }

        fetchSnapshot();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        function scheduleReconnect() {
            if (retryTimeoutRef.current) {
                return;
            }

            retryTimeoutRef.current = setTimeout(() => {
                retryTimeoutRef.current = null;
                initStream();
            }, RETRY_DELAY_MS);
        }

        function cleanupStream() {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        }

        function initStream() {
            cleanupStream();

            const source = new EventSource("/api/gmgn/tokens/stream", {
                withCredentials: false,
            });

            source.onopen = () => {
                updateStatus({
                    isConnected: true,
                    error: null,
                });
            };

            source.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data) as GmgnStreamMessage;
                    if (!payload || typeof payload !== "object") {
                        return;
                    }

                    if (payload.type === "initial_state") {
                        const snapshot = payload.data ?? {};
                        setBuckets({
                            new: Array.isArray(snapshot.new) ? snapshot.new.slice(0, MAX_NEW_CACHE) : [],
                            nearCompletion: Array.isArray(snapshot.nearCompletion) ? snapshot.nearCompletion : [],
                            completed: Array.isArray(snapshot.completed) ? snapshot.completed : [],
                        });
                        updateStatus({
                            isLoading: false,
                            lastUpdatedAt: payload.timestamp ?? Date.now(),
                        });
                        return;
                    }

                    if (payload.type === "new_tokens") {
                        const tokens = Array.isArray(payload.tokens) ? payload.tokens : [];
                        if (tokens.length === 0) {
                            return;
                        }

                        setBuckets((prev) => ({
                            ...prev,
                            new: mergeNewTokens(tokens, prev.new),
                        }));
                        updateStatus({ lastUpdatedAt: payload.timestamp ?? Date.now() });
                        return;
                    }

                    if (payload.type === "token_updates") {
                        const tokens = Array.isArray(payload.tokens) ? payload.tokens : [];
                        if (tokens.length === 0) {
                            return;
                        }

                        setBuckets((prev) => ({
                            ...prev,
                            new: applyTokenUpdates(tokens, prev.new),
                        }));
                        updateStatus({ lastUpdatedAt: payload.timestamp ?? Date.now() });
                        return;
                    }

                    if (payload.type === "near_completion_snapshot") {
                        const tokens = Array.isArray(payload.tokens) ? payload.tokens : [];
                        setBuckets((prev) => ({
                            ...prev,
                            nearCompletion: tokens,
                        }));
                        updateStatus({ lastUpdatedAt: payload.timestamp ?? Date.now() });
                        return;
                    }

                    if (payload.type === "completed_snapshot") {
                        const tokens = Array.isArray(payload.tokens) ? payload.tokens : [];
                        setBuckets((prev) => ({
                            ...prev,
                            completed: tokens,
                        }));
                        updateStatus({ lastUpdatedAt: payload.timestamp ?? Date.now() });
                        return;
                    }
                } catch (error) {
                    console.warn("[GMGN] Failed to parse SSE payload", error);
                }
            };

            source.onerror = () => {
                updateStatus({
                    isConnected: false,
                });
                scheduleReconnect();
            };

            eventSourceRef.current = source;
        }

        initStream();

        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
            cleanupStream();
        };
    }, []);

    const memoized = useMemo<UseGmgnScopeFeedResult>(() => ({
        buckets,
        status,
    }), [buckets, status]);

    return memoized;
}

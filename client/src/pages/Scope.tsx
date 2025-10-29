import { TokenAvatar } from "@/components/shared/TokenAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useGmgnScopeFeed } from "@/hooks/useGmgnScopeFeed";
import { cn } from "@/lib/utils";
import {
    Activity,
    Banknote,
    CircleDollarSign,
    Flame,
    Globe,
    MessageCircle,
    Rocket,
    Sparkles,
    TrendingUp,
    Twitter,
    Users,
} from "lucide-react";
import type { ComponentType, KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

type Tone = "emerald" | "amber" | "cyan" | "violet";
type StatTone = "positive" | "negative" | "neutral";

interface ScopeTokenRow {
    id: string;
    name: string;
    symbol: string;
    avatarUrl?: string;
    createdAtMs: number;
    status: {
        label: string;
        tone: Tone;
    };
    launchpad: string;
    age: string;
    marketCap: string;
    fdv: string;
    price: string;
    changePct: number;
    stats: Array<{ label: string; value: string; tone?: StatTone }>;
    tags?: string[];
    socials?: {
        twitter?: string;
        telegram?: string;
        website?: string;
        discord?: string;
    };
}

interface ScopeColumnConfig {
    key: string;
    title: string;
    summary?: string;
    description?: string;
    icon: ComponentType<{ className?: string }>;
    accentClass: string;
    filters: string[];
    entries: ScopeTokenRow[];
    emptyMessage?: string;
}

const statToneClasses: Record<StatTone, string> = {
    positive: "text-green-400",
    negative: "text-red-400",
    neutral: "text-muted-foreground",
};

const MAX_FUTURE_LEEWAY_MS = 7 * 24 * 60 * 60 * 1000;

const COMMON_TIMESTAMP_KEYS = [
    "created_timestamp",
    "create_time",
    "createdAt",
    "created_at",
    "creation_time",
    "inserted_at",
    "timestamp",
] as const;

const NEW_TIMESTAMP_KEYS = [
    "start_live_timestamp",
    "launch_timestamp",
    "dex_launch_time",
    "open_timestamp",
    "fund_from_ts",
    "fundTimestamp",
    ...COMMON_TIMESTAMP_KEYS,
] as const;

const FINAL_TIMESTAMP_KEYS = [
    "start_live_timestamp",
    "launch_timestamp",
    "dex_launch_time",
    "bond_start_timestamp",
    "bonding_start_time",
    "open_timestamp",
    ...COMMON_TIMESTAMP_KEYS,
] as const;

const MIGRATED_TIMESTAMP_KEYS = [
    "complete_timestamp",
    "dex_launch_time",
    "start_live_timestamp",
    "launch_timestamp",
    "open_timestamp",
    "fund_from_ts",
    "fundTimestamp",
    ...COMMON_TIMESTAMP_KEYS,
] as const;
const columnTemplates = [
    {
        key: "new",
        title: "New Pairs",
        icon: Sparkles,
        filters: ["All", "P1", "P2", "P3"],
        accentClass: "bg-gradient-to-br from-emerald-500/15 via-card to-card",
        bucket: "new" as const,
        emptyMessage: "Waiting for fresh launches…",
    },
    {
        key: "final",
        title: "Final Stretch",
        icon: Flame,
        filters: ["All", "P1", "P2", "Paid"],
        accentClass: "bg-gradient-to-br from-amber-500/15 via-card to-card",
        bucket: "nearCompletion" as const,
        emptyMessage: "No bonding curves in the queue right now.",
    },
    {
        key: "migrated",
        title: "Migrated",
        icon: Rocket,
        filters: ["All", "P1", "Paid", "CEX"],
        accentClass: "bg-gradient-to-br from-cyan-500/15 via-card to-card",
        bucket: "completed" as const,
        emptyMessage: "No fresh migrations just yet.",
    },
] satisfies Array<{
    key: ScopeColumnConfig["key"];
    title: ScopeColumnConfig["title"];
    icon: ScopeColumnConfig["icon"];
    filters: ScopeColumnConfig["filters"];
    accentClass: ScopeColumnConfig["accentClass"];
    bucket: "new" | "nearCompletion" | "completed";
    emptyMessage?: string;
}>;

const PLACEHOLDER_VALUE = "—";

function resolveNumber(source: any, keys: string[], fallback = 0): number {
    if (!source) {
        return fallback;
    }

    for (const key of keys) {
        const value = source[key];
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === "string" && value.trim().length > 0) {
            const numeric = Number(value.replace(/[^0-9.\-]+/g, ""));
            if (Number.isFinite(numeric)) {
                return numeric;
            }
        }
    }

    return fallback;
}

function resolveTimestamp(source: any, keys: ReadonlyArray<string>): number | undefined {
    if (!source) {
        return undefined;
    }

    let best: number | undefined;

    for (const key of keys) {
        const value = source[key];
        const interpreted = interpretTimestamp(value);
        if (interpreted !== undefined && (best === undefined || interpreted > best)) {
            best = interpreted;
        }
    }

    return best;
}

function interpretTimestamp(input: unknown): number | undefined {
    if (typeof input === "number" && Number.isFinite(input)) {
        return interpretNumericTimestamp(input);
    }

    if (typeof input === "string") {
        const trimmed = input.trim();
        if (!trimmed) {
            return undefined;
        }

        const numeric = Number(trimmed);
        if (Number.isFinite(numeric)) {
            const interpretedNumeric = interpretNumericTimestamp(numeric);
            if (interpretedNumeric !== undefined) {
                return interpretedNumeric;
            }
        }

        const parsed = Date.parse(trimmed);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }

    return undefined;
}

function interpretNumericTimestamp(value: number): number | undefined {
    const now = Date.now();
    const absValue = Math.abs(value);

    if (value < 0) {
        const deltaMs =
            absValue > 1_000_000_000_000
                ? absValue / 1000
                : absValue > 1_000_000
                    ? absValue
                    : absValue * 1000;
        const computed = now - deltaMs;
        return computed > 0 ? computed : now;
    }

    if (value > 1_000_000_000_000) {
        if (value <= now + MAX_FUTURE_LEEWAY_MS) {
            return value;
        }
        return undefined;
    }

    if (value > 1_000_000_000) {
        const secondsTs = value * 1000;
        if (secondsTs <= now + MAX_FUTURE_LEEWAY_MS) {
            return secondsTs;
        }
    }

    if (value > 1_000_000) {
        const msTimestamp = value / 1000;
        if (msTimestamp > 1_000_000_000 && msTimestamp <= now + MAX_FUTURE_LEEWAY_MS) {
            return msTimestamp;
        }
    }

    if (value > 0) {
        const assumedAgeMs = value > 10_000 ? value : value * 1000;
        const computed = now - assumedAgeMs;
        if (computed > 0) {
            return computed;
        }
    }

    return undefined;
}

function resolveString(source: any, keys: string[]): string | undefined {
    if (!source) {
        return undefined;
    }

    for (const key of keys) {
        const value = source[key];
        if (typeof value === "string" && value.trim().length > 0) {
            return value.trim();
        }
    }

    return undefined;
}

function formatCompactNumber(value: number): string {
    if (!Number.isFinite(value) || value === 0) {
        return "0";
    }

    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (abs >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (abs >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`;
    }

    return value.toFixed(0);
}

function formatUsd(value: number, fallback = PLACEHOLDER_VALUE): string {
    if (!Number.isFinite(value) || value <= 0) {
        return fallback;
    }

    if (value >= 1_000_000_000) {
        return `$${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (value >= 1_000_000) {
        return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
        return `$${(value / 1_000).toFixed(1)}K`;
    }

    return `$${value.toFixed(value >= 1 ? 2 : 4)}`;
}

function formatSignedUsd(value: number): string {
    if (!Number.isFinite(value) || value === 0) {
        return "$0";
    }

    const formatted = formatUsd(Math.abs(value));
    return value > 0 ? `+${formatted}` : `-${formatted}`;
}

function formatSignedNumber(value: number, decimals = 1): string {
    if (!Number.isFinite(value) || value === 0) {
        return "0";
    }

    const abs = Math.abs(value);
    if (abs >= 1_000) {
        const compact = formatCompactNumber(abs);
        return value > 0 ? `+${compact}` : `-${compact}`;
    }

    const precision = abs >= 10 ? 0 : decimals;
    const formatted = abs.toFixed(precision);
    return value > 0 ? `+${formatted}` : `-${formatted}`;
}

function normalizeProgress(token: any): number {
    const progress = resolveNumber(token, [
        "progress",
        "bonding_progress",
        "bonding_progress_percent",
        "progress_percent",
        "bondingPercent",
        "bonding_rate",
    ]);

    if (!Number.isFinite(progress)) {
        return 0;
    }

    let normalized = progress;
    if (normalized > 1) {
        normalized = normalized / 100;
    }

    return Math.max(0, Math.min(1, normalized));
}

function deriveStatus(columnKey: string, token: any): { label: string; tone: Tone } {
    if (columnKey === "new") {
        const progress = normalizeProgress(token);
        if (progress >= 0.85) {
            return { label: "Heating", tone: "emerald" };
        }
        if (progress >= 0.5) {
            return { label: "Bonding", tone: "emerald" };
        }
        return { label: "New", tone: "emerald" };
    }

    if (columnKey === "final") {
        const progress = normalizeProgress(token);
        if (progress >= 0.95) {
            return { label: "Queueing", tone: "amber" };
        }
        if (progress >= 0.8) {
            return { label: "Final Stretch", tone: "amber" };
        }
        return { label: "Approaching", tone: "amber" };
    }

    if (columnKey === "migrated") {
        const exchange = resolveString(token, ["exchange", "dex", "market_type"]);
        const hasLiquidity = resolveNumber(token, ["liquidity", "liquidity_usd"], 0) > 10000;

        if (exchange === "raydium" || exchange === "orca" || exchange === "jupiter") {
            return { label: "DEX Live", tone: "cyan" };
        }
        if (hasLiquidity) {
            return { label: "High Liquidity", tone: "cyan" };
        }
        if (token.complete_timestamp && token.status === 1) {
            return { label: "Graduated", tone: "cyan" };
        }
        return { label: "Post-Launch", tone: "cyan" };
    }

    return { label: "Live", tone: "cyan" };
}

function formatAge(timestampMs: number | undefined): string {
    if (!timestampMs || !Number.isFinite(timestampMs)) {
        return "0s";
    }

    const diff = Date.now() - timestampMs;
    const safeDiff = diff < 0 ? 0 : diff;
    const seconds = Math.floor(safeDiff / 1000);

    if (seconds < 60) {
        return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    if (days < 7) {
        return `${days}d`;
    }

    const weeks = Math.floor(days / 7);
    if (weeks < 5) {
        return `${weeks}w`;
    }

    const months = Math.floor(days / 30);
    if (months < 12) {
        return `${months}mo`;
    }

    const years = Math.floor(days / 365);
    return `${years}y`;
}

function normalizeLogoUrl(url: string | undefined): string | undefined {
    if (!url || typeof url !== "string") {
        return undefined;
    }

    if (url.toLowerCase().endsWith(".gif")) {
        return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }

    return url;
}

function deriveTags(token: any, columnKey: string): string[] {
    const tags = new Set<string>();

    const launchpad = resolveString(token, ["launchpad_platform", "launchpad", "platform"]);
    const chain = resolveString(token, ["chain", "chain_name", "chainId", "chain_id"]);
    const tier = resolveString(token, ["phase", "stage"]);
    const quote = resolveString(token, ["quote_symbol", "quoteSymbol"]);

    if (launchpad) {
        const normalizedLaunchpad = launchpad.trim().toLowerCase();
        if (normalizedLaunchpad !== "pump.fun" && normalizedLaunchpad !== "pump fun") {
            tags.add(launchpad);
        }
    }
    if (chain) {
        tags.add(chain);
    }
    if (tier) {
        tags.add(tier);
    }
    if (quote && quote !== "USD") {
        tags.add(quote);
    }

    return Array.from(tags).slice(0, 3);
}

function deriveLaunchpad(token: any): string {
    return (
        resolveString(token, ["launchpad_platform", "launchpad", "platform"]) ||
        resolveString(token, ["dex", "source"]) ||
        "GMGN"
    );
}

type SocialPlatform = "twitter" | "telegram" | "website" | "discord";

function normalizeSocialUrl(raw: string | undefined, platform: SocialPlatform): string | undefined {
    if (!raw || typeof raw !== "string") {
        return undefined;
    }

    let value = raw.trim();
    if (!value) {
        return undefined;
    }

    value = value.replace(/[,\s]+$/g, "");

    const invalidTokens = new Set(["n/a", "na", "none", "null", "undefined", "-", "--", "http://", "https://"]);
    if (invalidTokens.has(value.toLowerCase())) {
        return undefined;
    }

    const ensureUrlWithScheme = (input: string): string | undefined => {
        try {
            const url = new URL(input);
            return url.toString();
        } catch {
            try {
                const sanitized = input.replace(/^(?:https?:\/\/)/i, "");
                const url = new URL(`https://${sanitized}`);
                return url.toString();
            } catch {
                return undefined;
            }
        }
    };

    if (/^https?:\/\//i.test(value)) {
        if (platform === "twitter") {
            return value.replace(/twitter\.com/i, "x.com");
        }
        return value;
    }

    switch (platform) {
        case "twitter": {
            const username = value
                .replace(/^@/, "")
                .replace(/^(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\//i, "")
                .replace(/^(?:twitter|x)\.com\//i, "");
            if (!username) {
                return undefined;
            }
            return `https://x.com/${username}`;
        }
        case "telegram": {
            const handle = value
                .replace(/^@/, "")
                .replace(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\//i, "")
                .replace(/^(?:t\.me|telegram\.me)\//i, "");
            if (!handle) {
                return undefined;
            }
            return `https://t.me/${handle}`;
        }
        case "discord": {
            const invite = value
                .replace(/^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite)\//i, "")
                .replace(/^(?:discord\.gg|discord\.com\/invite)\//i, "");
            if (!invite) {
                return undefined;
            }
            return `https://discord.gg/${invite}`;
        }
        case "website":
        default:
            return ensureUrlWithScheme(value);
    }
}

function detectUrlPlatform(url: string | undefined): SocialPlatform | null {
    if (!url) {
        return null;
    }

    const lower = url.toLowerCase();
    if (lower.includes("twitter.com") || lower.includes("x.com")) {
        return "twitter";
    }
    if (lower.includes("t.me") || lower.includes("telegram.me")) {
        return "telegram";
    }
    if (lower.includes("discord.gg") || lower.includes("discord.com")) {
        return "discord";
    }
    return "website";
}

function deriveSocialLinks(token: any): ScopeTokenRow["socials"] | undefined {
    const rawTwitter = resolveString(token, ["twitter", "twitter_url", "twitterLink", "twitter_link", "x"]);
    const rawTelegram = resolveString(token, ["telegram", "telegram_url", "telegramLink", "telegram_link", "tg"]);
    const rawDiscord = resolveString(token, ["discord", "discord_url", "discordLink", "discord_link"]);
    let rawWebsite = resolveString(token, ["website", "website_url", "site", "homepage", "official_site", "officialWebsite"]);

    const websitePlatform = detectUrlPlatform(rawWebsite);

    const socials: ScopeTokenRow["socials"] = {};

    let twitter = normalizeSocialUrl(rawTwitter, "twitter");
    let telegram = normalizeSocialUrl(rawTelegram, "telegram");
    let discord = normalizeSocialUrl(rawDiscord, "discord");

    if (websitePlatform === "twitter" && !twitter) {
        twitter = normalizeSocialUrl(rawWebsite, "twitter");
        rawWebsite = undefined;
    } else if (websitePlatform === "telegram" && !telegram) {
        telegram = normalizeSocialUrl(rawWebsite, "telegram");
        rawWebsite = undefined;
    } else if (websitePlatform === "discord" && !discord) {
        discord = normalizeSocialUrl(rawWebsite, "discord");
        rawWebsite = undefined;
    }

    const website = normalizeSocialUrl(rawWebsite, "website");

    if (twitter) {
        socials.twitter = twitter;
    }
    if (telegram) {
        socials.telegram = telegram;
    }
    if (discord) {
        socials.discord = discord;
    }
    if (website) {
        socials.website = website;
    }

    return Object.keys(socials).length > 0 ? socials : undefined;
}

function formatPrice(value: number, quoteSymbol?: string): string {
    if (!Number.isFinite(value) || value <= 0) {
        return quoteSymbol && quoteSymbol !== "USD" && quoteSymbol !== "USDT" ? `0 ${quoteSymbol}` : "";
    }

    const digits = value >= 1 ? 2 : value >= 0.01 ? 4 : 6;
    const formatted = value.toFixed(digits);

    if (quoteSymbol && quoteSymbol !== "USD" && quoteSymbol !== "USDT") {
        return `${formatted} ${quoteSymbol}`;
    }

    return `$${formatted}`;
}

function buildStats(token: any, columnKey: string): ScopeTokenRow["stats"] {
    const buys = resolveNumber(token, ["buys_1h", "buy_count_1h", "buys"], 0);
    const sells = resolveNumber(token, ["sells_1h", "sell_count_1h", "sells"], 0);
    const netFlow = resolveNumber(token, ["net_buy_1h", "net_inflow_usd", "netflow_usd", "net_flow"], 0);
    const volume = resolveNumber(token, ["volume_24h", "usd_volume_24h", "volume_1h"], 0);
    const holders = resolveNumber(token, ["holder_count", "holders", "total_holders"], 0);
    const liquidity = resolveNumber(token, ["liquidity", "liquidity_usd", "usd_liquidity"], 0);

    if (columnKey === "migrated") {
        // For migrated tokens, show DEX-specific stats
        const poolInfo = resolveString(token, ["quote_address", "pool_type"]);
        const poolValue = liquidity > 0 ? formatUsd(liquidity) : "Unknown";

        return [
            {
                label: "Buys",
                value: buys > 0 ? formatCompactNumber(buys) : "0",
                tone: buys > sells ? "positive" : undefined,
            },
            {
                label: "Sells",
                value: sells > 0 ? formatCompactNumber(sells) : "0",
                tone: sells > buys ? "negative" : undefined,
            },
            {
                label: "Liquidity",
                value: poolValue,
                tone: liquidity > 50000 ? "positive" : liquidity > 10000 ? "neutral" : undefined,
            },
            {
                label: "Pool",
                value: poolInfo?.includes("So111") ? "◎ SOL/USDC" : "◎ Pool",
                tone: "neutral",
            },
            {
                label: "Net Flow",
                value: netFlow !== 0 ? formatSignedUsd(netFlow) : "$0",
                tone: netFlow > 0 ? "positive" : netFlow < 0 ? "negative" : undefined,
            },
            {
                label: "24h Vol",
                value: volume > 0 ? formatUsd(volume, "$0") : "$0",
                tone: "neutral",
            },
            {
                label: "Holders",
                value: holders > 0 ? formatCompactNumber(holders) : PLACEHOLDER_VALUE,
                tone: "neutral",
            },
            {
                label: "LP Depth",
                value: liquidity > 0 ? formatUsd(liquidity, PLACEHOLDER_VALUE) : PLACEHOLDER_VALUE,
                tone: liquidity > 0 ? "neutral" : undefined,
            },
        ];
    }

    if (columnKey === "final") {
        // For bonding curve tokens approaching completion
        const progress = normalizeProgress(token);
        const bonded = resolveNumber(token, ["progress", "bonded_sol", "raised_sol"], 0) * 85; // Estimate based on progress
        const goal = 85; // Typical Pump.fun goal

        return [
            {
                label: "Buys",
                value: buys > 0 ? formatCompactNumber(buys) : "0",
                tone: buys > sells ? "positive" : undefined,
            },
            {
                label: "Sells",
                value: sells > 0 ? formatCompactNumber(sells) : "0",
                tone: sells > buys ? "negative" : undefined,
            },
            {
                label: "Bonded",
                value: bonded > 0 ? `+${bonded.toFixed(1)} SOL` : PLACEHOLDER_VALUE,
                tone: bonded > 0 ? "positive" : undefined,
            },
            {
                label: "Goal",
                value: `${goal} SOL`,
                tone: "neutral",
            },
            {
                label: "Net Flow",
                value: netFlow !== 0 ? formatSignedUsd(netFlow) : "$0",
                tone: netFlow > 0 ? "positive" : netFlow < 0 ? "negative" : undefined,
            },
            {
                label: "24h Vol",
                value: volume > 0 ? formatUsd(volume, "$0") : "$0",
                tone: "neutral",
            },
            {
                label: "Holders",
                value: holders > 0 ? formatCompactNumber(holders) : PLACEHOLDER_VALUE,
                tone: "neutral",
            },
            {
                label: "LP Size",
                value: liquidity > 0 ? formatUsd(liquidity, PLACEHOLDER_VALUE) : PLACEHOLDER_VALUE,
                tone: liquidity > 0 ? "neutral" : undefined,
            },
        ];
    }

    // Default stats for new tokens
    const lpAdds = resolveNumber(token, ["liquidity_add_count", "lp_add_count", "bond_add_count"], 0);
    const lpRem = resolveNumber(token, ["liquidity_remove_count", "lp_remove_count", "bond_remove_count"], 0);

    return [
        {
            label: "Buys",
            value: buys > 0 ? formatCompactNumber(buys) : "0",
            tone: buys > sells ? "positive" : undefined,
        },
        {
            label: "Sells",
            value: sells > 0 ? formatCompactNumber(sells) : "0",
            tone: sells > buys ? "negative" : undefined,
        },
        {
            label: "LP Adds",
            value: lpAdds > 0 ? formatSignedNumber(lpAdds) : PLACEHOLDER_VALUE,
            tone: lpAdds > 0 ? "positive" : undefined,
        },
        {
            label: "LP Rem",
            value: lpRem > 0 ? formatSignedNumber(-lpRem) : PLACEHOLDER_VALUE,
            tone: lpRem > 0 ? "negative" : undefined,
        },
        {
            label: "Net Flow",
            value: netFlow !== 0 ? formatSignedUsd(netFlow) : "$0",
            tone: netFlow > 0 ? "positive" : netFlow < 0 ? "negative" : undefined,
        },
        {
            label: "24h Vol",
            value: volume > 0 ? formatUsd(volume, "$0") : "$0",
            tone: "neutral",
        },
        {
            label: "Holders",
            value: holders > 0 ? formatCompactNumber(holders) : PLACEHOLDER_VALUE,
            tone: "neutral",
        },
        {
            label: "LP Size",
            value: liquidity > 0 ? formatUsd(liquidity, PLACEHOLDER_VALUE) : PLACEHOLDER_VALUE,
            tone: liquidity > 0 ? "neutral" : undefined,
        },
    ];
}

function normalizeGmgnToken(token: any, columnKey: string): ScopeTokenRow | null {
    if (!token || typeof token !== "object") {
        return null;
    }

    const identifier =
        resolveString(token, ["address", "token", "mint", "id"]) ||
        String(token.signature || token.txHash || "");

    if (!identifier) {
        return null;
    }

    const name = resolveString(token, ["name", "token_name", "symbol_name"]) || "Unknown";
    const symbol = resolveString(token, ["symbol", "token_symbol"]) || "???";
    const quoteSymbol = resolveString(token, ["quote_symbol", "quoteSymbol"]);
    const price = resolveNumber(token, ["usd_price", "price", "last_price"], 0);
    const marketCap = resolveNumber(token, ["usd_market_cap", "market_cap"], 0);
    const fdv = resolveNumber(token, ["usd_fdv", "fdv", "fully_diluted_valuation"], 0);
    const change = resolveNumber(token, [
        "price_change_rate_5m",
        "price_change_percent_5m",
        "price_change_rate_1h",
        "price_change_percent_1h",
        "price_change_percent",
    ], 0);
    const status = deriveStatus(columnKey, token);
    const timestampKeys =
        columnKey === "migrated"
            ? MIGRATED_TIMESTAMP_KEYS
            : columnKey === "final"
                ? FINAL_TIMESTAMP_KEYS
                : NEW_TIMESTAMP_KEYS;

    const createdAtMs = resolveTimestamp(token, timestampKeys);
    if (createdAtMs === undefined) {
        return null;
    }
    const stats = buildStats(token, columnKey);

    return {
        id: identifier,
        name,
        symbol,
        avatarUrl: normalizeLogoUrl(resolveString(token, ["logo", "icon", "image"])),
        createdAtMs,
        status,
        launchpad: deriveLaunchpad(token),
        socials: deriveSocialLinks(token),
        age: formatAge(createdAtMs),
        marketCap: formatUsd(marketCap, "$0"),
        fdv: formatUsd(fdv, "$0"),
        price: formatPrice(price, quoteSymbol),
        changePct: change,
        stats,
        tags: deriveTags(token, columnKey),
    };
}

export default function Scope() {
    const { buckets, status } = useGmgnScopeFeed();
    const [activeTab, setActiveTab] = useState(0);

    const scopeColumns = useMemo<ScopeColumnConfig[]>(() => {
        return columnTemplates.map(({ bucket, emptyMessage, ...template }) => {
            const entries = Array.isArray(buckets[bucket])
                ? buckets[bucket]
                    .map((token: any) => normalizeGmgnToken(token, template.key))
                    .filter((row): row is ScopeTokenRow => row !== null)
                : [];

            return {
                ...template,
                entries,
                emptyMessage,
            };
        });
    }, [buckets]);

    const lastUpdatedLabel = useMemo(() => {
        if (!status.lastUpdatedAt) {
            return status.isLoading ? "Waiting for feed…" : "No updates yet";
        }

        const diff = Date.now() - status.lastUpdatedAt;
        if (diff < 5_000) {
            return "just now";
        }
        if (diff < 60_000) {
            const seconds = Math.floor(diff / 1_000);
            return `${seconds}s ago`;
        }
        if (diff < 3_600_000) {
            const minutes = Math.floor(diff / 60_000);
            return `${minutes}m ago`;
        }
        const hours = Math.floor(diff / 3_600_000);
        return `${hours}h ago`;
    }, [status.lastUpdatedAt, status.isLoading]);

    return (
        <div className="w-full">
            <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between px-4 py-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-[0.3em] text-primary">
                        <TrendingUp className="h-4 w-4" />
                        Scope Pulse
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="border-primary/40 text-primary">
                        {status.isConnected ? "GMGN live" : "GMGN reconnecting"}
                    </Badge>
                    <Badge variant="outline" className="border-border/60">
                        Last sync: {lastUpdatedLabel}
                    </Badge>
                </div>
            </header>

            {/* Mobile Tabs */}
            <div className="xl:hidden px-4 mb-4">
                <div className="flex rounded-lg bg-card/80 border border-border/50 p-1 shadow-sm">
                    {scopeColumns.map((column, index) => (
                        <button
                            key={column.key}
                            onClick={() => setActiveTab(index)}
                            className={cn(
                                "flex-1 rounded-md px-3 py-2 text-sm font-semibold text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                                activeTab === index
                                    ? "bg-background text-primary shadow-md ring-1 ring-primary/10"
                                    : "text-muted-foreground hover:bg-background/5 hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-1.5 justify-center">
                                <column.icon className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">{column.title}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Desktop Grid */}
            <div className="hidden xl:grid xl:grid-cols-3">
                {scopeColumns.map((column) => (
                    <ScopeColumn key={column.key} config={column} />
                ))}
            </div>

            {/* Mobile Single Column */}
            <div className="xl:hidden">
                <ScopeColumn config={scopeColumns[activeTab]} />
            </div>
        </div>
    );
}

function ScopeColumn({ config }: { config: ScopeColumnConfig }) {
    const { title, summary, description, icon: Icon, filters, entries, accentClass, emptyMessage } = config;

    return (
        <Card
            className={cn(
                "flex h-[70vh] xl:h-[100vh] flex-col border border-border/60 bg-card/80 rounded-none xl:rounded-none rounded-lg",
                accentClass
            )}
        >
            <CardHeader className="space-y-3 border-b border-border/50 bg-background/60 p-4 xl:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="rounded-lg border border-primary/30 bg-primary/10 p-2">
                            <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-lg leading-tight">{title}</CardTitle>
                            {summary ? (
                                <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-muted-foreground">
                                    {summary}
                                </p>
                            ) : null}
                            {description ? (
                                <p className="text-xs text-muted-foreground">{description}</p>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                        {filters.map((filter, index) => (
                            <span
                                key={filter}
                                className={cn(
                                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
                                    index === 0
                                        ? "border-primary/60 bg-primary/10 text-primary"
                                        : "border-border/60 text-muted-foreground"
                                )}
                            >
                                {filter}
                            </span>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div>
                            {entries.length > 0 ? (
                                entries.map((entry) => <ScopeRow key={entry.id} entry={entry} />)
                            ) : (
                                <div className="flex h-full min-h-[180px] items-center justify-center text-xs text-muted-foreground p-4">
                                    {emptyMessage ?? "No data yet."}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </CardContent>
        </Card>
    );
}

function getMarketCapColor(marketCapString: string): string {
    const numericMatch = marketCapString.match(/[\d,.]+/);
    if (!numericMatch) return "text-muted-foreground";

    const numericValue = parseFloat(numericMatch[0].replace(/,/g, ""));
    const isMillions = marketCapString.includes("M");
    const isBillions = marketCapString.includes("B");
    const isThousands = marketCapString.includes("K");

    let actualValue = numericValue;
    if (isBillions) actualValue *= 1_000_000_000;
    else if (isMillions) actualValue *= 1_000_000;
    else if (isThousands) actualValue *= 1_000;

    if (actualValue > 1_000_000) return "font-bold text-emerald-400"; // > $1M
    if (actualValue >= 150_000) return "font-bold text-blue-400"; // 150k - 1M
    if (actualValue >= 30_000) return "font-bold text-orange-400"; // 30k - 150k
    if (actualValue > 0) return "font-bold text-yellow-400"; // up to 30k
    return "text-muted-foreground";
}

function parseMetricValue(rawValue?: string): number {
    if (!rawValue) {
        return 0;
    }

    const trimmed = rawValue.trim();
    if (!trimmed || trimmed === PLACEHOLDER_VALUE) {
        return 0;
    }

    const negative = trimmed.startsWith("-");
    const cleanedNumeric = trimmed.replace(/[^0-9.,]/g, "").replace(/,/g, "");

    if (!cleanedNumeric) {
        return 0;
    }

    const numeric = parseFloat(cleanedNumeric);
    if (!Number.isFinite(numeric)) {
        return 0;
    }

    let multiplier = 1;
    const lower = trimmed.toLowerCase();
    if (lower.includes("b")) {
        multiplier = 1_000_000_000;
    } else if (lower.includes("m")) {
        multiplier = 1_000_000;
    } else if (lower.includes("k")) {
        multiplier = 1_000;
    }

    const signedValue = negative ? -numeric : numeric;
    return signedValue * multiplier;
}

function applyToneClass(tone?: StatTone): string {
    if (!tone) {
        return "text-foreground";
    }

    return statToneClasses[tone] ?? "text-foreground";
}

function ScopeRow({ entry }: { entry: ScopeTokenRow }) {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const findStat = (label: string) => entry.stats.find((stat) => stat.label === label);
    const buysStat = findStat("Buys");
    const sellsStat = findStat("Sells");
    const netFlowStat = findStat("Net Flow");
    const volumeStat = findStat("24h Vol") ?? findStat("Volume");
    const holdersStat = findStat("Holders");
    const liquidityStat = findStat("LP Size") ?? findStat("Liquidity");
    const lpAddsStat = findStat("LP Adds");
    const lpRemStat = findStat("LP Rem");

    const buysValue = parseMetricValue(buysStat?.value);
    const sellsValue = parseMetricValue(sellsStat?.value);
    const transactionsValue = Math.max(buysValue + sellsValue, 0);
    const buyPercentage = transactionsValue > 0 ? (buysValue / transactionsValue) * 100 : 50;
    const sellPercentage = transactionsValue > 0 ? (sellsValue / transactionsValue) * 100 : 50;

    const transactionsLabel =
        transactionsValue > 0 ? formatCompactNumber(Math.round(transactionsValue)) : "0";

    const marketCapColorClass = getMarketCapColor(entry.marketCap);
    const changeLabel = Number.isFinite(entry.changePct)
        ? `${entry.changePct >= 0 ? "+" : ""}${entry.changePct.toFixed(1)}%`
        : "0%";
    const changeClass = entry.changePct >= 0 ? "text-emerald-400" : "text-rose-400";
    const volumeLabel = volumeStat?.value ?? PLACEHOLDER_VALUE;
    const netFlowLabel = netFlowStat?.value ?? "$0";
    const holdersLabel = holdersStat?.value ?? PLACEHOLDER_VALUE;
    const liquidityLabel = liquidityStat?.value ?? PLACEHOLDER_VALUE;

    const tags = entry.tags ?? [];
    const socials = entry.socials ?? {};
    const hasSocialLinks = Boolean(socials.twitter || socials.telegram || socials.website || socials.discord);


    const displayIdentifier = entry.id ? String(entry.id) : "";
    const shortenedIdentifier =
        displayIdentifier.length > 8
            ? `${displayIdentifier.slice(0, 4)}...${displayIdentifier.slice(-4)}`
            : displayIdentifier;
    const [ageLabel, setAgeLabel] = useState<string>(() => entry.age);

    useEffect(() => {
        const createdAt = entry.createdAtMs;
        if (typeof window === "undefined") {
            return;
        }

        const updateAge = () => {
            setAgeLabel(formatAge(createdAt));
        };

        updateAge();
        const interval = window.setInterval(updateAge, 1000);
        return () => window.clearInterval(interval);
    }, [entry.createdAtMs]);

    const handleCopyAddress = useCallback(async () => {
        if (!displayIdentifier) {
            return;
        }

        try {
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(displayIdentifier);
                toast({
                    description: "Token CA copied",
                    duration: 2000,
                });
                return;
            }
        } catch (error) {
            console.error("Unable to copy mint address:", error);
        }

        toast({
            description: "Clipboard unavailable",
            variant: "destructive",
            duration: 2000,
        });
    }, [displayIdentifier, toast]);

    // Always navigate using the mint identifier (entry.id) to ensure consistent routing
    const marketPath = `/market/${encodeURIComponent(entry.id)}`;

    const navigateToMarket = useCallback(() => {
        if (!entry?.id) return;
        setLocation(`/market/${encodeURIComponent(entry.id)}`);
    }, [entry, setLocation]);

    const handleRowKeyDown = useCallback(
        (e: KeyboardEvent<HTMLDivElement>) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigateToMarket();
            }
        },
        [navigateToMarket]
    );

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={navigateToMarket}
            onKeyDown={handleRowKeyDown}
            className="relative h-[118px] border-t border-border bg-background/70 px-3 py-3 transition-colors hover:bg-background/90 sm:px-4 cursor-pointer"
        >

            <div className="flex h-full items-start gap-3">
                <div className="flex flex-shrink-0 flex-col items-center gap-2 pt-1">
                    <TokenAvatar
                        symbol={entry.symbol}
                        name={entry.name}
                        iconUrl={entry.avatarUrl}
                        size={80}
                        className="h-20 w-20 rounded-md border border-border/60 bg-background/80 object-cover shadow-sm"
                    />
                    {displayIdentifier ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCopyAddress();
                            }}
                            title={displayIdentifier}
                            aria-label="Copy mint address"
                            className="w-20 py-0 text-[7px] font-semibold uppercase tracking-[0.35em] leading-3 text-muted-foreground transition-colors hover:text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        >
                            {shortenedIdentifier}
                        </button>
                    ) : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                            {entry.symbol}
                        </span>
                        <span className="max-w-[150px] truncate text-xs text-muted-foreground sm:max-w-[200px]">
                            {entry.name}
                        </span>

                        <span className={cn("text-xs font-semibold", changeClass)}>{changeLabel}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <span>{ageLabel}</span>
                            {hasSocialLinks ? (
                                <span className="flex items-center gap-2">
                                    {socials.website ? (
                                        <a
                                            href={socials.website}
                                            onClick={(e) => e.stopPropagation()}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="Website"
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            <Globe className="h-3 w-3" />
                                        </a>
                                    ) : null}
                                    {socials.twitter ? (
                                        <a
                                            href={socials.twitter}
                                            onClick={(e) => e.stopPropagation()}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="Twitter"
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            <Twitter className="h-3 w-3" />
                                        </a>
                                    ) : null}
                                    {socials.telegram ? (
                                        <a
                                            href={socials.telegram}
                                            onClick={(e) => e.stopPropagation()}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="Telegram"
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            <MessageCircle className="h-3 w-3" />
                                        </a>
                                    ) : null}
                                </span>
                            ) : null}
                        </div>
                        <span>•</span>
                        {entry.price ? (
                            <>
                                <span>•</span>
                                <span className="text-foreground">{entry.price}</span>
                            </>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                            <CircleDollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className={cn("font-medium", applyToneClass(netFlowStat?.tone))}>
                                {netFlowLabel}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3 text-muted-foreground" />
                            <span
                                className={cn(
                                    "font-medium",
                                    applyToneClass(volumeStat?.tone ?? "neutral")
                                )}
                            >
                                {volumeLabel}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span className={cn("font-medium", applyToneClass(holdersStat?.tone))}>
                                {holdersLabel}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Banknote className="h-3 w-3 text-muted-foreground" />
                            <span className={cn("font-medium", applyToneClass(liquidityStat?.tone))}>
                                {liquidityLabel}
                            </span>
                        </div>
                        <div className="ml-auto">
                            <Link href={marketPath}>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-3 text-[10px] font-semibold uppercase tracking-[0.3em] border-border/60 hover:bg-primary/10"
                                >
                                    0 SLABs
                                </Button>
                            </Link>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

import { Card } from "@/components/ui/card";

interface Holder {
    address?: string;
    amount_cur?: number;
    balance?: number;
    usd_value?: number;
    buy_amount_cur?: number;
    sell_amount_cur?: number;
    buy_volume_cur?: number;
    sell_volume_cur?: number;
    unrealized_profit?: number;
    unrealized_pnl?: number;
    amount_percentage?: number; // fraction like 0.017
    account_address?: string;
    name?: string | null;
}

export function HoldersList({
    holders,
    loading,
    tokenPrice,
}: {
    holders: Holder[];
    loading?: boolean;
    tokenPrice?: number;
}) {

    const formatNumber = (v?: number) => {
        if (v === undefined || v === null) return "-";
        if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
        if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
        return Number(v).toFixed(2);
    };

    const formatUsdValue = (v?: number) => {
        if (v === undefined || v === null || !Number.isFinite(v)) return "-";
        return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="h-full p-2">
            {/* If loading and we have no holders yet, show full placeholder. Otherwise keep existing list visible while loading. */}
            {loading && holders.length === 0 ? (
                <div className="text-xs text-muted-foreground">Loading holders…</div>
            ) : holders.length === 0 ? (
                <div className="text-xs text-muted-foreground">No holders data available.</div>
            ) : (
                <div className="space-y-2">
                    {holders.map((h, i) => {
                        const buyAmount = Number(h.buy_amount_cur ?? h.buy_volume_cur ?? 0);
                        const balance = Number(h.amount_cur ?? h.balance ?? 0);
                        // remaining fraction of their original buy (balance / buyAmount)
                        const remainingFrac = buyAmount > 0 ? balance / buyAmount : Number(h.amount_percentage ?? 0);
                        const pctDisplay = Number.isFinite(remainingFrac) ? `${(remainingFrac * 100).toFixed(2)}%` : "-";
                        const address = (h as any).address || (h as any).account_address || "";
                        return (
                            <Card key={address || i} className="p-3 bg-background/60 border-primary/10">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex flex-col items-start gap-2">
                                        <div>
                                            <a
                                                href={address ? `https://solscan.io/account/${address}` : "#"}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-mono text-primary hover:underline block"
                                            >
                                                {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—"}
                                            </a>
                                        </div>

                                        <div className="w-full min-w-[120px]">
                                            <div className="w-full bg-border rounded-full h-1 overflow-hidden" title={`Remaining of buy: ${pctDisplay}`}>
                                                <div
                                                    className="h-1 bg-primary"
                                                    style={{ width: `${Math.min(100, Math.round((remainingFrac || 0) * 100))}%` }}
                                                />
                                            </div>
                                            <div className="text-[10px] text-muted-foreground mt-1">{pctDisplay}</div>
                                        </div>
                                    </div>

                                    <div className="flex-1 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                        <div>
                                            <div className="text-[10px]">Bought</div>
                                            <div className="font-mono text-foreground">{formatNumber(buyAmount)}</div>
                                            {tokenPrice && Number.isFinite(tokenPrice) ? (
                                                <div className="text-[10px] text-muted-foreground mt-1">{formatUsdValue(buyAmount * tokenPrice)}</div>
                                            ) : null}
                                        </div>
                                        <div>
                                            <div className="text-[10px]">Sold</div>
                                            <div className="font-mono text-foreground">{formatNumber(Number(h.sell_amount_cur ?? h.sell_volume_cur ?? 0))}</div>
                                            {tokenPrice && Number.isFinite(tokenPrice) ? (
                                                <div className="text-[10px] text-muted-foreground mt-1">{formatUsdValue(Number(h.sell_amount_cur ?? h.sell_volume_cur ?? 0) * tokenPrice)}</div>
                                            ) : null}
                                        </div>
                                        <div>
                                            <div className="text-[10px]">Unrealized</div>
                                            <div className="font-mono text-foreground">{formatNumber(Number(h.unrealized_profit ?? 0))}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px]">P&L</div>
                                            <div className="font-mono text-foreground">{formatNumber(Number(h.unrealized_pnl ?? 0))}</div>
                                        </div>
                                    </div>

                                    <div className="text-right min-w-[80px]">
                                        <div className="text-[10px] text-muted-foreground">Remaining</div>
                                        <div className="font-mono text-foreground">{formatNumber(Number(h.amount_cur ?? h.balance ?? 0))}</div>
                                        {tokenPrice && Number.isFinite(tokenPrice) ? (
                                            <div className="text-[10px] text-muted-foreground mt-1">{formatUsdValue(Number(h.amount_cur ?? h.balance ?? 0) * tokenPrice)}</div>
                                        ) : null}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default HoldersList;

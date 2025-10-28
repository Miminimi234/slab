import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { JupiterSearchToken, useJupiterSearch } from "@/hooks/useJupiterSearch";
import { Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

interface SearchPeekProps {
    query?: string;
    isOpen: boolean;
    onClose: () => void;
    onSelect: (token: JupiterSearchToken) => void;
    searchTerm: string;
    onSearchChange: (value: string) => void;
}

export default function SearchPeek({ query, isOpen, onClose, onSelect, searchTerm, onSearchChange }: SearchPeekProps) {
    const debouncedQuery = (query || "").trim();
    const { data, isLoading, error } = useJupiterSearch(debouncedQuery, Boolean(debouncedQuery));
    const [, navigate] = useLocation();
    const inputRef = useRef<HTMLInputElement>(null);

    const items: JupiterSearchToken[] = (data as JupiterSearchToken[]) ?? [];

    // Keep input focused when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-lg h-[480px] bg-background border-primary/20 flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="text-xs text-primary">SEARCH MARKETS</DialogTitle>
                    <DialogDescription className="text-[11px] text-muted-foreground">
                        Find tokens by symbol or name
                    </DialogDescription>
                </DialogHeader>

                {/* Search Input */}
                <div className="relative flex-shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/50" />
                    <Input
                        ref={inputRef}
                        type="search"
                        value={searchTerm}
                        placeholder="$ SEARCH MARKETS..."
                        className="pl-10 pr-4 bg-background/50 border-primary/20 h-9 text-xs placeholder:text-muted-foreground focus:border-primary/40"
                        onChange={(e) => onSearchChange(e.target.value)}
                        data-testid="modal-search-input"
                    />
                </div>

                <div className="mt-3 flex-1 overflow-hidden">
                    {!debouncedQuery ? (
                        <div className="text-xs text-muted-foreground text-center py-8 h-full flex items-center justify-center">
                            Start typing to search for tokens...
                        </div>
                    ) : isLoading ? (
                        <div className="space-y-2 py-4">
                            <LoadingSkeleton className="h-8" />
                            <LoadingSkeleton className="h-8" />
                            <LoadingSkeleton className="h-8" />
                            <LoadingSkeleton className="h-8" />
                            <LoadingSkeleton className="h-8" />
                        </div>
                    ) : error ? (
                        <div className="text-xs text-destructive py-8 h-full flex items-center justify-center">
                            Failed to search tokens
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-8 h-full flex items-center justify-center">
                            No tokens found for "{debouncedQuery}"
                        </div>
                    ) : (
                        <ul className="divide-y divide-primary/10 overflow-auto h-full">
                            {items.map((t) => (
                                <li key={t.id} className="flex items-center gap-3 p-2 hover:bg-primary/5 cursor-pointer" onClick={() => { onSelect(t); }}>
                                    <img src={t.icon || '/crypto-logos/default.png'} alt={t.symbol} className="w-6 h-6 rounded-full" />
                                    <div className="flex-1">
                                        <div className="text-xs font-semibold text-foreground">{t.symbol} <span className="text-muted-foreground text-[11px]">{t.name}</span></div>
                                        <div className="text-[11px] text-muted-foreground">{typeof t.usdPrice === 'number' ? `$${t.usdPrice.toFixed(4)}` : ''} {t.mcap ? ` • MCAP ${formatNumber(t.mcap)}` : ''}</div>
                                        <div className="text-[10px] text-muted-foreground font-mono">Mint: {t.id.slice(0, 8)}...{t.id.slice(-4)}</div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function formatNumber(n: unknown) {
    if (typeof n !== 'number') return '';
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    return n.toString();
}

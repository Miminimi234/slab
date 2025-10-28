import { useTheme } from "@/contexts/ThemeContext";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => any;
    };
  }
}

const TRADING_VIEW_SCRIPT_ID = "tradingview-widget-script";
const TRADING_VIEW_SCRIPT_SRC = "https://s3.tradingview.com/tv.js";

export const TRADING_VIEW_SYMBOL_MAP: Record<string, string> = {
  SLAB: "BINANCE:SOLUSDT",
  WIF: "BYBIT:WIFUSDT",
  MYRO: "MEXC:MYROUSDT",
  POPCAT: "MEXC:POPCATUSDT",
};

const DEFAULT_SYMBOL = "BINANCE:SOLUSDT";

type TradingViewMode = "candles" | "twap";

export const supportsTradingViewSymbol = (symbol: string): boolean => {
  if (!symbol) return false;
  return Boolean(TRADING_VIEW_SYMBOL_MAP[symbol.toUpperCase()]);
};

interface TradingViewWidgetProps {
  symbol: string;
  mintAddress?: string;
  mode?: TradingViewMode;
  height?: number;
  className?: string;
}

export function TradingViewWidget({
  symbol,
  mintAddress,
  mode = "candles",
  height = 400,
  className = "",
}: TradingViewWidgetProps) {
  const { currentTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerIdRef = useRef(`tv-widget-${Math.random().toString(36).slice(2)}`);
  const upperSymbol = symbol.toUpperCase();
  const mappedSymbol = TRADING_VIEW_SYMBOL_MAP[upperSymbol];
  const hasMapping = Boolean(mappedSymbol);

  // Use dark theme for graphite, light for others
  const tradingViewTheme = currentTheme === 'graphite' ? 'dark' : 'light';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (!hasMapping) {
      container.innerHTML = "";
      return;
    }

    const baseSymbol = mappedSymbol ?? `${upperSymbol}USDT`;
    const resolvedSymbol = baseSymbol.includes(":") ? baseSymbol : DEFAULT_SYMBOL;

    const initializeWidget = () => {
      if (!window.TradingView?.widget) {
        throw new Error("TradingView widget unavailable");
      }

      container.innerHTML = "";
      if (mintAddress) {
        container.dataset.mintAddress = mintAddress;
      } else {
        delete container.dataset.mintAddress;
      }

      const config: Record<string, unknown> = {
        autosize: true,
        symbol: resolvedSymbol,
        interval: mode === "twap" ? "240" : "60",
        timezone: "Etc/UTC",
        theme: tradingViewTheme,
        style: 1,
        locale: "en",
        container_id: containerIdRef.current,
        allow_symbol_change: false,
        withdateranges: false,
        hide_legend: true,
        hide_side_toolbar: true,
        hide_top_toolbar: true,
        show_popup_button: false,
      };

      if (mode === "twap") {
        config.studies = ["VWAP@tv-basicstudies"];
      }

      new window.TradingView.widget(config);
    };

    if (window.TradingView?.widget) {
      try {
        initializeWidget();
      } catch (error) {
        console.error("TradingView init error:", error);
        container.innerHTML = "";
        const fallback = document.createElement("div");
        fallback.className = "flex h-full items-center justify-center text-xs text-muted-foreground";
        fallback.textContent = "TradingView widget unavailable.";
        container.appendChild(fallback);
      }
      return;
    }

    const handleScriptLoad = () => {
      try {
        initializeWidget();
      } catch (error) {
        console.error("TradingView init error after load:", error);
        container.innerHTML = "";
        const fallback = document.createElement("div");
        fallback.className = "flex h-full items-center justify-center text-xs text-muted-foreground";
        fallback.textContent = "TradingView widget unavailable.";
        container.appendChild(fallback);
      }
    };

    let scriptEl = document.getElementById(TRADING_VIEW_SCRIPT_ID) as HTMLScriptElement | null;

    if (!scriptEl) {
      scriptEl = document.createElement("script");
      scriptEl.id = TRADING_VIEW_SCRIPT_ID;
      scriptEl.src = TRADING_VIEW_SCRIPT_SRC;
      scriptEl.type = "text/javascript";
      scriptEl.async = true;
      scriptEl.addEventListener("load", handleScriptLoad, { once: true });
      scriptEl.addEventListener("error", () => {
        const fallback = document.createElement("div");
        fallback.className = "flex h-full items-center justify-center text-xs text-muted-foreground";
        fallback.textContent = "Unable to load TradingView script.";
        container.appendChild(fallback);
      });
      document.head.appendChild(scriptEl);
    } else {
      scriptEl.addEventListener("load", handleScriptLoad, { once: true });
    }

    return () => {
      scriptEl?.removeEventListener("load", handleScriptLoad);
    };
  }, [hasMapping, mappedSymbol, upperSymbol, mode, mintAddress, tradingViewTheme]);

  if (!hasMapping) {
    return (
      <div
        className={`relative w-full ${className}`}
        style={{ minHeight: `${height}px`, height: `${height}px` }}
      >
        {mintAddress && (
          <div className="pointer-events-none absolute right-2 top-2 z-10 rounded border border-primary/20 bg-background/80 px-2 py-1 text-[10px] font-mono text-primary">
            MINT: {mintAddress.slice(0, 4)}...{mintAddress.slice(-4)}
          </div>
        )}
        <div className="flex h-full w-full items-center justify-center border border-dashed border-primary/30 bg-background/60 text-xs text-muted-foreground">
          TradingView data is not available for {upperSymbol}. Displaying placeholder.
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full ${className}`}
      style={{ minHeight: `${height}px`, height: `${height}px` }}
    >
      {mintAddress && (
        <div className="pointer-events-none absolute right-2 top-2 z-10 rounded border border-primary/20 bg-background/80 px-2 py-1 text-[10px] font-mono text-primary">
          MINT: {mintAddress.slice(0, 4)}...{mintAddress.slice(-4)}
        </div>
      )}
      <div
        ref={containerRef}
        id={containerIdRef.current}
        className="h-full w-full"
        style={{
          minHeight: `${height}px`,
          height: `${height}px`,
          isolation: "isolate",
        }}
      />
    </div>
  );
}

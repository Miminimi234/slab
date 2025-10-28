import { useTheme } from "@/contexts/ThemeContext";
import clsx from "clsx";
import { useEffect, useRef } from "react";

interface GMGNWidgetProps {
  mintAddress: string;
  height?: number;
  interval?: "1S" | "1" | "5" | "15" | "60" | "240" | "720" | "1D";
  theme?: "light" | "dark";
  className?: string;
}

const DEFAULT_URL_BASE = "https://www.gmgn.cc/kline/sol";
const DEFAULT_INTERVAL: GMGNWidgetProps["interval"] = "15";
const DEFAULT_THEME: GMGNWidgetProps["theme"] = "light";

export function GMGNWidget({
  mintAddress,
  height = 420,
  interval = DEFAULT_INTERVAL,
  theme = DEFAULT_THEME,
  className = "",
}: GMGNWidgetProps) {
  const { currentTheme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Override theme to dark when graphite theme is active, otherwise use the provided theme
  const effectiveTheme = currentTheme === 'graphite' ? 'dark' : theme;

  if (!mintAddress) {
    return (
      <div
        className={clsx(
          "flex h-full w-full items-center justify-center border border-dashed border-primary/30 bg-background/60 text-xs text-muted-foreground",
          className,
        )}
        style={{ minHeight: `${height}px` }}
      >
        No mint address available.
      </div>
    );
  }

  const url = `${DEFAULT_URL_BASE}/${mintAddress}?interval=${interval}&theme=${effectiveTheme}`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (iframe.src !== url) {
      iframe.src = url;
    }
  }, [url, effectiveTheme]);

  return (
    <div
      className={clsx(
        "relative w-full overflow-hidden rounded-sm border border-primary/10 bg-background/60",
        className,
      )}
      style={{ minHeight: `${height}px`, height: `${height}px` }}
    >
      <iframe
        ref={iframeRef}
        title="gmgn-chart"
        src={url}
        className="h-full w-full border-0"
        style={{ height: "120%", width: "100%", transform: "translateY(-10%)" }}
        sandbox="allow-scripts allow-same-origin"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}

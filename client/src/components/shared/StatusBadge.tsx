import { Badge } from "@/components/ui/badge";
import { MarketStatus } from "@shared/schema";

interface StatusBadgeProps {
  status: MarketStatus;
  graduationProgress?: number; // optional, used to decide bonding label
  className?: string;
}

export function StatusBadge({ status, graduationProgress, className = "" }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "bonding": {
        // If graduationProgress is provided and is 100, show DEX; otherwise show bonding curve
        const label = typeof graduationProgress === "number"
          ? (graduationProgress >= 100 ? "on DEX" : "on bonding curve")
          : "BONDING";

        return {
          label,
          className: "bg-transparent text-warning border-warning/30",
        };
      }
      case "warmup":
        return {
          label: "WARMUP",
          className: "bg-transparent text-secondary border-secondary/30",
        };
      case "perps":
        return {
          label: "LIVE",
          className: "bg-transparent text-primary border-primary/30",
        };
      default:
        return {
          label: String(status).toUpperCase(),
          className: "bg-transparent text-muted-foreground border-border/20",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge
      variant="outline"
      className={`${config.className} ${className} font-mono text-[10px] tracking-wider px-2`}
      data-testid={`badge-status-${status}`}
    >
      [{config.label}]
    </Badge>
  );
}

import { Badge } from "@/components/ui/badge";
import { MarketStatus } from "@shared/schema";

interface StatusBadgeProps {
  status: MarketStatus;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "bonding":
        return {
          label: "BONDING",
          className: "bg-transparent text-warning border-warning/30",
        };
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

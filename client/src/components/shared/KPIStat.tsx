import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface KPIStatProps {
  label: string;
  value: string | number;
  change?: number;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function KPIStat({ label, value, change, icon: Icon, trend, className = "" }: KPIStatProps) {
  const getTrendColor = () => {
    if (trend === "up" || (change && change > 0)) return "text-success";
    if (trend === "down" || (change && change < 0)) return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <motion.div
      className={`flex flex-col gap-1 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold font-mono text-foreground" data-numeric="true">{value}</span>
        {change !== undefined && (
          <span className={`text-sm font-medium ${getTrendColor()}`}>
            {change > 0 ? "+" : ""}{change.toFixed(2)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}

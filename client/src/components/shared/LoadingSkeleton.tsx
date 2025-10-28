import { motion } from "framer-motion";

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
}

export function LoadingSkeleton({ className = "", count = 1 }: LoadingSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={`bg-muted/20 rounded-md ${className}`}
          animate={{
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.1,
          }}
        />
      ))}
    </>
  );
}

export function MarketTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border border-border rounded-md">
          <LoadingSkeleton className="w-8 h-8 rounded-md" />
          <LoadingSkeleton className="w-20 h-4" />
          <LoadingSkeleton className="w-16 h-4 ml-auto" />
          <LoadingSkeleton className="w-24 h-4" />
          <LoadingSkeleton className="w-16 h-4" />
        </div>
      ))}
    </div>
  );
}

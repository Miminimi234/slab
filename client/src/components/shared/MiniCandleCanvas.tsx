import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface MiniCandleCanvasProps {
  data?: number[];
  className?: string;
  height?: number;
}

export function MiniCandleCanvas({ data = [], className = "", height = 80 }: MiniCandleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    const prices = data.length > 0 ? data : Array.from({ length: 50 }, (_, i) => 
      50 + Math.sin(i * 0.2) * 20 + Math.random() * 10
    );

    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const range = max - min || 1;

    const barWidth = rect.width / prices.length;

    prices.forEach((price, i) => {
      const x = i * barWidth;
      const normalizedHeight = ((price - min) / range) * (rect.height - 10);
      const y = rect.height - normalizedHeight - 5;
      const h = normalizedHeight;

      const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
      gradient.addColorStop(0, "#00FFA3");
      gradient.addColorStop(1, "rgba(0, 255, 163, 0.1)");

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, Math.max(barWidth - 1, 1), h);
    });

    ctx.strokeStyle = "#00FFA3";
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    prices.forEach((price, i) => {
      const x = i * barWidth + barWidth / 2;
      const y = rect.height - ((price - min) / range) * (rect.height - 10) - 5;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }, [data]);

  return (
    <motion.div
      className={`relative ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${height}px` }}
      />
    </motion.div>
  );
}

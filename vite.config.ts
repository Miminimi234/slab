import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    // Removed runtime error overlay plugin completely
  ],
  envDir: path.resolve(import.meta.dirname),
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  optimizeDeps: {
    include: ['buffer', 'process', 'bn.js', '@raydium-io/raydium-sdk-v2'],
    force: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      buffer: 'buffer',
      process: 'process/browser',
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      external: [],
    },
  },
  server: {
    hmr: {
      overlay: false, // Disable error overlay
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});

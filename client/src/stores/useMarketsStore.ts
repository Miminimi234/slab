import { create } from "zustand";
import type { Market, OrderBook, Trade } from "@shared/schema";

interface MarketsState {
  markets: Market[];
  selectedMarket: Market | null;
  orderBooks: Record<string, OrderBook>;
  recentTrades: Record<string, Trade[]>;
  
  setMarkets: (markets: Market[]) => void;
  selectMarket: (marketId: string) => void;
  updateMarketMetrics: (marketId: string, metrics: Partial<Market["metrics"]>) => void;
  setOrderBook: (marketId: string, orderBook: OrderBook) => void;
  addTrade: (marketId: string, trade: Trade) => void;
}

export const useMarketsStore = create<MarketsState>((set, get) => ({
  markets: [],
  selectedMarket: null,
  orderBooks: {},
  recentTrades: {},

  setMarkets: (markets) => set({ markets }),

  selectMarket: (marketId) => {
    const market = get().markets.find(m => m.id === marketId);
    set({ selectedMarket: market || null });
  },

  updateMarketMetrics: (marketId, metrics) => {
    set((state) => ({
      markets: state.markets.map(m =>
        m.id === marketId
          ? { ...m, metrics: { ...m.metrics, ...metrics } }
          : m
      ),
    }));
  },

  setOrderBook: (marketId, orderBook) => {
    set((state) => ({
      orderBooks: { ...state.orderBooks, [marketId]: orderBook },
    }));
  },

  addTrade: (marketId, trade) => {
    set((state) => {
      const existing = state.recentTrades[marketId] || [];
      return {
        recentTrades: {
          ...state.recentTrades,
          [marketId]: [trade, ...existing].slice(0, 50),
        },
      };
    });
  },
}));

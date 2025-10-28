import { create } from "zustand";
import type { Position } from "@shared/schema";

interface TradeState {
  positions: Position[];
  pendingOrders: any[];
  balances: Record<string, number>;
  
  addPosition: (position: Position) => void;
  closePosition: (positionId: string) => void;
  updatePosition: (positionId: string, updates: Partial<Position>) => void;
  setBalance: (asset: string, amount: number) => void;
}

export const useTradeStore = create<TradeState>((set) => ({
  positions: [],
  pendingOrders: [],
  balances: {
    SOL: 10.5,
    USDC: 5000,
  },

  addPosition: (position) => {
    set((state) => ({
      positions: [...state.positions, position],
    }));
  },

  closePosition: (positionId) => {
    set((state) => ({
      positions: state.positions.filter(p => p.id !== positionId),
    }));
  },

  updatePosition: (positionId, updates) => {
    set((state) => ({
      positions: state.positions.map(p =>
        p.id === positionId ? { ...p, ...updates } : p
      ),
    }));
  },

  setBalance: (asset, amount) => {
    set((state) => ({
      balances: { ...state.balances, [asset]: amount },
    }));
  },
}));

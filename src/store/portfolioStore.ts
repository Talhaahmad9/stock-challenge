import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  HoldingWithStock,
  StockWithPrice,
} from "@/lib/supabase/database.types";

interface PortfolioStore {
  balance: number;
  holdings: HoldingWithStock[];
  stocks: StockWithPrice[];
  startingBalance: number;
  isLoading: boolean;
  setBalance: (balance: number) => void;
  setHoldings: (holdings: HoldingWithStock[]) => void;
  setStocks: (stocks: StockWithPrice[]) => void;
  setStartingBalance: (startingBalance: number) => void;
  setLoading: (isLoading: boolean) => void;
  updateAfterTrade: (
    newBalance: number,
    newHoldings: HoldingWithStock[],
  ) => void;
  fetchPortfolio: (eventId: string) => Promise<void>;
  reset: () => void;
  getPortfolioValue: () => number;
  getTotalValue: () => number;
  getTotalPnL: () => number;
}

export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set, get) => ({
      balance: 0,
      holdings: [],
      stocks: [],
      startingBalance: 0,
      isLoading: false,

      setBalance: (balance) => set({ balance }),
      setHoldings: (holdings) => set({ holdings }),
      setStocks: (stocks) => set({ stocks }),
      setStartingBalance: (startingBalance) => set({ startingBalance }),
      setLoading: (isLoading) => set({ isLoading }),

      updateAfterTrade: (newBalance, newHoldings) =>
        set({ balance: newBalance, holdings: newHoldings }),

      fetchPortfolio: async (eventId) => {
        set({ isLoading: true });
        try {
          const res = await fetch(
            `/api/participant/portfolio?eventId=${eventId}`,
          );
          if (res.ok) {
            const data = (await res.json()) as {
              portfolio: { balance: number; holdings: HoldingWithStock[] };
              stocks: StockWithPrice[];
            };
            set({
              balance: data.portfolio.balance,
              holdings: data.portfolio.holdings,
              stocks: data.stocks,
            });
          }
        } finally {
          set({ isLoading: false });
        }
      },

      reset: () =>
        set({
          balance: 0,
          holdings: [],
          stocks: [],
          startingBalance: 0,
          isLoading: false,
        }),

      getPortfolioValue: () =>
        get().holdings.reduce((sum, h) => sum + h.quantity * h.currentPrice, 0),

      getTotalValue: () => get().balance + get().getPortfolioValue(),
      getTotalPnL: () => get().getTotalValue() - get().startingBalance,
    }),
    {
      name: "portfolio-storage",
      partialize: (state) => ({ startingBalance: state.startingBalance }),
    },
  ),
);

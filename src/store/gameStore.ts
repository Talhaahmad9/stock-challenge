import { create } from "zustand";
import type { GameState, EventStatus } from "@/lib/supabase/database.types";

interface GameStore {
  gameState: GameState | null;
  isConnected: boolean;
  activeEventId: string | null;
  setGameState: (state: GameState) => void;
  setConnected: (connected: boolean) => void;
  setActiveEventId: (eventId: string) => void;
  updateStatus: (status: EventStatus) => void;
  updateTimer: (remaining: number) => void;
  updateRound: (round: number) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  isConnected: false,
  activeEventId: null,

  setGameState: (state) => set({ gameState: state }),
  setConnected: (connected) => set({ isConnected: connected }),
  setActiveEventId: (eventId) => set({ activeEventId: eventId }),

  updateStatus: (status) =>
    set((store) =>
      store.gameState ? { gameState: { ...store.gameState, status } } : {},
    ),

  updateTimer: (remaining) =>
    set((store) =>
      store.gameState
        ? { gameState: { ...store.gameState, timerRemaining: remaining } }
        : {},
    ),

  updateRound: (round) =>
    set((store) =>
      store.gameState
        ? { gameState: { ...store.gameState, currentRound: round } }
        : {},
    ),

  reset: () =>
    set({ gameState: null, isConnected: false, activeEventId: null }),
}));

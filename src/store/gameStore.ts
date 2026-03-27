import { create } from "zustand";
import type { GameState, EventStatus } from "@/lib/supabase/database.types";

interface GameStore {
  gameState: GameState | null;
  isConnected: boolean;
  activeEventId: string | null;
  tradingEnabled: boolean;
  roundStartTime: number | null; // Unix timestamp (ms) when round started
  roundDurationSeconds: number; // Total duration of current round
  setGameState: (state: GameState) => void;
  setConnected: (connected: boolean) => void;
  setActiveEventId: (eventId: string) => void;
  updateStatus: (status: EventStatus) => void;
  updateTimer: (remaining: number) => void;
  startRound: (startTimeMs: number, durationSeconds: number) => void;
  updateRound: (round: number) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  isConnected: false,
  activeEventId: null,
  tradingEnabled: false,
  roundStartTime: null,
  roundDurationSeconds: 0,

  setGameState: (state) =>
    set({ gameState: state, tradingEnabled: state.status === "ROUND_ACTIVE" }),
  setConnected: (connected) => set({ isConnected: connected }),
  setActiveEventId: (eventId) => set({ activeEventId: eventId }),

  updateStatus: (status) =>
    set((store) =>
      store.gameState
        ? {
            gameState: {
              ...store.gameState,
              status,
              timerRemaining:
                status === "ROUND_END" || status === "GAME_END"
                  ? 0
                  : store.gameState.timerRemaining,
            },
            tradingEnabled: status === "ROUND_ACTIVE",
            roundStartTime:
              status === "ROUND_ACTIVE" ? store.roundStartTime : null,
            roundDurationSeconds:
              status === "ROUND_ACTIVE" ? store.roundDurationSeconds : 0,
          }
        : { tradingEnabled: false },
    ),

  updateTimer: (remaining) =>
    set((store) =>
      store.gameState
        ? { gameState: { ...store.gameState, timerRemaining: remaining } }
        : {},
    ),

  startRound: (startTimeMs, durationSeconds) =>
    set((store) => ({
      roundStartTime: startTimeMs,
      roundDurationSeconds: durationSeconds,
      gameState: store.gameState
        ? { ...store.gameState, timerRemaining: durationSeconds }
        : store.gameState,
    })),

  updateRound: (round) =>
    set((store) =>
      store.gameState
        ? { gameState: { ...store.gameState, currentRound: round } }
        : {},
    ),

  reset: () =>
    set({
      gameState: null,
      isConnected: false,
      activeEventId: null,
      tradingEnabled: false,
      roundStartTime: null,
      roundDurationSeconds: 0,
    }),
}));

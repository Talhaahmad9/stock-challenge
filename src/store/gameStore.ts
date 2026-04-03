import { create } from "zustand";
import type { GameState, EventStatus } from "@/lib/supabase/database.types";

interface GameStore {
  gameState: GameState | null;
  isConnected: boolean;
  activeEventId: string | null;
  tradingEnabled: boolean;
  timerExpiresAtMs: number | null;
  timerLastSyncClientMs: number | null;
  timerRemainingAtSyncSec: number;
  setGameState: (state: GameState) => void;
  setConnected: (connected: boolean) => void;
  setActiveEventId: (eventId: string) => void;
  updateStatus: (status: EventStatus) => void;
  updateTimer: (remaining: number) => void;
  syncTimerSnapshot: (
    remainingSeconds: number,
    expiresAt?: string | null,
    serverTimeMs?: number,
  ) => void;
  updateRound: (round: number) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  isConnected: false,
  activeEventId: null,
  tradingEnabled: false,
  timerExpiresAtMs: null,
  timerLastSyncClientMs: null,
  timerRemainingAtSyncSec: 0,

  setGameState: (state) =>
    set((store) => {
      const isTimingStatus =
        state.status === "ROUND_ACTIVE" || state.status === "PAUSED";
      const parsedExpiresAtMs = state.roundExpiresAt
        ? new Date(state.roundExpiresAt).getTime()
        : NaN;
      const nextExpiresAtMs =
        isTimingStatus && Number.isFinite(parsedExpiresAtMs)
          ? parsedExpiresAtMs
          : store.timerExpiresAtMs;

      return {
        gameState: state,
        tradingEnabled: state.status === "ROUND_ACTIVE",
        timerExpiresAtMs: isTimingStatus ? nextExpiresAtMs : null,
        timerLastSyncClientMs: isTimingStatus ? Date.now() : null,
        timerRemainingAtSyncSec: isTimingStatus ? state.timerRemaining : 0,
      };
    }),
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
            timerExpiresAtMs:
              status === "ROUND_ACTIVE" || status === "PAUSED"
                ? store.timerExpiresAtMs
                : null,
            timerLastSyncClientMs:
              status === "ROUND_ACTIVE" || status === "PAUSED"
                ? store.timerLastSyncClientMs
                : null,
            timerRemainingAtSyncSec:
              status === "ROUND_ACTIVE" || status === "PAUSED"
                ? store.timerRemainingAtSyncSec
                : 0,
          }
        : { tradingEnabled: false },
    ),

  updateTimer: (remaining) =>
    set((store) =>
      store.gameState
        ? {
            gameState: { ...store.gameState, timerRemaining: remaining },
            timerRemainingAtSyncSec: remaining,
            timerLastSyncClientMs: Date.now(),
          }
        : {},
    ),

  syncTimerSnapshot: (remainingSeconds, expiresAt, serverTimeMs) =>
    set((store) => ({
      timerExpiresAtMs: (() => {
        if (expiresAt) {
          const parsed = new Date(expiresAt).getTime();
          if (Number.isFinite(parsed)) return parsed;
        }
        const serverNow = typeof serverTimeMs === "number" ? serverTimeMs : Date.now();
        const clientNow = Date.now();
        const skewMs = clientNow - serverNow;
        return clientNow + remainingSeconds * 1000 - skewMs;
      })(),
      timerLastSyncClientMs: Date.now(),
      timerRemainingAtSyncSec: remainingSeconds,
      gameState: store.gameState
        ? { ...store.gameState, timerRemaining: remainingSeconds }
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
      timerExpiresAtMs: null,
      timerLastSyncClientMs: null,
      timerRemainingAtSyncSec: 0,
    }),
}));

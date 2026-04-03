import { useEffect, useRef, useCallback, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/store/authStore";
import { useGameStore } from "@/store/gameStore";
import { usePortfolioStore } from "@/store/portfolioStore";
import type {
  HoldingWithStock,
  EventStatus,
} from "@/lib/supabase/database.types";

interface GameStateUpdatePayload {
  eventId: string;
  status: EventStatus;
  timerRemaining: number | null;
  expiresAt?: string | null;
  serverTimeMs?: number;
  currentRound: number | null;
}

interface RoundStartPayload {
  eventId?: string;
  roundNumber: number;
  durationSeconds: number;
  expiresAt?: string;
  serverTimeMs?: number;
  prices: Record<string, number>;
  caseStudy: string | null;
}

interface RoundEndPayload {
  eventId?: string;
  auto?: boolean;
  roundNumber?: number;
  serverTimeMs?: number;
}

interface GameStartPayload {
  eventId?: string;
  startTime?: string;
}

interface TimerTickPayload {
  eventId?: string;
  remaining: number;
  expiresAt?: string | null;
  serverTimeMs?: number;
}

// FIX: token must come from API — httpOnly cookies are not readable by JS
async function fetchSocketToken(): Promise<string> {
  try {
    const res = await fetch("/api/auth/token");
    if (!res.ok) return "";
    const data = (await res.json()) as { token?: string };
    return data.token ?? "";
  } catch {
    return "";
  }
}

export default function useSocket(eventId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnectedState] = useState(false);

  const user = useAuthStore((s) => s.user);
  const { setConnected, syncTimerSnapshot, updateStatus, updateRound, updateTimer } =
    useGameStore();
  const { updateAfterTrade, fetchPortfolio } = usePortfolioStore();

  useEffect(() => {
    if (!eventId || !user) return;

    let cancelled = false;

    async function connect() {
      const token = await fetchSocketToken();
      if (!token || cancelled) return;

      const socket = io(
        process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000",
        {
          auth: { token },
          transports: ["websocket"],
        },
      );

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("[socket] connected, eventId:", eventId);
        if (cancelled) {
          socket.disconnect();
          return;
        }
        setConnected(true);
        setIsConnectedState(true);
        console.log("[socket] emitting JOIN_GAME with eventId:", eventId);
        socket.emit("JOIN_GAME", { userId: user!.id, token, eventId });
      });

      socket.on("disconnect", () => {
        console.log("[socket] disconnected");
        setConnected(false);
        setIsConnectedState(false);
      });

      socket.on("AUTH_ERROR", (payload: { error: string }) => {
        console.error("[socket] AUTH_ERROR:", payload.error);
        socket.disconnect();
      });

      socket.on("JOINED", (payload: { userId: string }) => {
        console.log("[socket] JOINED game room as", payload.userId);
      });

      socket.on("GAME_START", (payload: GameStartPayload) => {
        console.log("[socket] GAME_START", { payloadEventId: payload?.eventId, hookEventId: eventId });
        if (payload?.eventId && payload.eventId !== eventId) return;
        updateStatus("RUNNING");
      });

      socket.on(
        "ROUND_START",
        (payload: RoundStartPayload) => {
          console.log("[socket] ROUND_START", { payloadEventId: payload.eventId, hookEventId: eventId, roundNumber: payload.roundNumber, durationSeconds: payload.durationSeconds });
          if (payload?.eventId && payload.eventId !== eventId) {
            console.log("[socket] ROUND_START filtered out due to eventId mismatch");
            return;
          }
          // Update store immediately from socket payload
          updateRound(payload.roundNumber);

          syncTimerSnapshot(
            payload.durationSeconds,
            payload.expiresAt,
            payload.serverTimeMs,
          );
          
          updateStatus("ROUND_ACTIVE");
          console.log("[socket] ROUND_START status updated to ROUND_ACTIVE");
          // Refresh participant data for the new round.
          if (eventId) {
            void fetchPortfolio(eventId);
          }
        },
      );

      socket.on("ROUND_END", (payload: RoundEndPayload) => {
        console.log("[socket] ROUND_END", { payloadEventId: payload?.eventId, hookEventId: eventId, auto: payload?.auto });
        if (payload?.eventId && payload.eventId !== eventId) {
          console.log("[socket] ROUND_END filtered out due to eventId mismatch");
          return;
        }
        console.log("[socket] ROUND_END updating status to ROUND_END");
        syncTimerSnapshot(0, null, payload?.serverTimeMs);
        updateStatus("ROUND_END");
        if (eventId) void fetchPortfolio(eventId);
      });

      socket.on("TIMER_TICK", (payload: TimerTickPayload) => {
        if (payload?.eventId && payload.eventId !== eventId) return;
        if (typeof payload?.remaining !== "number") return;

        updateTimer(payload.remaining);
        syncTimerSnapshot(payload.remaining, payload.expiresAt ?? null, payload.serverTimeMs);
      });

      function handleStateUpdate(payload: GameStateUpdatePayload) {
        if (payload.eventId !== eventId) return;
        updateStatus(payload.status);
        if (typeof payload.currentRound === "number") {
          updateRound(payload.currentRound);
        }
        if (typeof payload.timerRemaining === "number") {
          updateTimer(payload.timerRemaining);
          if (
            payload.status === "ROUND_ACTIVE" ||
            payload.status === "PAUSED"
          ) {
            syncTimerSnapshot(
              payload.timerRemaining,
              payload.expiresAt ?? null,
              payload.serverTimeMs,
            );
          }
        }
      }

      socket.on("GAME_PAUSED", handleStateUpdate);
      socket.on("GAME_RESUMED", handleStateUpdate);
      socket.on("GAME_STATE_UPDATED", handleStateUpdate);

      // Backward compatibility with legacy names.
      socket.on("GAME_PAUSE", (payload?: Partial<GameStateUpdatePayload>) => {
        if (payload?.eventId && payload.eventId !== eventId) return;
        if (typeof payload?.timerRemaining === "number") {
          updateTimer(payload.timerRemaining);
          syncTimerSnapshot(payload.timerRemaining, payload.expiresAt ?? null, payload.serverTimeMs);
        }
        updateStatus("PAUSED");
      });

      socket.on("GAME_RESUME", (payload?: Partial<GameStateUpdatePayload>) => {
        if (payload?.eventId && payload.eventId !== eventId) return;
        const remaining =
          typeof payload?.timerRemaining === "number"
            ? payload.timerRemaining
            : useGameStore.getState().gameState?.timerRemaining ?? 0;
        syncTimerSnapshot(remaining, payload?.expiresAt ?? null, payload?.serverTimeMs);
        updateStatus("ROUND_ACTIVE");
      });

      socket.on("GAME_END", () => {
        updateStatus("GAME_END");
        if (eventId) void fetchPortfolio(eventId);
      });

      socket.on(
        "TRADE_EXECUTED",
        (payload: {
          success: boolean;
          newBalance: number;
          newHoldings: HoldingWithStock[];
        }) => {
          if (payload.success) {
            updateAfterTrade(payload.newBalance, payload.newHoldings);
          }
        },
      );

      socket.on("FORCE_LOGOUT", (payload: { reason: string }) => {
        alert(payload.reason);
        window.location.href = "/login";
      });
    }

    void connect();

    // Auto-transition from ROUND_ACTIVE to ROUND_END when timer hits 0
    // This handles the case where ROUND_END socket event is missed
    const timerCheckInterval = setInterval(() => {
      const state = useGameStore.getState();
      if (state.gameState?.status === "ROUND_ACTIVE" && state.timerExpiresAtMs) {
        const remainingMs = state.timerExpiresAtMs - Date.now();
        
        if (remainingMs <= 0) {
          console.log("[socket] Auto-transitioning from ROUND_ACTIVE to ROUND_END (timer hit 0)");
          syncTimerSnapshot(0);
          updateStatus("ROUND_END");
        }
      }
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(timerCheckInterval);
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      setIsConnectedState(false);
    };
  }, [eventId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = useCallback((event: string, ...args: unknown[]) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  return { socketRef, isConnected, emit };
}

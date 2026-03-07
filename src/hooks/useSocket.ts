import { useEffect, useRef, useCallback, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/store/authStore";
import { useGameStore } from "@/store/gameStore";
import { usePortfolioStore } from "@/store/portfolioStore";
import type {
  HoldingWithStock,
  GameState,
} from "@/lib/supabase/database.types";

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
  const { setConnected, updateTimer, updateStatus, updateRound } =
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
        if (cancelled) {
          socket.disconnect();
          return;
        }
        setConnected(true);
        setIsConnectedState(true);
        socket.emit("JOIN_GAME", { userId: user!.id, token });
      });

      socket.on("disconnect", () => {
        setConnected(false);
        setIsConnectedState(false);
      });

      socket.on("AUTH_ERROR", (payload: { error: string }) => {
        console.error("[socket] AUTH_ERROR:", payload.error);
        socket.disconnect();
      });

      socket.on("JOINED", (payload: { userId: string }) => {
        console.log("[socket] joined game room as", payload.userId);
      });

      socket.on("GAME_START", () => updateStatus("RUNNING"));

      socket.on(
        "ROUND_START",
        (payload: {
          roundNumber: number;
          durationSeconds: number;
          prices: Record<string, number>;
          caseStudy: string | null;
        }) => {
          // Update store immediately from socket payload
          updateRound(payload.roundNumber);
          updateTimer(payload.durationSeconds);
          updateStatus("ROUND_ACTIVE");
          // Also fetch fresh game state from DB (cache-busted) to stay in sync
          if (eventId) {
            void fetch(
              "/api/game/state?eventId=" + eventId + "&t=" + Date.now(),
            )
              .then((r) => r.json())
              .then((data: unknown) =>
                useGameStore.getState().setGameState(data as GameState),
              )
              .catch(() => {});
            void fetchPortfolio(eventId);
          }
        },
      );

      socket.on("ROUND_END", () => {
        updateStatus("ROUND_END");
        if (eventId) void fetchPortfolio(eventId);
      });

      socket.on("TIMER_TICK", (payload: { remaining: number }) => {
        updateTimer(payload.remaining);
      });

      socket.on("GAME_PAUSE", () => updateStatus("PAUSED"));

      socket.on("GAME_RESUME", (payload: { remainingTime: number }) => {
        updateStatus("ROUND_ACTIVE");
        updateTimer(payload.remainingTime);
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

    return () => {
      cancelled = true;
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

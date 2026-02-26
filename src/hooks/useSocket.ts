import { useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/store/authStore";
import { useGameStore } from "@/store/gameStore";
import { usePortfolioStore } from "@/store/portfolioStore";
import type { HoldingWithStock } from "@/lib/supabase/database.types";

function getTokenFromCookie(): string {
  if (typeof document === "undefined") return "";
  const entry = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith("session_token="));
  return entry ? entry.trim().slice("session_token=".length) : "";
}

export default function useSocket(eventId: string | null) {
  const socketRef = useRef<Socket | null>(null);

  const user = useAuthStore((s) => s.user);
  const { setConnected, updateTimer, updateStatus, updateRound, isConnected } =
    useGameStore();
  const { updateAfterTrade } = usePortfolioStore();

  useEffect(() => {
    if (!eventId || !user) return;

    const token = getTokenFromCookie();

    const socket = io(
      process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000",
      {
        auth: { token },
        transports: ["websocket"],
      },
    );

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("JOIN_GAME", { userId: user.id, token });
    });

    socket.on("disconnect", () => {
      setConnected(false);
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
        updateStatus("ROUND_ACTIVE");
        updateRound(payload.roundNumber);
        updateTimer(payload.durationSeconds);
      },
    );

    socket.on("ROUND_END", () => updateStatus("ROUND_END"));

    socket.on("TIMER_TICK", (payload: { remaining: number }) => {
      updateTimer(payload.remaining);
    });

    socket.on("GAME_PAUSE", () => updateStatus("PAUSED"));

    socket.on("GAME_RESUME", (payload: { remainingTime: number }) => {
      updateStatus("ROUND_ACTIVE");
      updateTimer(payload.remainingTime);
    });

    socket.on("GAME_END", () => updateStatus("GAME_END"));

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

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    eventId,
    user,
    setConnected,
    updateTimer,
    updateStatus,
    updateRound,
    updateAfterTrade,
  ]);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  return { socketRef, isConnected, emit };
}

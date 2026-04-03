"use client";

import { useGameStore } from "@/store/gameStore";
import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  status: string;
  currentRound: number;
  totalRounds: number;
  activeEventId?: string | null;
}

function formatTimer(s: number) {
  const totalSeconds = Math.max(0, Math.ceil(s));
  return `${Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
}

export default function TimerDisplay({
  status,
  currentRound,
  totalRounds,
  activeEventId,
}: Props) {
  const timerExpiresAtMs = useGameStore((store) => store.timerExpiresAtMs);
  const timerLastSyncClientMs = useGameStore(
    (store) => store.timerLastSyncClientMs,
  );
  const timerRemainingAtSyncSec = useGameStore(
    (store) => store.timerRemainingAtSyncSec,
  );
  const persistedTimerRemaining = useGameStore(
    (store) => store.gameState?.timerRemaining ?? 0,
  );
  const setGameState = useGameStore((store) => store.setGameState);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const roundEndFetchTriggeredRef = useRef(false);

  // Tick local clock while active; displayTime is derived from state + clock.
  useEffect(() => {
    if (status !== "ROUND_ACTIVE") return;
    const interval = setInterval(() => setNowMs(Date.now()), 100);

    return () => clearInterval(interval);
  }, [status]);

  const displayTime = useMemo(() => {
    if (status === "PAUSED") return persistedTimerRemaining;
    if (status !== "ROUND_ACTIVE") return 0;

    if (!timerExpiresAtMs || !timerLastSyncClientMs) {
      return persistedTimerRemaining;
    }

    const elapsedSinceSyncSec = (nowMs - timerLastSyncClientMs) / 1000;
    const interpolatedRemaining = Math.max(
      0,
      timerRemainingAtSyncSec - elapsedSinceSyncSec,
    );
    const expiresBasedRemaining = Math.max(0, (timerExpiresAtMs - nowMs) / 1000);
    const localRemaining = Math.min(interpolatedRemaining, expiresBasedRemaining);

    // If server-synced remaining exists, trust the lower value to avoid stale seconds.
    if (persistedTimerRemaining > 0) {
      return Math.min(localRemaining, persistedTimerRemaining);
    }

    return localRemaining;
  }, [
    status,
    persistedTimerRemaining,
    timerExpiresAtMs,
    timerLastSyncClientMs,
    timerRemainingAtSyncSec,
    nowMs,
  ]);

  // Auto-fetch game state if timer hit 0 but status is still ROUND_ACTIVE
  // This handles the case where ROUND_END socket event is missed
  useEffect(() => {
    if (status !== "ROUND_ACTIVE") {
      roundEndFetchTriggeredRef.current = false;
      return;
    }

    if (
      displayTime <= 0 &&
      activeEventId &&
      !roundEndFetchTriggeredRef.current
    ) {
      roundEndFetchTriggeredRef.current = true;
      console.log(
        "[TimerDisplay] Timer hit 0 but status is still ROUND_ACTIVE, fetching fresh game state",
      );
      void (async () => {
        try {
          const res = await fetch(`/api/game/state?eventId=${activeEventId}`);
          if (res.ok) {
            const freshState = await res.json();
            console.log("[TimerDisplay] Fetched fresh game state:", freshState);
            setGameState(freshState);
          }
        } catch (err) {
          console.error("[TimerDisplay] Failed to fetch game state:", err);
        }
      })();
    }
  }, [displayTime, status, activeEventId, setGameState]);

  return (
    <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 flex items-center gap-4">
      <span
        className="text-4xl font-bold tabular-nums text-green-400"
        style={{ textShadow: "0 0 20px #00ff41" }}
      >
        {formatTimer(displayTime)}
      </span>
      <div className="flex flex-col gap-1">
        {status === "ROUND_ACTIVE" && (
          <span className="flex items-center gap-1 text-xs text-green-400 tracking-widest">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        )}
        {status === "PAUSED" && (
          <span className="text-xs text-amber-400 tracking-widest">PAUSED</span>
        )}
        {currentRound > 0 && (
          <span className="text-xs text-green-700 tracking-widest">
            ROUND {currentRound}/{totalRounds}
          </span>
        )}
      </div>
    </div>
  );
}

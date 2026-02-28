"use client";

interface Props {
  status: string;
  currentRound: number;
  totalRounds: number;
  actionLoading: string | null;
  error: string;
  selectedEventId: string | null;
  onAction: (action: string, extra?: Record<string, unknown>) => void;
  onBroadcast: (event: string, data: Record<string, unknown>) => void;
}

export default function GameControls({
  status,
  currentRound,
  totalRounds,
  actionLoading,
  error,
  selectedEventId,
  onAction,
  onBroadcast,
}: Props) {
  const btn =
    "border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <>
      {error && (
        <p
          className="text-red-400 text-xs tracking-widest"
          style={{ textShadow: "0 0 8px #ff0000" }}
        >
          ⚠ {error}
        </p>
      )}

      <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-3">
        <p className="text-xs uppercase tracking-widest text-green-700">
          Game Controls
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <button
            disabled={status !== "READY" || !!actionLoading}
            onClick={() => onAction("START_GAME")}
            className={btn}
          >
            {actionLoading === "START_GAME" ? "..." : "START GAME"}
          </button>
          <button
            disabled={
              (status !== "RUNNING" && status !== "ROUND_END") ||
              !!actionLoading
            }
            onClick={() =>
              onAction("START_ROUND", { roundNumber: currentRound + 1 })
            }
            className={btn}
          >
            {actionLoading === "START_ROUND" ? "..." : "START ROUND"}
          </button>
          <button
            disabled={status !== "ROUND_ACTIVE" || !!actionLoading}
            onClick={() =>
              onAction("END_ROUND", { roundNumber: currentRound, totalRounds })
            }
            className={btn}
          >
            {actionLoading === "END_ROUND" ? "..." : "END ROUND"}
          </button>
          <button
            disabled={status !== "ROUND_ACTIVE" || !!actionLoading}
            onClick={() => onAction("PAUSE")}
            className={btn}
          >
            {actionLoading === "PAUSE" ? "..." : "PAUSE"}
          </button>
          <button
            disabled={status !== "PAUSED" || !!actionLoading}
            onClick={() => onAction("RESUME")}
            className={btn}
          >
            {actionLoading === "RESUME" ? "..." : "RESUME"}
          </button>
          <button
            disabled={!!actionLoading}
            onClick={() => {
              if (window.confirm("Reset game? This cannot be undone."))
                onAction("RESET");
            }}
            className="border border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {actionLoading === "RESET" ? "..." : "RESET"}
          </button>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-3">
        <p className="text-xs uppercase tracking-widest text-green-700">
          Broadcast
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={!selectedEventId}
            onClick={() =>
              onBroadcast("BROADCAST_ROUND_START", {
                eventId: selectedEventId,
                roundNumber: currentRound,
                durationSeconds: 300,
                prices: {},
                caseStudy: null,
              })
            }
            className={btn}
          >
            BROADCAST ROUND START
          </button>
          <button
            disabled={!selectedEventId}
            onClick={() =>
              onBroadcast("BROADCAST_ROUND_END", {
                eventId: selectedEventId,
                roundNumber: currentRound,
              })
            }
            className={btn}
          >
            BROADCAST ROUND END
          </button>
        </div>
      </div>
    </>
  );
}

"use client";

import Spinner from "@/components/shared/Spinner";
import { useModal } from "@/hooks/useModal";

interface Props {
  status: string;
  currentRound: number;
  totalRounds: number;
  actionLoading: string | null;
  error: string;
  selectedEventId: string | null;
  onAction: (action: string, extra?: Record<string, unknown>) => void;
}

export default function GameControls({
  status,
  currentRound,
  totalRounds,
  actionLoading,
  error,
  selectedEventId,
  onAction,
}: Props) {
  const { confirm, ModalRenderer } = useModal();

  const btn =
    "border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed";

  function promptReset() {
    confirm({
      title: "RESET GAME",
      message: "Reset game? This cannot be undone.",
      confirmLabel: "RESET",
      variant: "danger",
      onConfirm: () => onAction("RESET"),
    });
  }

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
            disabled={status !== "READY" || !!actionLoading || !selectedEventId}
            onClick={() => onAction("START_GAME")}
            className={btn}
          >
            {actionLoading === "START_GAME" ? (
              <Spinner size="sm" />
            ) : (
              "START GAME"
            )}
          </button>
          <button
            disabled={
              (status !== "RUNNING" && status !== "ROUND_END") ||
              currentRound >= totalRounds ||
              !!actionLoading
            }
            onClick={() =>
              onAction("START_ROUND", { roundNumber: currentRound + 1 })
            }
            className={btn}
          >
            {actionLoading === "START_ROUND" ? (
              <Spinner size="sm" />
            ) : (
              "START ROUND"
            )}
          </button>
          <button
            disabled={
              status !== "ROUND_ACTIVE" ||
              currentRound <= 0 ||
              !!actionLoading ||
              !selectedEventId
            }
            onClick={() => onAction("END_AND_START_NEXT_ROUND")}
            className={btn}
          >
            {actionLoading === "END_AND_START_NEXT_ROUND" ? (
              <Spinner size="sm" />
            ) : (
              "END ROUND"
            )}
          </button>
          {(status === "ROUND_ACTIVE" || status === "RUNNING") && (
            <button
              disabled={!!actionLoading || !selectedEventId}
              onClick={() => onAction("PAUSE")}
              className={btn}
            >
              {actionLoading === "PAUSE" ? <Spinner size="sm" /> : "PAUSE"}
            </button>
          )}
          {status === "PAUSED" && (
            <button
              disabled={!!actionLoading || !selectedEventId}
              onClick={() => onAction("RESUME")}
              className={btn}
            >
              {actionLoading === "RESUME" ? (
                <Spinner size="sm" />
              ) : (
                "RESUME"
              )}
            </button>
          )}
          <button
            disabled={!!actionLoading}
            onClick={promptReset}
            className="border border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            {actionLoading === "RESET" ? <Spinner size="sm" /> : "RESET"}
          </button>
        </div>
      </div>

      <ModalRenderer />
    </>
  );
}

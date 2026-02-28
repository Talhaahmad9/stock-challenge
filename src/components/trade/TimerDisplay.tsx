"use client";

interface Props {
  timerRemaining: number;
  status: string;
  currentRound: number;
  totalRounds: number;
}

function formatTimer(s: number) {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function TimerDisplay({
  timerRemaining,
  status,
  currentRound,
  totalRounds,
}: Props) {
  return (
    <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 flex items-center gap-4">
      <span
        className="text-4xl font-bold tabular-nums text-green-400"
        style={{ textShadow: "0 0 20px #00ff41" }}
      >
        {formatTimer(timerRemaining)}
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

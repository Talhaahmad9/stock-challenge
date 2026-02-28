"use client";

interface EventRow {
  id: string;
  name: string;
}

interface GameState {
  status: string;
  currentRound: number;
  totalRounds: number;
  timerRemaining: number;
}

interface Props {
  events: EventRow[];
  selectedEventId: string | null;
  gameState: GameState | null;
  onSelect: (id: string | null) => void;
}

function formatTimer(s: number) {
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function statusColor(status: string) {
  switch (status) {
    case "ROUND_ACTIVE":
    case "RUNNING":
      return "text-green-400 border-green-400";
    case "PAUSED":
      return "text-amber-400 border-amber-400";
    case "GAME_END":
      return "text-blue-400 border-blue-400";
    default:
      return "text-green-700 border-green-700";
  }
}

export default function EventSelector({
  events,
  selectedEventId,
  gameState,
  onSelect,
}: Props) {
  return (
    <>
      <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-3">
        <p className="text-xs uppercase tracking-widest text-green-700">
          Active Event
        </p>
        <select
          value={selectedEventId ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
          className="w-full bg-black border border-green-500/30 text-green-300 rounded px-3 py-2 text-sm focus:border-green-400 focus:outline-none"
        >
          <option value="">— select event —</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
      </div>

      {gameState && (
        <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-3">
          <p className="text-xs uppercase tracking-widest text-green-700">
            Game State
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <span
              className={`text-xs border px-2 py-1 rounded tracking-widest ${statusColor(gameState.status)}`}
            >
              {gameState.status}
            </span>
            <span className="text-sm text-green-700 tracking-widest">
              ROUND {gameState.currentRound}/{gameState.totalRounds}
            </span>
            <span className="text-sm tabular-nums text-green-400">
              {formatTimer(gameState.timerRemaining)}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

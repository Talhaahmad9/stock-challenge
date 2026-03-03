"use client";

import { useState } from "react";
import Spinner from "@/components/shared/Spinner";
import { useModal } from "@/hooks/useModal";

interface EventRow {
  id: string;
  name: string;
  status: string;
  starting_balance: number;
  total_rounds: number;
  current_round: number;
}

interface Props {
  events: EventRow[];
  selectedEventId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
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
    case "READY":
      return "text-green-600 border-green-600";
    default:
      return "text-green-900 border-green-900";
  }
}

function fmt(v: number) {
  return "₨" + v.toLocaleString("en-US", { minimumFractionDigits: 0 });
}

const inp =
  "w-full bg-black border border-green-500/30 text-green-300 placeholder-green-900 rounded px-3 py-2 text-sm focus:border-green-400 focus:outline-none";

export default function EventManager({
  events,
  selectedEventId,
  onSelect,
  onRefresh,
}: Props) {
  const { confirm, ModalRenderer } = useModal();
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("100000");
  const [rounds, setRounds] = useState("5");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Event name is required");
      return;
    }
    const bal = parseFloat(balance);
    const rnd = parseInt(rounds, 10);
    if (isNaN(bal) || bal <= 0) {
      setError("Enter a valid starting balance");
      return;
    }
    if (isNaN(rnd) || rnd < 1 || rnd > 10) {
      setError("Rounds must be between 1 and 10");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          starting_balance: bal,
          total_rounds: rnd,
        }),
      });
      const data = (await res.json()) as EventRow & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create event");
      } else {
        setSuccess(`"${data.name}" created — select it from the list below`);
        setName("");
        onRefresh();
        onSelect(data.id);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(eventId: string, eventName: string) {
    confirm({
      title: "DELETE EVENT",
      message: `Delete "${eventName}"? This will permanently remove all rounds, stocks, trades and portfolios.`,
      confirmLabel: "DELETE",
      variant: "danger",
      onConfirm: () => void doDelete(eventId),
    });
  }

  async function doDelete(eventId: string) {
    setDeletingId(eventId);
    try {
      const res = await fetch("/api/admin/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (res.ok) {
        onRefresh();
        if (selectedEventId === eventId) onSelect("");
      }
    } catch {
      /* silent */
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {/* CREATE FORM */}
      <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-4">
        <p className="text-xs uppercase tracking-widest text-green-700">
          Create New Event
        </p>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-green-700 uppercase tracking-widest">
              Event Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Spring Competition 2025"
              className={inp}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-green-700 uppercase tracking-widest">
                Starting Balance (₨)
              </label>
              <input
                type="number"
                min={1}
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="100000"
                className={inp}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-green-700 uppercase tracking-widest">
                Number of Rounds
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={rounds}
                onChange={(e) => setRounds(e.target.value)}
                placeholder="5"
                className={inp}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-xs tracking-widest">⚠ {error}</p>
        )}
        {success && (
          <p className="text-green-400 text-xs tracking-widest">✓ {success}</p>
        )}

        <button
          onClick={() => void handleCreate()}
          disabled={loading || !name.trim()}
          className="border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-4 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? <Spinner size="sm" /> : "CREATE EVENT"}
        </button>

        <p className="text-xs text-green-900 tracking-widest">
          Creates the event, initializes game state, and generates{" "}
          {rounds || "N"} rounds of 5 minutes each. Round durations can be
          adjusted per-round after creation.
        </p>
      </div>

      {/* EVENTS LIST */}
      <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-green-700">
            All Events
          </p>
          <span className="text-xs text-green-900 tracking-widest">
            {events.length} TOTAL
          </span>
        </div>

        {events.length === 0 ? (
          <p className="text-xs text-green-900 text-center py-6 tracking-widest">
            NO EVENTS — CREATE ONE ABOVE
          </p>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => (
              <div
                key={ev.id}
                className={`flex items-center justify-between p-3 rounded border transition-colors cursor-pointer ${
                  selectedEventId === ev.id
                    ? "border-green-400 bg-green-500/5"
                    : "border-green-500/10 hover:border-green-500/30"
                }`}
                onClick={() => onSelect(ev.id)}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-sm text-green-300 truncate">
                      {ev.name}
                    </p>
                    {selectedEventId === ev.id && (
                      <span className="text-xs text-green-600 tracking-widest shrink-0">
                        SELECTED
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-green-900 tracking-widest">
                    <span>{ev.total_rounds} ROUNDS</span>
                    <span>{fmt(ev.starting_balance)} STARTING</span>
                    <span>
                      ROUND {ev.current_round}/{ev.total_rounds}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span
                    className={`text-xs border px-2 py-0.5 rounded tracking-widest ${statusColor(ev.status)}`}
                  >
                    {ev.status}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(ev.id, ev.name);
                    }}
                    disabled={deletingId === ev.id}
                    className="border border-red-500/30 text-red-500/50 hover:text-red-400 hover:border-red-500 text-xs px-2 py-1 rounded tracking-widest uppercase transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {deletingId === ev.id ? <Spinner size="sm" /> : "DELETE"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ModalRenderer />
    </>
  );
}

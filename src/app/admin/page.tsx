"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useGameStore } from "@/store/gameStore";
import useSocket from "@/hooks/useSocket";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventRow {
  id: string;
  name: string;
  status: string;
  starting_balance: number;
  current_round: number;
  total_rounds: number;
}

interface UserRow {
  id: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

interface TradeLog {
  userId: string;
  username?: string;
  timestamp: string;
  tradeData: {
    type: string;
    symbol?: string;
    quantity: number;
    price: number;
  };
}

type Tab = "control" | "users" | "monitor";

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function statusColor(status: string): string {
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

export default function AdminPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuthStore();
  const { gameState, setGameState, setActiveEventId } = useGameStore();

  const [activeTab, setActiveTab] = useState<Tab>("control");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([]);
  const [generateCount, setGenerateCount] = useState("");
  const [generatePrefix, setGeneratePrefix] = useState("player");
  const [generatedUsers, setGeneratedUsers] = useState<
    { username: string; password: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { socketRef, isConnected, emit } = useSocket(selectedEventId);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/events");
      if (res.ok) {
        const data = (await res.json()) as EventRow[];
        setEvents(data);
        if (data.length > 0 && !selectedEventId) {
          setSelectedEventId(data[0].id);
        }
      }
    } catch {
      /* silent */
    }
  }, [selectedEventId]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = (await res.json()) as UserRow[];
        setUsers(data);
      }
    } catch {
      /* silent */
    }
  }, []);

  const fetchGameState = useCallback(
    async (eventId: string) => {
      try {
        const res = await fetch(`/api/game/state?eventId=${eventId}`);
        if (res.ok) {
          const data = (await res.json()) as Parameters<typeof setGameState>[0];
          setGameState(data);
        }
      } catch {
        /* silent */
      }
    },
    [setGameState],
  );

  useEffect(() => {
    if (!user) router.push("/login");
    else if (user.role !== "admin") router.push("/trade");
  }, [user, router]);

  useEffect(() => {
    void fetchEvents();
    void fetchUsers();
  }, [fetchEvents, fetchUsers]);

  useEffect(() => {
    if (selectedEventId) {
      setActiveEventId(selectedEventId);
      void fetchGameState(selectedEventId);
    }
  }, [selectedEventId, setActiveEventId, fetchGameState]);

  // FIX: don't put socketRef.current in deps array — use isConnected as
  // the stable signal that the socket is ready, then register the listener
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    const handler = (payload: {
      userId: string;
      tradeData: TradeLog["tradeData"];
    }) => {
      const log: TradeLog = {
        userId: payload.userId,
        tradeData: payload.tradeData,
        timestamp: new Date().toISOString(),
      };
      setTradeLogs((prev) => [log, ...prev].slice(0, 20));
    };

    socket.on("TRADE_LOG", handler);
    return () => {
      socket.off("TRADE_LOG", handler);
    };
  }, [isConnected, socketRef]); // isConnected is the stable trigger, not socketRef.current

  async function sendGameAction(
    action: string,
    extra?: Record<string, unknown>,
  ) {
    if (!selectedEventId) return;
    setActionLoading(action);
    setError("");
    try {
      const res = await fetch("/api/admin/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, eventId: selectedEventId, ...extra }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Action failed");
      } else {
        await fetchGameState(selectedEventId);
      }
    } catch {
      setError("Network error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGenerateUsers() {
    const count = parseInt(generateCount, 10);
    if (!count || count <= 0) return;
    setIsLoading(true);
    setGeneratedUsers([]);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GENERATE",
          count,
          prefix: generatePrefix,
        }),
      });
      const data = (await res.json()) as {
        created: { username: string; password: string }[];
        errors: string[];
      };
      setGeneratedUsers(data.created ?? []);
      await fetchUsers();
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetPassword(userId: string) {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RESET_PASSWORD", userId }),
    });
    const data = (await res.json()) as { newPassword?: string; error?: string };
    if (data.newPassword) alert(`New password: ${data.newPassword}`);
    else alert(data.error ?? "Failed");
  }

  async function handleToggleActive(userId: string, isActive: boolean) {
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "TOGGLE_ACTIVE",
        userId,
        isActive: !isActive,
      }),
    });
    await fetchUsers();
  }

  function copyGeneratedUsers() {
    const csv = [
      "username,password",
      ...generatedUsers.map((u) => `${u.username},${u.password}`),
    ].join("\n");
    navigator.clipboard.writeText(csv).catch(console.error);
  }

  const status = gameState?.status ?? "IDLE";
  const currentRound = gameState?.currentRound ?? 0;
  const totalRounds = gameState?.totalRounds ?? 0;

  const TABS: { key: Tab; label: string }[] = [
    { key: "control", label: "CONTROL" },
    { key: "users", label: "USERS" },
    { key: "monitor", label: "MONITOR" },
  ];

  return (
    <div className="min-h-screen bg-black font-mono text-green-400">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-black border-b border-green-500/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-widest text-green-400 text-sm">
            ADMIN CONTROL
          </span>
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400" : "bg-red-500"}`}
          />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-green-700 tracking-widest uppercase hidden sm:block">
            {user?.username}
          </span>
          <button
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
            className="border border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase"
          >
            LOGOUT
          </button>
        </div>
      </header>

      {/* TAB BAR */}
      <div className="border-b border-green-500/20 px-4">
        <div className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 text-xs tracking-widest uppercase transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-green-400 text-green-400"
                  : "text-green-700 hover:text-green-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* ── TAB: CONTROL ─────────────────────────────────────────────────── */}
        {activeTab === "control" && (
          <>
            <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-3">
              <p className="text-xs uppercase tracking-widest text-green-700">
                Active Event
              </p>
              <select
                value={selectedEventId ?? ""}
                onChange={(e) => setSelectedEventId(e.target.value || null)}
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
                    className={`text-xs border px-2 py-1 rounded tracking-widest ${statusColor(status)}`}
                  >
                    {status}
                  </span>
                  <span className="text-sm text-green-700 tracking-widest">
                    ROUND {currentRound}/{totalRounds}
                  </span>
                  <span className="text-sm tabular-nums text-green-400">
                    {formatTimer(gameState.timerRemaining)}
                  </span>
                </div>
              </div>
            )}

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
                  onClick={() => void sendGameAction("START_GAME")}
                  className="border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {actionLoading === "START_GAME" ? "..." : "START GAME"}
                </button>
                <button
                  disabled={
                    (status !== "RUNNING" && status !== "ROUND_END") ||
                    !!actionLoading
                  }
                  onClick={() =>
                    void sendGameAction("START_ROUND", {
                      roundNumber: currentRound + 1,
                    })
                  }
                  className="border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {actionLoading === "START_ROUND" ? "..." : "START ROUND"}
                </button>
                <button
                  disabled={status !== "ROUND_ACTIVE" || !!actionLoading}
                  onClick={() =>
                    void sendGameAction("END_ROUND", {
                      roundNumber: currentRound,
                      totalRounds,
                    })
                  }
                  className="border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {actionLoading === "END_ROUND" ? "..." : "END ROUND"}
                </button>
                <button
                  disabled={status !== "ROUND_ACTIVE" || !!actionLoading}
                  onClick={() => void sendGameAction("PAUSE")}
                  className="border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {actionLoading === "PAUSE" ? "..." : "PAUSE"}
                </button>
                <button
                  disabled={status !== "PAUSED" || !!actionLoading}
                  onClick={() => void sendGameAction("RESUME")}
                  className="border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {actionLoading === "RESUME" ? "..." : "RESUME"}
                </button>
                <button
                  disabled={!!actionLoading}
                  onClick={() => {
                    if (window.confirm("Reset game? This cannot be undone.")) {
                      void sendGameAction("RESET");
                    }
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
                    emit("BROADCAST_ROUND_START", {
                      eventId: selectedEventId,
                      roundNumber: currentRound,
                      durationSeconds: 300,
                      prices: {},
                      caseStudy: null,
                    })
                  }
                  className="border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  BROADCAST ROUND START
                </button>
                <button
                  disabled={!selectedEventId}
                  onClick={() =>
                    emit("BROADCAST_ROUND_END", {
                      eventId: selectedEventId,
                      roundNumber: currentRound,
                    })
                  }
                  className="border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  BROADCAST ROUND END
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── TAB: USERS ───────────────────────────────────────────────────── */}
        {activeTab === "users" && (
          <>
            <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-4">
              <p className="text-xs uppercase tracking-widest text-green-700">
                Generate Participants
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-green-700 uppercase tracking-widest">
                    Count
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={generateCount}
                    onChange={(e) => setGenerateCount(e.target.value)}
                    placeholder="10"
                    className="w-full bg-black border border-green-500/30 text-green-300 placeholder-green-900 rounded px-3 py-2 text-sm focus:border-green-400 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-green-700 uppercase tracking-widest">
                    Prefix
                  </label>
                  <input
                    type="text"
                    value={generatePrefix}
                    onChange={(e) => setGeneratePrefix(e.target.value)}
                    placeholder="player"
                    className="w-full bg-black border border-green-500/30 text-green-300 placeholder-green-900 rounded px-3 py-2 text-sm focus:border-green-400 focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={() => void handleGenerateUsers()}
                disabled={isLoading || !generateCount}
                className="border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isLoading ? "GENERATING..." : "GENERATE"}
              </button>

              {generatedUsers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-green-700 tracking-widest uppercase">
                      {generatedUsers.length} users created
                    </p>
                    <button
                      onClick={copyGeneratedUsers}
                      className="border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-1 rounded tracking-widest uppercase"
                    >
                      COPY CSV
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-green-500/10 rounded">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-green-500/10">
                          <th className="text-left px-3 py-2 text-green-700 tracking-widest uppercase">
                            Username
                          </th>
                          <th className="text-left px-3 py-2 text-green-700 tracking-widest uppercase">
                            Password
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {generatedUsers.map((u) => (
                          <tr
                            key={u.username}
                            className="border-b border-green-500/5"
                          >
                            <td className="px-3 py-1 text-green-400">
                              {u.username}
                            </td>
                            <td className="px-3 py-1 text-green-300">
                              {u.password}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-green-700">
                  Participants
                </p>
                <span className="text-xs text-green-700 tracking-widest">
                  {users.length} TOTAL
                </span>
              </div>
              {users.length === 0 ? (
                <p className="text-xs text-green-900 text-center py-6 tracking-widest">
                  NO PARTICIPANTS
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-green-500/10">
                        <th className="text-left px-2 py-2 text-green-700 tracking-widest uppercase">
                          Username
                        </th>
                        <th className="text-left px-2 py-2 text-green-700 tracking-widest uppercase">
                          Status
                        </th>
                        <th className="text-right px-2 py-2 text-green-700 tracking-widest uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-green-500/5">
                          <td className="px-2 py-2 text-green-300">
                            {u.username}
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={`flex items-center gap-1 ${u.is_active ? "text-green-400" : "text-red-400"}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-green-400" : "bg-red-500"}`}
                              />
                              {u.is_active ? "ACTIVE" : "DISABLED"}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => void handleResetPassword(u.id)}
                                className="border border-green-500/30 text-green-700 hover:text-green-400 hover:border-green-400 text-xs px-2 py-1 rounded tracking-widest uppercase"
                              >
                                RESET PWD
                              </button>
                              <button
                                onClick={() =>
                                  void handleToggleActive(u.id, u.is_active)
                                }
                                className={`text-xs px-2 py-1 rounded tracking-widest uppercase ${
                                  u.is_active
                                    ? "border border-red-500/50 text-red-400 hover:bg-red-500/10"
                                    : "border border-green-500/30 text-green-400 hover:bg-green-500/10"
                                }`}
                              >
                                {u.is_active ? "DISABLE" : "ENABLE"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── TAB: MONITOR ─────────────────────────────────────────────────── */}
        {activeTab === "monitor" && (
          <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-green-700">
                Live Trade Feed
              </p>
              <span className="flex items-center gap-2 text-xs text-green-700 tracking-widest">
                <span
                  className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-500"}`}
                />
                {isConnected ? "CONNECTED" : "DISCONNECTED"}
              </span>
            </div>
            {tradeLogs.length === 0 ? (
              <p className="text-xs text-green-900 text-center py-8 tracking-widest">
                WAITING FOR TRADES
              </p>
            ) : (
              <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                {tradeLogs.map((log, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-3 py-2 border-b border-green-500/10 text-xs"
                  >
                    <span className="text-green-900 tabular-nums shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-green-700 shrink-0">
                      {log.username ?? log.userId.slice(0, 8)}
                    </span>
                    <span
                      className={`font-bold tracking-widest shrink-0 ${log.tradeData.type === "BUY" ? "text-green-400" : "text-red-400"}`}
                    >
                      {log.tradeData.type}
                    </span>
                    <span className="text-green-400 tabular-nums shrink-0">
                      {log.tradeData.quantity}
                    </span>
                    {log.tradeData.symbol && (
                      <span className="text-green-300 font-bold shrink-0">
                        {log.tradeData.symbol}
                      </span>
                    )}
                    <span className="text-green-700 tabular-nums shrink-0">
                      @{" "}
                      {log.tradeData.price.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

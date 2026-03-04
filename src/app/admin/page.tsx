"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useGameStore } from "@/store/gameStore";
import useSocket from "@/hooks/useSocket";
import EventSelector from "@/components/admin/EventSelector";
import GameControls from "@/components/admin/GameControls";
import UserManager from "@/components/admin/UserManager";
import StockManager from "@/components/admin/StockManager";
import TradeMonitor from "@/components/admin/TradeMonitor";
import EventManager from "@/components/admin/EventManager";
import { useAuth } from "@/hooks/useAuth";
import Spinner from "@/components/shared/Spinner";
import Leaderboard from "@/components/shared/Leaderboard";

interface EventRow {
  id: string;
  name: string;
  status: string;
  starting_balance: number;
  total_rounds: number;
  current_round: number;
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
  tradeData: { type: string; symbol?: string; quantity: number; price: number };
}
type Tab = "control" | "users" | "stocks" | "monitor" | "events";

const TABS: { key: Tab; label: string }[] = [
  { key: "control", label: "CONTROL" },
  { key: "users", label: "USERS" },
  { key: "stocks", label: "STOCKS" },
  { key: "monitor", label: "MONITOR" },
  { key: "events", label: "EVENTS" },
];

export default function AdminPage() {
  const { ready } = useAuth("admin");
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuthStore();
  const { gameState, setGameState, setActiveEventId } = useGameStore();

  const [activeTab, setActiveTab] = useState<Tab>("control");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [tradeLogs, setTradeLogs] = useState<TradeLog[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Lifted state — persists across tab switches
  const [generated, setGenerated] = useState<
    { username: string; password: string }[]
  >([]);

  const { socketRef, isConnected } = useSocket(selectedEventId);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/events");
      if (res.ok) {
        const data = (await res.json()) as EventRow[];
        setEvents(data);
        if (data.length > 0 && !selectedEventId) setSelectedEventId(data[0].id);
      }
    } catch {
      /* silent */
    }
  }, [selectedEventId]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) setUsers((await res.json()) as UserRow[]);
    } catch {
      /* silent */
    }
  }, []);

  const fetchGameState = useCallback(
    async (eventId: string) => {
      try {
        const res = await fetch(`/api/game/state?eventId=${eventId}`);
        if (res.ok)
          setGameState(
            (await res.json()) as Parameters<typeof setGameState>[0],
          );
      } catch {
        /* silent */
      }
    },
    [setGameState],
  );

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

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;
    const handler = (payload: {
      userId: string;
      tradeData: TradeLog["tradeData"];
    }) => {
      setTradeLogs((prev) =>
        [
          {
            userId: payload.userId,
            tradeData: payload.tradeData,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 20),
      );
    };
    socket.on("TRADE_LOG", handler);
    return () => {
      socket.off("TRADE_LOG", handler);
    };
  }, [isConnected, socketRef]);

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
      if (!res.ok || data.error) setError(data.error ?? "Action failed");
      else await fetchGameState(selectedEventId);
    } catch {
      setError("Network error");
    } finally {
      setActionLoading(null);
    }
  }

  const status = gameState?.status ?? "IDLE";
  const currentRound = gameState?.currentRound ?? 0;
  const totalRounds = gameState?.totalRounds ?? 0;

  if (!ready)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Spinner />
      </div>
    );

  return (
    <div className="min-h-screen bg-black font-mono text-green-400">
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
            className="border border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase cursor-pointer"
          >
            LOGOUT
          </button>
        </div>
      </header>

      <div className="border-b border-green-500/20 px-4">
        <div className="flex gap-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 text-xs tracking-widest uppercase transition-colors whitespace-nowrap cursor-pointer ${activeTab === tab.key ? "border-b-2 border-green-400 text-green-400" : "text-green-700 hover:text-green-400"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {activeTab === "control" && (
          <>
            <EventSelector
              events={events}
              selectedEventId={selectedEventId}
              gameState={gameState}
              onSelect={setSelectedEventId}
            />
            <GameControls
              status={status}
              currentRound={currentRound}
              totalRounds={totalRounds}
              actionLoading={actionLoading}
              error={error}
              selectedEventId={selectedEventId}
              onAction={(action, extra) => void sendGameAction(action, extra)}
            />
          </>
        )}
        {activeTab === "users" && (
          <UserManager
            users={users}
            generated={generated}
            onGenerated={setGenerated}
            onRefresh={() => void fetchUsers()}
            onDeleteUser={(userId) =>
              setGenerated((prev) =>
                prev.filter((u) => {
                  const match = users.find((ur) => ur.id === userId);
                  return !match || u.username !== match.username;
                }),
              )
            }
          />
        )}
        {activeTab === "stocks" && (
          <StockManager eventId={selectedEventId} totalRounds={totalRounds} />
        )}
        {activeTab === "monitor" && (
          <div className="space-y-6">
            <TradeMonitor logs={tradeLogs} isConnected={isConnected} />
            {selectedEventId && (
              <Leaderboard
                eventId={selectedEventId}
                pollInterval={10_000}
                showBreakdown
              />
            )}
          </div>
        )}
        {activeTab === "events" && (
          <EventManager
            events={events}
            selectedEventId={selectedEventId}
            onSelect={(id) => setSelectedEventId(id || null)}
            onRefresh={() => void fetchEvents()}
          />
        )}
      </main>
    </div>
  );
}

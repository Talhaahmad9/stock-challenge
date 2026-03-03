"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useGameStore } from "@/store/gameStore";
import { usePortfolioStore } from "@/store/portfolioStore";
import useSocket from "@/hooks/useSocket";
import { useAuth } from "@/hooks/useAuth";
import Spinner from "@/components/shared/Spinner";
import type { TradeType } from "@/lib/supabase/database.types";
import StatsBar from "@/components/trade/StatsBar";
import TimerDisplay from "@/components/trade/TimerDisplay";
import MarketList from "@/components/trade/MarketList";
import HoldingsList from "@/components/trade/HoldingsList";
import TradeModal from "@/components/trade/TradeModal";
import Leaderboard from "@/components/shared/Leaderboard";

interface ActiveTrade {
  stockId: string;
  symbol: string;
  price: number;
  type: TradeType;
}

function formatCurrency(v: number) {
  return (
    "₨" +
    v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export default function TradePage() {
  // ── All hooks first — no early returns before this block ──────────────────
  const { ready } = useAuth("any");
  const user = useAuthStore((s) => s.user);
  const { gameState, activeEventId, setGameState } = useGameStore();
  const {
    balance,
    holdings,
    stocks,
    isLoading,
    fetchPortfolio,
    getPortfolioValue,
    getTotalValue,
    getTotalPnL,
  } = usePortfolioStore();
  const { isConnected: socketConnected } = useSocket(activeEventId);
  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);
  const [tradeTab, setTradeTab] = useState<"market" | "leaderboard">("market");

  useEffect(() => {
    async function detectEvent() {
      try {
        const res = await fetch("/api/game/active-event");
        if (!res.ok) return;
        const data = (await res.json()) as {
          id: string;
          starting_balance: number;
        };
        useGameStore.getState().setActiveEventId(data.id);
        usePortfolioStore.getState().setStartingBalance(data.starting_balance);
        const gsRes = await fetch(`/api/game/state?eventId=${data.id}`);
        if (gsRes.ok) useGameStore.getState().setGameState(await gsRes.json());
        await usePortfolioStore.getState().fetchPortfolio(data.id);
      } catch {
        /* silent */
      }
    }
    if (user) void detectEvent();
  }, [user]);

  const gameStatus = gameState?.status;
  useEffect(() => {
    if (!activeEventId || gameStatus === "ROUND_ACTIVE") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/game/state?eventId=${activeEventId}`);
        if (res.ok) {
          const data = await res.json();
          setGameState(data);
          if (data.status === "ROUND_ACTIVE")
            await fetchPortfolio(activeEventId);
        }
      } catch {
        /* silent */
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeEventId, gameStatus, setGameState, fetchPortfolio]);

  // ── Early returns after all hooks ─────────────────────────────────────────

  if (!ready)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Spinner />
      </div>
    );

  const status = gameState?.status;

  if (
    !activeEventId ||
    !gameState ||
    ["IDLE", "SETUP", "READY"].includes(status ?? "")
  ) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono">
        <div className="text-center space-y-3">
          <p
            className="text-2xl font-bold text-green-400 animate-pulse"
            style={{ textShadow: "0 0 20px #00ff41" }}
          >
            WAITING FOR GAME TO START
          </p>
          <p className="text-xs text-green-700 tracking-widest uppercase">
            Stand by — competition will begin shortly
          </p>
          {user && (
            <p className="text-xs text-green-900 tracking-widest">
              Logged in as {user.username}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === "GAME_END") {
    return (
      <div className="min-h-screen bg-black font-mono text-green-400">
        <header className="sticky top-0 z-40 bg-black border-b border-green-500/20 px-4 py-3 flex items-center justify-between">
          <span className="font-bold tracking-widest text-green-400 text-sm">
            STOCK CHALLENGE
          </span>
          <span className="text-green-700 text-sm tracking-widest">
            FINAL RESULTS
          </span>
          <span className="text-green-700 tracking-widest uppercase text-xs">
            {user?.username ?? "—"}
          </span>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-6 text-center space-y-3">
            <p className="text-xs uppercase tracking-widest text-green-700">
              Competition Ended — Final Portfolio Value
            </p>
            <p
              className="text-4xl font-bold text-green-400 tabular-nums"
              style={{ textShadow: "0 0 20px #00ff41" }}
            >
              {formatCurrency(getTotalValue())}
            </p>
            <p
              className={`text-lg tabular-nums font-bold ${getTotalPnL() >= 0 ? "text-green-400" : "text-red-400"}`}
            >
              {getTotalPnL() >= 0 ? "+" : ""}
              {formatCurrency(getTotalPnL())} P&L
            </p>
          </div>
          {activeEventId && (
            <Leaderboard eventId={activeEventId} pollInterval={10_000} />
          )}
        </main>
      </div>
    );
  }

  const timerActive = status === "ROUND_ACTIVE" || status === "PAUSED";

  return (
    <div className="min-h-screen bg-black font-mono text-green-400">
      <header className="sticky top-0 z-40 bg-black border-b border-green-500/20 px-4 py-3 flex items-center justify-between">
        <span className="font-bold tracking-widest text-green-400 text-sm">
          STOCK CHALLENGE
        </span>
        <span className="hidden md:block text-green-700 text-sm tracking-widest">
          {gameState.currentRound > 0
            ? `ROUND ${gameState.currentRound}/${gameState.totalRounds}`
            : "PRE-GAME"}
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${socketConnected ? "bg-green-400" : "bg-red-500"}`}
          />
          <span className="text-green-700 tracking-widest uppercase">
            {user?.username ?? "—"}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <StatsBar
          balance={balance}
          portfolioValue={getPortfolioValue()}
          pnl={getTotalPnL()}
          isLoading={isLoading}
        />

        {timerActive && (
          <TimerDisplay
            timerRemaining={gameState.timerRemaining}
            status={status ?? ""}
            currentRound={gameState.currentRound}
            totalRounds={gameState.totalRounds}
          />
        )}

        <div className="flex gap-4 border-b border-green-500/20">
          {(["market", "leaderboard"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setTradeTab(tab)}
              className={`py-2 text-xs tracking-widest uppercase transition-colors cursor-pointer ${tradeTab === tab ? "border-b-2 border-green-400 text-green-400" : "text-green-700 hover:text-green-400"}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {tradeTab === "market" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MarketList
              stocks={stocks}
              holdings={holdings}
              onTrade={(stockId, symbol, price, type) =>
                setActiveTrade({ stockId, symbol, price, type })
              }
            />
            <HoldingsList holdings={holdings} />
          </div>
        )}
        {tradeTab === "leaderboard" && activeEventId && (
          <Leaderboard eventId={activeEventId} pollInterval={10_000} />
        )}
      </main>

      {activeTrade && activeEventId && (
        <TradeModal
          {...activeTrade}
          eventId={activeEventId}
          onClose={() => setActiveTrade(null)}
          onSuccess={async () => {
            setActiveTrade(null);
            await fetchPortfolio(activeEventId);
          }}
        />
      )}
    </div>
  );
}

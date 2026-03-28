"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import StockChart from "@/components/trade/StockChart";

interface ActiveTrade {
  stockId: string;
  symbol: string;
  price: number;
  type: TradeType;
}

function formatCurrency(v: number) {
  return (
    "Rs" +
    v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export default function TradePage() {
  const { ready } = useAuth("any");
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuthStore();
  const activeEventId = useGameStore((s) => s.activeEventId);
  const status = useGameStore((s) => s.gameState?.status);
  const currentRound = useGameStore((s) => s.gameState?.currentRound ?? 0);
  const totalRounds = useGameStore((s) => s.gameState?.totalRounds ?? 0);
  const hasGameState = useGameStore((s) => !!s.gameState);
  const setGameState = useGameStore((s) => s.setGameState);
  const tradingEnabled = useGameStore((s) => s.tradingEnabled);
  const { balance, holdings, stocks, isLoading, fetchPortfolio } =
    usePortfolioStore();

  // Reactive computed values
  const portfolioValue = usePortfolioStore((s) => s.getPortfolioValue());
  const totalPnL = usePortfolioStore((s) => s.getTotalPnL());
  const totalValue = usePortfolioStore((s) => s.getTotalValue());

  const { isConnected: socketConnected } = useSocket(activeEventId);
  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);

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
        const gsRes = await fetch("/api/game/state?eventId=" + data.id);
        if (gsRes.ok) useGameStore.getState().setGameState(await gsRes.json());
        await usePortfolioStore.getState().fetchPortfolio(data.id);
      } catch {}
    }
    if (user) void detectEvent();
  }, [user]);

  const gameStatus = status;

  useEffect(() => {
    if (!activeEventId || gameStatus === "ROUND_ACTIVE") return;
    const interval = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/game/state?eventId=" + activeEventId);
        if (res.ok) {
          const data = await res.json();
          setGameState(data);
          if (data.status === "ROUND_ACTIVE")
            await fetchPortfolio(activeEventId);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [activeEventId, gameStatus, setGameState, fetchPortfolio]);

  if (!ready)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Spinner />
      </div>
    );

  if (
    !activeEventId ||
    !hasGameState ||
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
            Stand by - competition will begin shortly
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
            {user?.username ?? "..."}
          </span>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-6 text-center space-y-3">
            <p className="text-xs uppercase tracking-widest text-green-700">
              Competition Ended - Final Portfolio Value
            </p>
            <p
              className="text-4xl font-bold text-green-400 tabular-nums"
              style={{ textShadow: "0 0 20px #00ff41" }}
            >
              {formatCurrency(totalValue)}
            </p>
            <p
              className={
                "text-lg tabular-nums font-bold " +
                (totalPnL >= 0 ? "text-green-400" : "text-red-400")
              }
            >
              {totalPnL >= 0 ? "+" : ""}
              {formatCurrency(totalPnL)} P&L
            </p>
          </div>
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
          {currentRound > 0
            ? "ROUND " + currentRound + "/" + totalRounds
            : "PRE-GAME"}
        </span>
        <div className="flex items-center gap-3 text-xs">
          <span
            className={
              "w-2 h-2 rounded-full " +
              (socketConnected ? "bg-green-400" : "bg-red-500")
            }
          />
          <span className="text-green-700 tracking-widest uppercase">
            {user?.username ?? "..."}
          </span>
          <button
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
            className="border border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs px-3 py-1 rounded tracking-widest uppercase cursor-pointer"
          >
            LOGOUT
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <StatsBar
          balance={balance}
          portfolioValue={portfolioValue}
          pnl={totalPnL}
          isLoading={isLoading}
        />

        {timerActive && (
          <TimerDisplay
            status={status ?? ""}
            currentRound={currentRound}
            totalRounds={totalRounds}
            activeEventId={activeEventId}
          />
        )}

        <div className="space-y-6">
            {!tradingEnabled && (
              <div className="bg-[#0a0a0a] border border-amber-400/40 rounded-md p-3">
                <p className="text-xs tracking-widest uppercase text-amber-400">
                  Trading is paused
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarketList
                stocks={stocks}
                holdings={holdings}
                tradingEnabled={tradingEnabled}
                onTrade={(stockId, symbol, price, type) => {
                  if (!tradingEnabled) return;
                  setActiveTrade({ stockId, symbol, price, type });
                }}
              />
              <HoldingsList holdings={holdings} />
            </div>
            {activeEventId && currentRound > 0 && (
              <StockChart
                eventId={activeEventId}
                currentRound={currentRound}
                status={status ?? ""}
              />
            )}
        </div>
      </main>

      {activeTrade && activeEventId && tradingEnabled && (
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

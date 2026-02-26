"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useGameStore } from "@/store/gameStore";
import { usePortfolioStore } from "@/store/portfolioStore";
import useSocket from "@/hooks/useSocket";
import type { TradeType } from "@/lib/supabase/database.types";

function formatCurrency(value: number): string {
  return (
    "₨" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface TradeModal {
  open: boolean;
  stockId: string;
  symbol: string;
  price: number;
  type: TradeType;
}

export default function TradePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { gameState, activeEventId } = useGameStore();
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

  const [tradeModal, setTradeModal] = useState<TradeModal | null>(null);
  const [quantity, setQuantity] = useState("");
  const [tradeError, setTradeError] = useState("");
  const [tradeLoading, setTradeLoading] = useState(false);

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  // Auto-detect active event on mount
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
        if (gsRes.ok) {
          const gs = await gsRes.json();
          useGameStore.getState().setGameState(gs);
        }
        await usePortfolioStore.getState().fetchPortfolio(data.id);
      } catch (err) {
        console.error("Failed to detect active event:", err);
      }
    }
    if (user) void detectEvent();
  }, [user]);

  function openModal(
    stockId: string,
    symbol: string,
    price: number,
    type: TradeType,
  ) {
    setTradeModal({ open: true, stockId, symbol, price, type });
    setQuantity("");
    setTradeError("");
  }

  function closeModal() {
    setTradeModal(null);
    setQuantity("");
    setTradeError("");
  }

  async function handleTrade() {
    if (!tradeModal || !activeEventId) return;
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      setTradeError("Enter a valid quantity");
      return;
    }
    setTradeLoading(true);
    setTradeError("");
    try {
      const res = await fetch("/api/participant/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId: tradeModal.stockId,
          type: tradeModal.type,
          quantity: qty,
          eventId: activeEventId,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setTradeError(data.error ?? "Trade failed");
      } else {
        closeModal();
        await fetchPortfolio(activeEventId);
      }
    } catch {
      setTradeError("Network error");
    } finally {
      setTradeLoading(false);
    }
  }

  function getHolding(stockId: string) {
    return holdings.find((h) => h.id === stockId) ?? null;
  }

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
      <div className="min-h-screen bg-black flex items-center justify-center font-mono">
        <div className="text-center space-y-4">
          <p className="text-3xl font-bold text-green-400 tracking-widest">
            COMPETITION ENDED
          </p>
          <p className="text-xs text-green-700 uppercase tracking-widest">
            Final Portfolio Value
          </p>
          <p
            className="text-4xl font-bold text-green-400 tabular-nums"
            style={{ textShadow: "0 0 20px #00ff41" }}
          >
            {formatCurrency(getTotalValue())}
          </p>
          <p className="text-xs text-green-700 tracking-widest">
            Thank you for participating
          </p>
        </div>
      </div>
    );
  }

  const pnl = getTotalPnL();
  const portfolioValue = getPortfolioValue();
  const timerActive = status === "ROUND_ACTIVE" || status === "PAUSED";
  const qty = parseInt(quantity, 10);
  const estimatedTotal = tradeModal && qty > 0 ? tradeModal.price * qty : 0;

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
        {/* STATS BAR */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4">
            <p className="text-xs uppercase tracking-widest text-green-700 mb-1">
              Balance
            </p>
            <p
              className={`text-xl font-bold tabular-nums ${isLoading ? "opacity-40" : ""}`}
            >
              {formatCurrency(balance)}
            </p>
          </div>
          <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4">
            <p className="text-xs uppercase tracking-widest text-green-700 mb-1">
              Portfolio
            </p>
            <p
              className={`text-xl font-bold tabular-nums ${isLoading ? "opacity-40" : ""}`}
            >
              {formatCurrency(portfolioValue)}
            </p>
          </div>
          <div className="col-span-2 md:col-span-1 bg-[#0a0a0a] border border-green-500/20 rounded-md p-4">
            <p className="text-xs uppercase tracking-widest text-green-700 mb-1">
              P&amp;L
            </p>
            <p
              className={`text-xl font-bold tabular-nums ${pnl >= 0 ? "text-green-400" : "text-red-400"} ${isLoading ? "opacity-40" : ""}`}
            >
              {pnl >= 0 ? "+" : ""}
              {formatCurrency(pnl)}
            </p>
          </div>
        </div>

        {/* TIMER */}
        {timerActive && (
          <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 flex items-center gap-4">
            <span
              className="text-4xl font-bold tabular-nums text-green-400"
              style={{ textShadow: "0 0 20px #00ff41" }}
            >
              {formatTimer(gameState.timerRemaining)}
            </span>
            <div className="flex flex-col gap-1">
              {status === "ROUND_ACTIVE" && (
                <span className="flex items-center gap-1 text-xs text-green-400 tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  LIVE
                </span>
              )}
              {status === "PAUSED" && (
                <span className="text-xs text-amber-400 tracking-widest">
                  PAUSED
                </span>
              )}
              {gameState.currentRound > 0 && (
                <span className="text-xs text-green-700 tracking-widest">
                  ROUND {gameState.currentRound}/{gameState.totalRounds}
                </span>
              )}
            </div>
          </div>
        )}

        {/* MARKET + HOLDINGS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* MARKET */}
          <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-4">
            <h2 className="text-xs uppercase tracking-widest text-green-400 font-bold pb-1 border-b border-green-500/20">
              Market
            </h2>
            {stocks.length === 0 && (
              <p className="text-xs text-green-900 text-center py-4 tracking-widest">
                NO STOCKS AVAILABLE
              </p>
            )}
            <div className="space-y-2">
              {stocks.map((stock) => {
                const holding = getHolding(stock.id);
                return (
                  <div
                    key={stock.id}
                    className="flex items-center justify-between py-2 border-b border-green-500/10 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-green-300">
                        {stock.symbol}
                      </p>
                      <p className="text-xs text-green-700 truncate">
                        {stock.name}
                      </p>
                      {holding && (
                        <p className="text-xs text-green-700">
                          {holding.quantity} held
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm tabular-nums text-green-400 w-24 text-right">
                        {formatCurrency(stock.currentPrice)}
                      </span>
                      <button
                        onClick={() =>
                          openModal(
                            stock.id,
                            stock.symbol,
                            stock.currentPrice,
                            "BUY",
                          )
                        }
                        className="bg-green-500 hover:bg-green-400 text-black font-bold text-xs px-3 py-1 rounded"
                      >
                        BUY
                      </button>
                      <button
                        onClick={() =>
                          openModal(
                            stock.id,
                            stock.symbol,
                            stock.currentPrice,
                            "SELL",
                          )
                        }
                        disabled={!holding}
                        className="border border-red-500 text-red-400 hover:bg-red-500/10 text-xs px-3 py-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        SELL
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HOLDINGS */}
          <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-4">
            <h2 className="text-xs uppercase tracking-widest text-green-400 font-bold pb-1 border-b border-green-500/20">
              Holdings
            </h2>
            {holdings.length === 0 ? (
              <p className="text-xs text-green-900 text-center py-8 tracking-widest">
                NO POSITIONS
              </p>
            ) : (
              <div className="space-y-3">
                {holdings.map((h) => (
                  <div
                    key={h.id}
                    className="py-2 border-b border-green-500/10 last:border-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-sm text-green-300">
                        {h.symbol}
                      </p>
                      <p className="text-sm tabular-nums text-green-400">
                        {formatCurrency(h.currentPrice * h.quantity)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-green-700">
                        {h.quantity} @ {formatCurrency(h.avgBuyPrice)}
                      </p>
                      <p
                        className={`text-xs tabular-nums ${h.unrealizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {h.unrealizedPnL >= 0 ? "+" : ""}
                        {formatCurrency(h.unrealizedPnL)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* TRADE MODAL */}
      {tradeModal?.open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-6 w-full max-w-sm space-y-5">
            <div>
              <p className="text-xs text-green-700 tracking-widest uppercase mb-1">
                {tradeModal.type}
              </p>
              <p className="text-xl font-bold text-green-400 tracking-widest">
                {tradeModal.symbol}
              </p>
              <p className="text-sm text-green-700 tabular-nums mt-1">
                Price: {formatCurrency(tradeModal.price)}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-green-700">
                Quantity
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="w-full bg-black border border-green-500/30 text-green-300 placeholder-green-900 rounded px-4 py-3 text-sm focus:border-green-400 focus:outline-none tabular-nums"
              />
              {estimatedTotal > 0 && (
                <p className="text-xs text-green-700 tabular-nums">
                  Estimated {tradeModal.type === "BUY" ? "cost" : "proceeds"}:{" "}
                  <span className="text-green-400">
                    {formatCurrency(estimatedTotal)}
                  </span>
                </p>
              )}
            </div>
            {tradeError && (
              <p
                className="text-red-400 text-xs text-center"
                style={{ textShadow: "0 0 8px #ff0000" }}
              >
                {tradeError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleTrade}
                disabled={tradeLoading}
                className="flex-1 bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded text-xs uppercase tracking-widest"
              >
                {tradeLoading ? "EXECUTING..." : "CONFIRM"}
              </button>
              <button
                onClick={closeModal}
                disabled={tradeLoading}
                className="flex-1 border border-green-500/30 text-green-700 hover:text-green-400 hover:border-green-500 py-3 rounded text-xs uppercase tracking-widest"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

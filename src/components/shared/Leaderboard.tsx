"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface LeaderboardEntry {
  rank: number;
  username: string;
  totalValue: number;
  balance: number;
  portfolioValue: number;
  pnl: number;
  isCurrentUser: boolean;
}

interface Props {
  eventId: string;
  pollInterval?: number;
  showBreakdown?: boolean;
  compact?: boolean;
}

function fmt(v: number): string {
  return (
    "₨" +
    v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtPnL(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (v >= 0 ? "+₨" : "-₨") + abs;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span
        className="inline-block w-8 text-center text-xs font-bold tabular-nums text-yellow-400"
        style={{ textShadow: "0 0 8px #facc15" }}
      >
        #1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-block w-8 text-center text-xs font-bold tabular-nums text-slate-300">
        #2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-block w-8 text-center text-xs font-bold tabular-nums text-amber-600">
        #3
      </span>
    );
  return (
    <span className="inline-block w-8 text-center text-xs tabular-nums text-green-700">
      #{rank}
    </span>
  );
}

function SkeletonRow({ compact }: { compact: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 ${compact ? "py-2" : "py-3"} animate-pulse`}
    >
      <div className="w-8 h-2.5 rounded bg-green-900/30" />
      <div className="flex-1 h-2.5 rounded bg-green-900/30" />
      <div className="w-28 h-2.5 rounded bg-green-900/30" />
      <div className="w-20 h-2.5 rounded bg-green-900/30" />
    </div>
  );
}

export default function Leaderboard({
  eventId,
  pollInterval = 10_000,
  showBreakdown = false,
  compact = false,
}: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const prevRankRef = useRef<Record<string, number>>({});
  const [flashedUsernames, setFlashedUsernames] = useState<Set<string>>(
    new Set(),
  );

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/leaderboard?eventId=${eventId}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as LeaderboardEntry[];

      const prev = prevRankRef.current;
      const changed = new Set(
        data
          .filter(
            (e) =>
              prev[e.username] !== undefined && prev[e.username] !== e.rank,
          )
          .map((e) => e.username),
      );
      if (changed.size > 0) {
        setFlashedUsernames(changed);
        setTimeout(() => setFlashedUsernames(new Set()), 1_400);
      }
      prevRankRef.current = Object.fromEntries(
        data.map((e) => [e.username, e.rank]),
      );
      setEntries(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch leaderboard",
      );
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    setIsLoading(true);
    void fetchLeaderboard();
    const id = setInterval(() => void fetchLeaderboard(), pollInterval);
    return () => clearInterval(id);
  }, [fetchLeaderboard, pollInterval]);

  const headerCls =
    "text-xs uppercase tracking-widest text-green-700 select-none";
  const gridCols = showBreakdown
    ? "grid-cols-[2rem_1fr_repeat(4,auto)]"
    : "grid-cols-[2rem_1fr_auto_auto]";

  return (
    <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md overflow-hidden">
      <div
        className={`flex items-center justify-between border-b border-green-500/20 ${compact ? "px-3 py-2" : "px-4 py-3"}`}
      >
        <p className={headerCls}>Leaderboard</p>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-green-900 tabular-nums">
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
          <span
            className="w-2 h-2 rounded-full bg-green-400 animate-pulse"
            title={`Refreshes every ${pollInterval / 1000}s`}
          />
        </div>
      </div>

      {!isLoading && entries.length > 0 && (
        <div
          className={`grid font-bold border-b border-green-500/10 ${compact ? "px-3 py-1" : "px-4 py-2"} ${gridCols} gap-x-4`}
        >
          <span className={headerCls + " text-center"}>#</span>
          <span className={headerCls}>Player</span>
          {showBreakdown && (
            <>
              <span className={headerCls + " text-right"}>Balance</span>
              <span className={headerCls + " text-right"}>Portfolio</span>
            </>
          )}
          <span className={headerCls + " text-right"}>Total</span>
          <span className={headerCls + " text-right"}>P&amp;L</span>
        </div>
      )}

      <div
        className={`divide-y divide-green-500/10 ${compact ? "max-h-72" : "max-h-112"} overflow-y-auto`}
      >
        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={compact ? "px-3" : "px-4"}>
              <SkeletonRow compact={compact} />
            </div>
          ))}
        {!isLoading && error && (
          <p
            className={`text-xs text-red-400 tracking-widest text-center ${compact ? "py-4" : "py-8"}`}
          >
            ⚠ {error}
          </p>
        )}
        {!isLoading && !error && entries.length === 0 && (
          <p
            className={`text-xs text-green-900 tracking-widest text-center ${compact ? "py-4" : "py-8"}`}
          >
            NO PARTICIPANTS YET
          </p>
        )}
        {!isLoading &&
          !error &&
          entries.map((entry) => {
            const isMe = entry.isCurrentUser;
            const flashing = flashedUsernames.has(entry.username);
            return (
              <div
                key={entry.username}
                className={[
                  "grid gap-x-4 items-center font-mono transition-colors duration-300",
                  compact ? "px-3 py-2" : "px-4 py-3",
                  gridCols,
                  isMe
                    ? "bg-green-500/5 border-l-2 border-l-green-400"
                    : "border-l-2 border-l-transparent",
                  flashing ? "bg-green-500/10" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <RankBadge rank={entry.rank} />
                <div className="min-w-0 flex items-center gap-2 overflow-hidden">
                  <span
                    className={`text-sm truncate ${isMe ? "text-green-300 font-bold" : "text-green-400"}`}
                  >
                    {entry.username}
                  </span>
                  {isMe && (
                    <span className="shrink-0 text-[10px] border border-green-400/50 text-green-400 px-1 rounded tracking-widest uppercase leading-none py-0.5">
                      YOU
                    </span>
                  )}
                </div>
                {showBreakdown && (
                  <>
                    <span className="text-xs tabular-nums text-right text-green-700">
                      {fmt(entry.balance)}
                    </span>
                    <span className="text-xs tabular-nums text-right text-green-700">
                      {fmt(entry.portfolioValue)}
                    </span>
                  </>
                )}
                <span
                  className={`text-sm tabular-nums text-right font-bold ${entry.rank === 1 ? "text-yellow-400" : "text-green-300"}`}
                  style={
                    entry.rank === 1
                      ? { textShadow: "0 0 8px #facc15" }
                      : undefined
                  }
                >
                  {fmt(entry.totalValue)}
                </span>
                <span
                  className={`text-xs tabular-nums text-right ${entry.pnl >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {fmtPnL(entry.pnl)}
                </span>
              </div>
            );
          })}
      </div>

      {!isLoading && entries.length > 0 && (
        <div
          className={`border-t border-green-500/10 ${compact ? "px-3 py-1.5" : "px-4 py-2"} flex justify-between items-center`}
        >
          <span className="text-xs text-green-900 tracking-widest">
            {entries.length} PARTICIPANT{entries.length !== 1 ? "S" : ""}
          </span>
          <button
            onClick={() => void fetchLeaderboard()}
            className="text-xs text-green-700 hover:text-green-400 tracking-widest uppercase transition-colors"
          >
            REFRESH
          </button>
        </div>
      )}
    </div>
  );
}

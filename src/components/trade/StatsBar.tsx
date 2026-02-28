"use client";

interface Props {
  balance: number;
  portfolioValue: number;
  pnl: number;
  isLoading: boolean;
}

function fmt(v: number) {
  return (
    "₨" +
    v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export default function StatsBar({
  balance,
  portfolioValue,
  pnl,
  isLoading,
}: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4">
        <p className="text-xs uppercase tracking-widest text-green-700 mb-1">
          Balance
        </p>
        <p
          className={`text-xl font-bold tabular-nums ${isLoading ? "opacity-40" : ""}`}
        >
          {fmt(balance)}
        </p>
      </div>
      <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4">
        <p className="text-xs uppercase tracking-widest text-green-700 mb-1">
          Portfolio
        </p>
        <p
          className={`text-xl font-bold tabular-nums ${isLoading ? "opacity-40" : ""}`}
        >
          {fmt(portfolioValue)}
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
          {fmt(pnl)}
        </p>
      </div>
    </div>
  );
}

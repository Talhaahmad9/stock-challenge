"use client";

import type { HoldingWithStock } from "@/lib/supabase/database.types";

interface Props {
  holdings: HoldingWithStock[];
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

export default function HoldingsList({ holdings }: Props) {
  return (
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
                <p className="font-bold text-sm text-green-300">{h.symbol}</p>
                <p className="text-sm tabular-nums text-green-400">
                  {fmt(h.currentPrice * h.quantity)}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-green-700">
                  {h.quantity} @ {fmt(h.avgBuyPrice)}
                </p>
                <p
                  className={`text-xs tabular-nums ${h.unrealizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {h.unrealizedPnL >= 0 ? "+" : ""}
                  {fmt(h.unrealizedPnL)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

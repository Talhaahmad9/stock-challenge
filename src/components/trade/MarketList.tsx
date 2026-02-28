"use client";

import type {
  StockWithPrice,
  HoldingWithStock,
} from "@/lib/supabase/database.types";
import type { TradeType } from "@/lib/supabase/database.types";

interface Props {
  stocks: StockWithPrice[];
  holdings: HoldingWithStock[];
  onTrade: (
    stockId: string,
    symbol: string,
    price: number,
    type: TradeType,
  ) => void;
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

export default function MarketList({ stocks, holdings, onTrade }: Props) {
  function getHolding(stockId: string) {
    return holdings.find((h) => h.id === stockId) ?? null;
  }

  return (
    <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-4">
      <h2 className="text-xs uppercase tracking-widest text-green-400 font-bold pb-1 border-b border-green-500/20">
        Market
      </h2>
      {stocks.length === 0 ? (
        <p className="text-xs text-green-900 text-center py-4 tracking-widest">
          NO STOCKS AVAILABLE
        </p>
      ) : (
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
                    {fmt(stock.currentPrice)}
                  </span>
                  <button
                    onClick={() =>
                      onTrade(stock.id, stock.symbol, stock.currentPrice, "BUY")
                    }
                    className="bg-green-500 hover:bg-green-400 text-black font-bold text-xs px-3 py-1 rounded"
                  >
                    BUY
                  </button>
                  <button
                    onClick={() =>
                      onTrade(
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
      )}
    </div>
  );
}

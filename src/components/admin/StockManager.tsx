"use client";

import { useState, useEffect, useCallback, startTransition } from "react";

interface AdminStockRow {
  id: string;
  symbol: string;
  name: string;
  sector: string | null;
  prices: Array<{ roundNumber: number; price: number }>;
}

interface Props {
  eventId: string | null;
  totalRounds: number;
}

export default function StockManager({ eventId, totalRounds }: Props) {
  const [stocks, setStocks] = useState<AdminStockRow[]>([]);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});

  const fetchStocks = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/admin/stocks?eventId=${eventId}`);
      if (!res.ok) return;
      const data = (await res.json()) as AdminStockRow[];

      const inputs: Record<string, string> = {};
      for (const s of data) {
        for (const p of s.prices) {
          inputs[`${s.id}-${p.roundNumber}`] = String(p.price);
        }
      }

      // Batch both updates in one render to avoid cascading renders warning
      startTransition(() => {
        setStocks(data);
        setPriceInputs(inputs);
      });
    } catch {
      /* silent */
    }
  }, [eventId]);

  useEffect(() => {
    void fetchStocks();
  }, [fetchStocks]);

  async function handleCreate() {
    if (!eventId || !symbol || !name) return;
    await fetch("/api/admin/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREATE_STOCK",
        eventId,
        symbol: symbol.toUpperCase(),
        name,
        sector: sector || null,
      }),
    });
    setSymbol("");
    setName("");
    setSector("");
    void fetchStocks();
  }

  async function handleSetPrice(stockId: string, roundNumber: number) {
    if (!eventId) return;
    const price = parseFloat(priceInputs[`${stockId}-${roundNumber}`] ?? "");
    if (isNaN(price)) return;
    await fetch("/api/admin/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SET_PRICE",
        stockId,
        roundNumber,
        price,
        eventId,
      }),
    });
    void fetchStocks();
  }

  async function handleDelete(stockId: string) {
    if (!window.confirm("Delete this stock and all its prices?")) return;
    await fetch("/api/admin/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE_STOCK", stockId }),
    });
    void fetchStocks();
  }

  const inp =
    "w-full bg-black border border-green-500/30 text-green-300 placeholder-green-900 rounded px-3 py-2 text-sm focus:border-green-400 focus:outline-none";

  return (
    <>
      <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-4">
        <p className="text-xs uppercase tracking-widest text-green-700">
          Add Stock
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-green-700 uppercase tracking-widest">
              Symbol
            </label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              maxLength={8}
              className={inp + " uppercase"}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-green-700 uppercase tracking-widest">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Apple Inc."
              className={inp}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-green-700 uppercase tracking-widest">
              Sector
            </label>
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Technology"
              className={inp}
            />
          </div>
        </div>
        <button
          onClick={() => void handleCreate()}
          disabled={!symbol || !name || !eventId}
          className="border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ADD STOCK
        </button>
      </div>

      <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-4">
        <p className="text-xs uppercase tracking-widest text-green-700">
          Stock Prices
        </p>
        {stocks.length === 0 ? (
          <p className="text-xs text-green-900 text-center py-6 tracking-widest">
            NO STOCKS — ADD STOCKS ABOVE
          </p>
        ) : (
          <div className="space-y-6">
            {stocks.map((stock) => (
              <div key={stock.id} className="space-y-3">
                <div className="flex items-center justify-between border-b border-green-500/10 pb-2">
                  <div>
                    <span className="font-bold text-sm text-green-300">
                      {stock.symbol}
                    </span>
                    <span className="text-green-700 text-xs ml-2">
                      {stock.name}
                    </span>
                    {stock.sector && (
                      <span className="text-green-900 text-xs ml-2">
                        {stock.sector}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => void handleDelete(stock.id)}
                    className="border border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs px-2 py-1 rounded tracking-widest uppercase"
                  >
                    DELETE
                  </button>
                </div>
                {totalRounds > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: totalRounds }, (_, i) => i + 1).map(
                      (rn) => {
                        const key = `${stock.id}-${rn}`;
                        return (
                          <div
                            key={rn}
                            className="flex flex-col items-center gap-1"
                          >
                            <span className="text-xs text-green-900 tracking-widest">
                              R{rn}
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={priceInputs[key] ?? ""}
                                onChange={(e) =>
                                  setPriceInputs((p) => ({
                                    ...p,
                                    [key]: e.target.value,
                                  }))
                                }
                                placeholder="0.00"
                                className="w-20 bg-black border border-green-500/20 text-green-300 placeholder-green-900 rounded px-2 py-1 text-xs focus:border-green-400 focus:outline-none tabular-nums"
                              />
                              <button
                                onClick={() =>
                                  void handleSetPrice(stock.id, rn)
                                }
                                className="border border-green-500/30 text-green-700 hover:text-green-400 hover:border-green-400 text-xs px-2 py-1 rounded uppercase"
                              >
                                SET
                              </button>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-green-900 tracking-widest">
                    Select an event with rounds to set prices.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

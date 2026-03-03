"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import Spinner from "@/components/shared/Spinner";
import { useModal } from "@/hooks/useModal";

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

// Tracks per-button state: idle | loading | done
type BtnState = "idle" | "loading" | "done";

function useBtnState() {
  const [state, setState] = useState<BtnState>("idle");

  async function run(fn: () => Promise<void>) {
    setState("loading");
    try {
      await fn();
      setState("done");
      setTimeout(() => setState("idle"), 900);
    } catch {
      setState("idle");
    }
  }

  return { state, run };
}

function BtnLabel({ state, label }: { state: BtnState; label: string }) {
  if (state === "loading") return <Spinner size="sm" />;
  if (state === "done") return <span className="text-green-400">✓</span>;
  return <>{label}</>;
}

export default function StockManager({ eventId, totalRounds }: Props) {
  const { confirm, ModalRenderer } = useModal();
  const [stocks, setStocks] = useState<AdminStockRow[]>([]);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});

  // Per-button states
  const addBtn = useBtnState();
  const [deleteBtns, setDeleteBtns] = useState<Record<string, BtnState>>({});
  const [priceBtns, setPriceBtns] = useState<Record<string, BtnState>>({});

  function setPriceBtn(key: string, s: BtnState) {
    setPriceBtns((p) => ({ ...p, [key]: s }));
  }
  function setDeleteBtn(id: string, s: BtnState) {
    setDeleteBtns((p) => ({ ...p, [id]: s }));
  }

  const fetchStocks = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/admin/stocks?eventId=${eventId}`);
      if (!res.ok) return;
      const data = (await res.json()) as AdminStockRow[];
      const inputs: Record<string, string> = {};
      for (const s of data)
        for (const p of s.prices)
          inputs[`${s.id}-${p.roundNumber}`] = String(p.price);
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
    await addBtn.run(async () => {
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
      await fetchStocks();
    });
  }

  async function handleSetPrice(stockId: string, roundNumber: number) {
    if (!eventId) return;
    const price = parseFloat(priceInputs[`${stockId}-${roundNumber}`] ?? "");
    if (isNaN(price)) return;
    const key = `${stockId}-${roundNumber}`;
    setPriceBtn(key, "loading");
    try {
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
      await fetchStocks();
      setPriceBtn(key, "done");
      setTimeout(() => setPriceBtn(key, "idle"), 900);
    } catch {
      setPriceBtn(key, "idle");
    }
  }

  async function handleDelete(stockId: string) {
    confirm({
      title: "DELETE STOCK",
      message: "This will permanently delete the stock and all its prices.",
      confirmLabel: "DELETE",
      variant: "danger",
      onConfirm: () => void doDelete(stockId),
    });
  }

  async function doDelete(stockId: string) {
    setDeleteBtn(stockId, "loading");
    try {
      await fetch("/api/admin/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_STOCK", stockId }),
      });
      await fetchStocks();
      setDeleteBtn(stockId, "done");
      setTimeout(() => setDeleteBtn(stockId, "idle"), 900);
    } catch {
      setDeleteBtn(stockId, "idle");
    }
  }

  const inp =
    "w-full bg-black border border-green-500/30 text-green-300 placeholder-green-900 rounded px-3 py-2 text-sm focus:border-green-400 focus:outline-none";
  const baseBtnCls =
    "cursor-pointer disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <>
      {/* ADD STOCK */}
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
          disabled={!symbol || !name || !eventId || addBtn.state !== "idle"}
          className={`border border-green-500/30 text-green-400 hover:border-green-400 hover:bg-green-500/10 text-xs px-3 py-2 rounded tracking-widest uppercase min-w-22.5 ${baseBtnCls}`}
        >
          <BtnLabel state={addBtn.state} label="ADD STOCK" />
        </button>
      </div>

      {/* STOCK PRICES */}
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
            {stocks.map((stock) => {
              const delState = deleteBtns[stock.id] ?? "idle";
              return (
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
                      disabled={delState !== "idle"}
                      className={`border border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs px-2 py-1 rounded tracking-widest uppercase min-w-16 ${baseBtnCls}`}
                    >
                      <BtnLabel state={delState} label="DELETE" />
                    </button>
                  </div>

                  {totalRounds > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: totalRounds }, (_, i) => i + 1).map(
                        (rn) => {
                          const key = `${stock.id}-${rn}`;
                          const pState = priceBtns[key] ?? "idle";
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
                                  disabled={pState !== "idle"}
                                  className={`border border-green-500/30 text-green-700 hover:text-green-400 hover:border-green-400 text-xs px-2 py-1 rounded uppercase min-w-9 text-center ${baseBtnCls}`}
                                >
                                  <BtnLabel state={pState} label="SET" />
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
              );
            })}
          </div>
        )}
      </div>
      <ModalRenderer />
    </>
  );
}

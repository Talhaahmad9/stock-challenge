"use client";

import { useState } from "react";
import Spinner from "@/components/shared/Spinner";
import type { TradeType } from "@/lib/supabase/database.types";

interface Props {
  stockId: string;
  symbol: string;
  price: number;
  type: TradeType;
  eventId: string;
  onClose: () => void;
  onSuccess: () => void;
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

export default function TradeModal({
  stockId,
  symbol,
  price,
  type,
  eventId,
  onClose,
  onSuccess,
}: Props) {
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const qty = parseInt(quantity, 10);
  const estimatedTotal = qty > 0 ? price * qty : 0;

  async function handleConfirm() {
    if (!qty || qty <= 0) {
      setError("Enter a valid quantity");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/participant/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockId, type, quantity: qty, eventId }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Trade failed");
      } else {
        onSuccess();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
      <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-6 w-full max-w-sm space-y-5">
        <div>
          <p className="text-xs text-green-700 tracking-widest uppercase mb-1">
            {type}
          </p>
          <p className="text-xl font-bold text-green-400 tracking-widest">
            {symbol}
          </p>
          <p className="text-sm text-green-700 tabular-nums mt-1">
            Price: {fmt(price)}
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
            autoFocus
            className="w-full bg-black border border-green-500/30 text-green-300 placeholder-green-900 rounded px-4 py-3 text-sm focus:border-green-400 focus:outline-none tabular-nums"
          />
          {estimatedTotal > 0 && (
            <p className="text-xs text-green-700 tabular-nums">
              Estimated {type === "BUY" ? "cost" : "proceeds"}:{" "}
              <span className="text-green-400">{fmt(estimatedTotal)}</span>
            </p>
          )}
        </div>
        {error && (
          <p
            className="text-red-400 text-xs text-center"
            style={{ textShadow: "0 0 8px #ff0000" }}
          >
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded text-xs uppercase tracking-widest"
          >
            {loading ? (
              <>
                <Spinner size="sm" />
                <span>EXECUTING</span>
              </>
            ) : (
              "CONFIRM"
            )}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 border border-green-500/30 text-green-700 hover:text-green-400 hover:border-green-500 py-3 rounded text-xs uppercase tracking-widest"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface StockSeries {
  symbol: string;
  name: string;
  data: { round: number; price: number }[];
}

interface ChartPoint {
  round: string;
  [symbol: string]: number | string;
}

interface Props {
  eventId: string;
  currentRound: number;
}

// Cyberpunk green palette — distinct shades per stock
const COLORS = [
  "#4ade80", // green-400
  "#86efac", // green-300
  "#a3e635", // lime-400
  "#34d399", // emerald-400
  "#2dd4bf", // teal-400
  "#22d3ee", // cyan-400
  "#67e8f9", // cyan-300
  "#6ee7b7", // emerald-300
];

// Custom tooltip styled to match the design system
function CyberpunkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black border border-green-500/30 rounded px-3 py-2 font-mono text-xs space-y-1">
      <p className="text-green-700 tracking-widest uppercase">Round {label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="tabular-nums">
          {p.name}: ₨
          {p.value.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      ))}
    </div>
  );
}

export default function StockChart({ eventId, currentRound }: Props) {
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchChart = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/charts?eventId=${eventId}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        stocks: StockSeries[];
        rounds: number[];
      };

      if (!data.stocks.length) {
        setIsLoading(false);
        return;
      }

      // Merge all stocks into one array of { round, AAPL, GOOG, ... }
      const pointMap: Record<number, ChartPoint> = {};
      for (const stock of data.stocks) {
        for (const point of stock.data) {
          if (!pointMap[point.round])
            pointMap[point.round] = { round: `R${point.round}` };
          pointMap[point.round][stock.symbol] = point.price;
        }
      }

      const sorted = Object.values(pointMap).sort(
        (a, b) =>
          parseInt(String(a.round).slice(1)) -
          parseInt(String(b.round).slice(1)),
      );

      setChartData(sorted);
      setSymbols(data.stocks.map((s) => s.symbol));
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void fetchChart();
  }, [fetchChart, currentRound]); // refetch when round changes

  if (isLoading)
    return (
      <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4">
        <p className="text-xs text-green-900 tracking-widest text-center py-8 animate-pulse">
          LOADING CHART DATA...
        </p>
      </div>
    );

  if (!chartData.length) return null;

  return (
    <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-green-700">
          Price History
        </p>
        <p className="text-xs text-green-900 tracking-widest">
          ROUND {currentRound}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#14532d30" />
          <XAxis
            dataKey="round"
            tick={{ fill: "#166534", fontSize: 10, fontFamily: "monospace" }}
            axisLine={{ stroke: "#14532d50" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#166534", fontSize: 10, fontFamily: "monospace" }}
            axisLine={{ stroke: "#14532d50" }}
            tickLine={false}
            tickFormatter={(v: number) => `₨${v}`}
            width={60}
          />
          <Tooltip content={<CyberpunkTooltip />} />
          <Legend
            wrapperStyle={{
              fontSize: "10px",
              fontFamily: "monospace",
              color: "#166534",
              paddingTop: "8px",
            }}
          />
          {symbols.map((symbol, i) => (
            <Line
              key={symbol}
              type="monotone"
              dataKey={symbol}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ fill: COLORS[i % COLORS.length], r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

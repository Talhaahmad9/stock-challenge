"use client";

interface TradeLog {
  userId: string;
  username?: string;
  timestamp: string;
  tradeData: { type: string; symbol?: string; quantity: number; price: number };
}

interface Props {
  logs: TradeLog[];
  isConnected: boolean;
}

export default function TradeMonitor({ logs, isConnected }: Props) {
  return (
    <div className="bg-[#0a0a0a] border border-green-500/20 rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-green-700">
          Live Trade Feed
        </p>
        <span className="flex items-center gap-2 text-xs text-green-700 tracking-widest">
          <span
            className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-500"}`}
          />
          {isConnected ? "CONNECTED" : "DISCONNECTED"}
        </span>
      </div>
      {logs.length === 0 ? (
        <p className="text-xs text-green-900 text-center py-8 tracking-widest">
          WAITING FOR TRADES
        </p>
      ) : (
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {logs.map((log, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-3 py-2 border-b border-green-500/10 text-xs"
            >
              <span className="text-green-900 tabular-nums shrink-0">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-green-700 shrink-0">
                {log.username ?? log.userId.slice(0, 8)}
              </span>
              <span
                className={`font-bold tracking-widest shrink-0 ${log.tradeData.type === "BUY" ? "text-green-400" : "text-red-400"}`}
              >
                {log.tradeData.type}
              </span>
              <span className="text-green-400 tabular-nums shrink-0">
                {log.tradeData.quantity}
              </span>
              {log.tradeData.symbol && (
                <span className="text-green-300 font-bold shrink-0">
                  {log.tradeData.symbol}
                </span>
              )}
              <span className="text-green-700 tabular-nums shrink-0">
                @{" "}
                {log.tradeData.price.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

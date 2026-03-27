import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/services/auth.service";
import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

interface RoundRow {
  id: string;
  round_number: number;
}

interface TradeRow {
  stock_id: string;
  round_id: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  executed_at: string;
}

interface StockPriceRow {
  stock_id: string;
  round_id: string;
  price: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await verifySession(token);
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  if (!eventId)
    return NextResponse.json({ error: "eventId required" }, { status: 400 });

  try {
    const supabase = (await createServiceClient()) as unknown as SupabaseClient;

    // Get current round from game_state
    const { data: gsData } = await supabase
      .from("game_state")
      .select("current_round")
      .eq("event_id", eventId)
      .single();

    const currentRound =
      (gsData as { current_round: number } | null)?.current_round ?? 0;
    if (currentRound === 0) {
      return NextResponse.json({ series: [] });
    }

    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("starting_balance")
      .eq("id", eventId)
      .single();

    if (eventError || !eventData) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const startingBalance = (eventData as { starting_balance: number })
      .starting_balance;

    // Get rounds up to current round only
    const { data: rounds } = await supabase
      .from("rounds")
      .select("id, round_number")
      .eq("event_id", eventId)
      .lte("round_number", currentRound)
      .order("round_number", { ascending: true });

    if (!rounds || rounds.length === 0) {
      return NextResponse.json({ series: [] });
    }

    const roundRows = rounds as RoundRow[];
    const roundIds = roundRows.map((r) => r.id);

    const { data: trades } = await supabase
      .from("trades")
      .select("stock_id, round_id, type, quantity, price, executed_at")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .in("round_id", roundIds);

    const { data: prices } = await supabase
      .from("stock_prices")
      .select("stock_id, round_id, price")
      .in("round_id", roundIds);

    const tradesByRound = new Map<string, TradeRow[]>();
    for (const trade of (trades as TradeRow[] | null) ?? []) {
      const current = tradesByRound.get(trade.round_id) ?? [];
      current.push(trade);
      tradesByRound.set(trade.round_id, current);
    }
    for (const [roundId, roundTrades] of tradesByRound.entries()) {
      roundTrades.sort((a, b) =>
        a.executed_at.localeCompare(b.executed_at),
      );
      tradesByRound.set(roundId, roundTrades);
    }

    const pricesByRound = new Map<string, Map<string, number>>();
    for (const priceRow of (prices as StockPriceRow[] | null) ?? []) {
      const current = pricesByRound.get(priceRow.round_id) ?? new Map();
      current.set(priceRow.stock_id, priceRow.price);
      pricesByRound.set(priceRow.round_id, current);
    }

    const holdings = new Map<string, { quantity: number; avgBuyPrice: number }>();
    const lastKnownPriceByStock = new Map<string, number>();
    let cash = startingBalance;

    const series = roundRows.map((round) => {
      const roundTrades = tradesByRound.get(round.id) ?? [];
      for (const trade of roundTrades) {
        const existing = holdings.get(trade.stock_id) ?? {
          quantity: 0,
          avgBuyPrice: 0,
        };

        if (trade.type === "BUY") {
          const newQty = existing.quantity + trade.quantity;
          const newAvg =
            newQty === 0
              ? 0
              : (existing.quantity * existing.avgBuyPrice +
                  trade.quantity * trade.price) /
                newQty;
          cash -= trade.quantity * trade.price;
          holdings.set(trade.stock_id, {
            quantity: newQty,
            avgBuyPrice: newAvg,
          });
        } else {
          cash += trade.quantity * trade.price;
          const remainingQty = Math.max(0, existing.quantity - trade.quantity);
          if (remainingQty === 0) {
            holdings.delete(trade.stock_id);
          } else {
            holdings.set(trade.stock_id, {
              quantity: remainingQty,
              avgBuyPrice: existing.avgBuyPrice,
            });
          }
        }
      }

      const roundPrices = pricesByRound.get(round.id) ?? new Map<string, number>();
      for (const [stockId, price] of roundPrices.entries()) {
        lastKnownPriceByStock.set(stockId, price);
      }
      let holdingsValue = 0;
      for (const [stockId, position] of holdings.entries()) {
        const markPrice =
          roundPrices.get(stockId) ??
          lastKnownPriceByStock.get(stockId) ??
          position.avgBuyPrice;
        holdingsValue += position.quantity * markPrice;
      }

      const totalValue = cash + holdingsValue;
      return {
        round: round.round_number,
        pnl: totalValue - startingBalance,
        totalValue,
      };
    });

    return NextResponse.json({ series });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

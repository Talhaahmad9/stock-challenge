import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/services/auth.service";
import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

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
    if (currentRound === 0)
      return NextResponse.json({ stocks: [], rounds: [] });

    // Get all stocks for this event
    const { data: stocks } = await supabase
      .from("stocks")
      .select("id, symbol, name")
      .eq("event_id", eventId);

    if (!stocks || stocks.length === 0)
      return NextResponse.json({ stocks: [], rounds: [] });

    const stockIds = (
      stocks as { id: string; symbol: string; name: string }[]
    ).map((s) => s.id);

    // Get rounds up to current round only
    const { data: rounds } = await supabase
      .from("rounds")
      .select("id, round_number")
      .eq("event_id", eventId)
      .lte("round_number", currentRound)
      .order("round_number", { ascending: true });

    if (!rounds || rounds.length === 0)
      return NextResponse.json({ stocks: [], rounds: [] });

    const roundIds = (rounds as { id: string; round_number: number }[]).map(
      (r) => r.id,
    );

    // Get all prices for these stocks and rounds
    const { data: prices } = await supabase
      .from("stock_prices")
      .select("stock_id, round_id, price")
      .in("stock_id", stockIds)
      .in("round_id", roundIds);

    // Build round number lookup
    const roundNumberMap = Object.fromEntries(
      (rounds as { id: string; round_number: number }[]).map((r) => [
        r.id,
        r.round_number,
      ]),
    );

    // Build chart data: { symbol, data: [{ round: 1, price: 45 }, ...] }[]
    const chartData = (stocks as { id: string; symbol: string; name: string }[])
      .map((stock) => {
        const stockPrices = (
          (prices as { stock_id: string; round_id: string; price: number }[]) ??
          []
        )
          .filter((p) => p.stock_id === stock.id)
          .map((p) => ({ round: roundNumberMap[p.round_id], price: p.price }))
          .filter((p) => p.round !== undefined)
          .sort((a, b) => a.round - b.round);

        return { symbol: stock.symbol, name: stock.name, data: stockPrices };
      })
      .filter((s) => s.data.length > 0);

    const roundNumbers = (rounds as { id: string; round_number: number }[]).map(
      (r) => r.round_number,
    );

    return NextResponse.json({ stocks: chartData, rounds: roundNumbers });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/services/auth.service";
import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthUser } from "@/lib/supabase/database.types";

type AdminCheck =
  | { user: AuthUser; error?: never; status?: never }
  | { user?: never; error: string; status: number };

async function requireAdmin(_request: NextRequest): Promise<AdminCheck> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return { error: "Not authenticated", status: 401 };
  const user = await verifySession(token);
  if (!user) return { error: "Not authenticated", status: 401 };
  if (user.role !== "admin") return { error: "Forbidden", status: 403 };
  return { user };
}

interface StockRow {
  id: string;
  symbol: string;
  name: string;
  sector: string | null;
  event_id: string;
}

interface RoundRow {
  id: string;
  round_number: number;
}

interface StockPriceWithRound {
  price: number;
  round_id: string;
  stock_id: string;
  rounds: { round_number: number } | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!eventId)
    return NextResponse.json({ error: "eventId required" }, { status: 400 });

  try {
    const supabase = (await createServiceClient()) as unknown as SupabaseClient;

    const { data: stocksData, error: stocksError } = await supabase
      .from("stocks")
      .select("id, symbol, name, sector, event_id")
      .eq("event_id", eventId)
      .order("symbol", { ascending: true });

    if (stocksError)
      return NextResponse.json({ error: stocksError.message }, { status: 500 });

    const stocks = (stocksData as unknown as StockRow[]) ?? [];
    if (stocks.length === 0) return NextResponse.json([]);

    const stockIds = stocks.map((s) => s.id);

    const { data: pricesData, error: pricesError } = await supabase
      .from("stock_prices")
      .select("price, round_id, stock_id, rounds(round_number)")
      .in("stock_id", stockIds);

    if (pricesError)
      return NextResponse.json({ error: pricesError.message }, { status: 500 });

    const pricesByStock = new Map<
      string,
      Array<{ roundNumber: number; price: number }>
    >();

    for (const row of (pricesData as unknown as StockPriceWithRound[]) ?? []) {
      const roundNumber = row.rounds?.round_number ?? 0;
      const existing = pricesByStock.get(row.stock_id) ?? [];
      existing.push({ roundNumber, price: row.price });
      pricesByStock.set(row.stock_id, existing);
    }

    const result = stocks.map((stock) => ({
      ...stock,
      prices: (pricesByStock.get(stock.id) ?? []).sort(
        (a, b) => a.roundNumber - b.roundNumber,
      ),
    }));

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = (await request.json()) as {
      action: string;
      eventId?: string;
      symbol?: string;
      name?: string;
      sector?: string | null;
      stockId?: string;
      roundNumber?: number;
      price?: number;
    };

    const supabase = (await createServiceClient()) as unknown as SupabaseClient;

    switch (body.action) {
      case "CREATE_STOCK": {
        const { eventId, symbol, name, sector } = body;
        if (!eventId || !symbol || !name) {
          return NextResponse.json(
            { error: "eventId, symbol and name are required" },
            { status: 400 },
          );
        }
        const { data, error } = await supabase
          .from("stocks")
          .insert({
            event_id: eventId,
            symbol: symbol.toUpperCase(),
            name,
            sector: sector ?? null,
          })
          .select("id, symbol, name, sector, event_id")
          .single();

        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data as unknown as StockRow, { status: 201 });
      }

      case "SET_PRICE": {
        const { stockId, roundNumber, price, eventId } = body;
        if (
          !stockId ||
          roundNumber === undefined ||
          price === undefined ||
          !eventId
        ) {
          return NextResponse.json(
            { error: "stockId, roundNumber, price and eventId are required" },
            { status: 400 },
          );
        }

        const { data: roundData, error: roundError } = await supabase
          .from("rounds")
          .select("id, round_number")
          .eq("event_id", eventId)
          .eq("round_number", roundNumber)
          .single();

        if (roundError || !roundData) {
          return NextResponse.json(
            { error: "Round not found" },
            { status: 404 },
          );
        }

        const round = roundData as unknown as RoundRow;

        // FIX: removed `satisfies` clause — causes type error with Supabase generics
        const { error: upsertError } = await supabase
          .from("stock_prices")
          .upsert(
            { stock_id: stockId, round_id: round.id, price },
            { onConflict: "stock_id,round_id" },
          );

        if (upsertError)
          return NextResponse.json(
            { error: upsertError.message },
            { status: 500 },
          );
        return NextResponse.json({ success: true });
      }

      case "DELETE_STOCK": {
        const { stockId } = body;
        if (!stockId)
          return NextResponse.json(
            { error: "stockId required" },
            { status: 400 },
          );

        const { error } = await supabase
          .from("stocks")
          .delete()
          .eq("id", stockId);
        if (error)
          return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

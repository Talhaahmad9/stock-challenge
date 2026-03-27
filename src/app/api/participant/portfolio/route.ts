import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/services/auth.service";
import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HoldingWithStock, StockWithPrice } from "@/lib/supabase/database.types";

interface PortfolioRow {
  id: string;
  balance: number;
}

interface StockRow {
  id: string;
  symbol: string;
  name: string;
  sector: string | null;
}

interface HoldingRow {
  stock_id: string;
  quantity: number;
  avg_buy_price: number;
}

interface StockPriceRow {
  stock_id: string;
  price: number;
}

interface RoundRow {
  id: string;
}

interface RpcPortfolioSnapshot {
  balance: number;
  starting_balance: number;
  holdings: HoldingWithStock[];
  stocks: StockWithPrice[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await verifySession(token);
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!eventId)
    return NextResponse.json({ error: "eventId required" }, { status: 400 });

  try {
    const supabase = (await createServiceClient()) as unknown as SupabaseClient;

    // Fast path: use DB-side snapshot aggregation if migration has been applied.
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_participant_portfolio_snapshot",
      {
        p_event_id: eventId,
        p_user_id: user.id,
      },
    );

    if (!rpcError && rpcData) {
      const snapshot = rpcData as RpcPortfolioSnapshot;
      return NextResponse.json(
        {
          portfolio: {
            balance: snapshot.balance ?? 0,
            holdings: snapshot.holdings ?? [],
          },
          stocks: snapshot.stocks ?? [],
          startingBalance: snapshot.starting_balance ?? 0,
        },
        {
          headers: {
            "Cache-Control": "private, max-age=1, stale-while-revalidate=4",
          },
        },
      );
    }

    const [portfolioRes, stocksRes, eventRes, gameStateRes] = await Promise.all([
      supabase
        .from("portfolios")
        .select("id, balance")
        .eq("user_id", user.id)
        .eq("event_id", eventId)
        .single(),
      supabase
        .from("stocks")
        .select("id, symbol, name, sector")
        .eq("event_id", eventId),
      supabase
        .from("events")
        .select("starting_balance")
        .eq("id", eventId)
        .single(),
      supabase
        .from("game_state")
        .select("current_round")
        .eq("event_id", eventId)
        .single(),
    ]);

    if (portfolioRes.error || !portfolioRes.data) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }

    const portfolio = portfolioRes.data as PortfolioRow;
    const stocks = (stocksRes.data as StockRow[] | null) ?? [];
    const startingBalance =
      (eventRes.data as { starting_balance: number } | null)?.starting_balance ??
      0;
    const currentRound =
      (gameStateRes.data as { current_round: number } | null)?.current_round ?? 0;

    const [holdingsRes, roundRes] = await Promise.all([
      supabase
        .from("holdings")
        .select("stock_id, quantity, avg_buy_price")
        .eq("portfolio_id", portfolio.id),
      currentRound > 0
        ? supabase
            .from("rounds")
            .select("id")
            .eq("event_id", eventId)
            .eq("round_number", currentRound)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const holdingsRows = (holdingsRes.data as HoldingRow[] | null) ?? [];
    const roundId = (roundRes.data as RoundRow | null)?.id;

    const priceMap = new Map<string, number>();
    if (roundId && stocks.length > 0) {
      const stockIds = stocks.map((s) => s.id);
      const pricesRes = await supabase
        .from("stock_prices")
        .select("stock_id, price")
        .eq("round_id", roundId)
        .in("stock_id", stockIds);

      for (const price of (pricesRes.data as StockPriceRow[] | null) ?? []) {
        priceMap.set(price.stock_id, price.price);
      }
    }

    const stockMap = new Map<string, StockRow>();
    for (const stock of stocks) {
      stockMap.set(stock.id, stock);
    }

    const holdings: HoldingWithStock[] = holdingsRows
      .map((holding) => {
        const stock = stockMap.get(holding.stock_id);
        if (!stock) return null;
        const currentPrice = priceMap.get(holding.stock_id) ?? holding.avg_buy_price;
        return {
          id: stock.id,
          symbol: stock.symbol,
          name: stock.name,
          sector: stock.sector,
          currentPrice,
          quantity: holding.quantity,
          avgBuyPrice: holding.avg_buy_price,
          unrealizedPnL: (currentPrice - holding.avg_buy_price) * holding.quantity,
        } satisfies HoldingWithStock;
      })
      .filter((holding): holding is HoldingWithStock => holding !== null);

    const stocksWithPrices: StockWithPrice[] = stocks.map((stock) => ({
      id: stock.id,
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      currentPrice: priceMap.get(stock.id) ?? 0,
    }));

    return NextResponse.json(
      {
        portfolio: {
          balance: portfolio.balance,
          holdings,
        },
        stocks: stocksWithPrices,
        startingBalance,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=1, stale-while-revalidate=4",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

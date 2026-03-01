import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/services/auth.service";
import {
  transitionState,
  startRound,
  endRound,
  pauseGame,
  resumeGame,
  resetGame,
} from "@/lib/services/game.service";
import { initRoundTimer } from "@/lib/services/timer.service";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

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

// Notify socket server to broadcast an event to all game participants
async function socketBroadcast(event: string, data: unknown): Promise<void> {
  const socketUrl = process.env.SOCKET_SERVER_URL ?? "http://localhost:4000";
  try {
    await fetch(`${socketUrl}/internal/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data }),
    });
  } catch (err) {
    console.warn("[admin/game] socket broadcast failed:", err);
    // Non-fatal — game state is saved, broadcast is best-effort
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as {
      action: string;
      eventId: string;
      roundNumber?: number;
      totalRounds?: number;
    };

    const { action, eventId, roundNumber, totalRounds } = body;

    if (!eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }

    const supabase = (await createServiceClient()) as unknown as SupabaseClient;

    switch (action) {
      case "START_GAME": {
        // Initialize portfolios for all participants who don't have one yet
        const { data: event } = await supabase
          .from("events")
          .select("starting_balance")
          .eq("id", eventId)
          .single();

        const { data: users } = await supabase
          .from("users")
          .select("id")
          .eq("role", "participant")
          .eq("is_active", true);

        if (event && users) {
          for (const u of users as { id: string }[]) {
            await supabase
              .from("portfolios")
              .upsert(
                {
                  user_id: u.id,
                  event_id: eventId,
                  balance: (event as { starting_balance: number })
                    .starting_balance,
                },
                { onConflict: "user_id,event_id" },
              );
          }
        }

        const result = await transitionState(eventId, "RUNNING");
        if (!result.success)
          return NextResponse.json({ error: result.error }, { status: 400 });
        await socketBroadcast("GAME_START", {
          eventId,
          startTime: new Date().toISOString(),
        });
        return NextResponse.json(result);
      }

      case "START_ROUND": {
        if (roundNumber === undefined) {
          return NextResponse.json(
            { error: "roundNumber required" },
            { status: 400 },
          );
        }
        // Init timer FIRST so timer_remaining is set before status becomes ROUND_ACTIVE
        // This prevents the timerLoop from seeing 0 and auto-ending the round
        const timerResult = await initRoundTimer(eventId, roundNumber);
        if (!timerResult.success)
          return NextResponse.json(
            { error: timerResult.error },
            { status: 400 },
          );

        const roundResult = await startRound(eventId, roundNumber);
        if (!roundResult.success)
          return NextResponse.json(
            { error: roundResult.error },
            { status: 400 },
          );

        // Fetch stock prices for this round to broadcast
        const { data: roundData } = await supabase
          .from("rounds")
          .select("id")
          .eq("event_id", eventId)
          .eq("round_number", roundNumber)
          .single();

        const prices: Record<string, number> = {};
        if (roundData) {
          const roundId = (roundData as { id: string }).id;
          const { data: stockPrices } = await supabase
            .from("stock_prices")
            .select("price, stock_id")
            .eq("round_id", roundId);

          if (stockPrices) {
            const stockIds = (
              stockPrices as { price: number; stock_id: string }[]
            ).map((sp) => sp.stock_id);
            const { data: stockSymbols } = await supabase
              .from("stocks")
              .select("id, symbol")
              .in("id", stockIds);

            if (stockSymbols) {
              const symbolMap = new Map(
                (stockSymbols as { id: string; symbol: string }[]).map((s) => [
                  s.id,
                  s.symbol,
                ]),
              );
              for (const sp of stockPrices as {
                price: number;
                stock_id: string;
              }[]) {
                const symbol = symbolMap.get(sp.stock_id);
                if (symbol) prices[symbol] = sp.price;
              }
            }
          }
        }

        // Auto-broadcast ROUND_START to all participants
        await socketBroadcast("ROUND_START", {
          roundNumber,
          durationSeconds: timerResult.durationSeconds ?? 300,
          prices,
          caseStudy: null,
        });

        return NextResponse.json({
          success: true,
          durationSeconds: timerResult.durationSeconds,
        });
      }

      case "END_ROUND": {
        if (roundNumber === undefined || totalRounds === undefined) {
          return NextResponse.json(
            { error: "roundNumber and totalRounds required" },
            { status: 400 },
          );
        }
        const result = await endRound(eventId, roundNumber, totalRounds);
        if (!result.success)
          return NextResponse.json({ error: result.error }, { status: 400 });
        await socketBroadcast("ROUND_END", { roundNumber });
        return NextResponse.json(result);
      }

      case "PAUSE": {
        const result = await pauseGame(eventId);
        if (!result.success)
          return NextResponse.json({ error: result.error }, { status: 400 });
        await socketBroadcast("GAME_PAUSE", { eventId });
        return NextResponse.json(result);
      }

      case "RESUME": {
        const result = await resumeGame(eventId);
        if (!result.success)
          return NextResponse.json({ error: result.error }, { status: 400 });
        await socketBroadcast("GAME_RESUME", { eventId });
        return NextResponse.json(result);
      }

      case "RESET": {
        const result = await resetGame(eventId);
        if (!result.success)
          return NextResponse.json({ error: result.error }, { status: 400 });
        await socketBroadcast("GAME_RESET", { eventId });
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

interface EventRow {
  id: string;
  name: string;
  status: string;
  starting_balance: number;
  current_round: number;
  total_rounds: number;
}

// ─── GET /api/admin/events ────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const supabase = (await createServiceClient()) as unknown as SupabaseClient;
    const { data, error } = await supabase
      .from("events")
      .select("id, name, status, starting_balance, current_round, total_rounds")
      .order("created_at", { ascending: false });

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json((data as unknown as EventRow[]) ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

// ─── POST /api/admin/events ───────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = (await request.json()) as {
      name?: string;
      starting_balance?: number;
      total_rounds?: number;
      round_duration_seconds?: number;
    };

    const {
      name,
      starting_balance,
      total_rounds,
      round_duration_seconds = 300,
    } = body;

    if (!name || starting_balance === undefined || total_rounds === undefined) {
      return NextResponse.json(
        { error: "name, starting_balance, and total_rounds are required" },
        { status: 400 },
      );
    }

    const supabase = (await createServiceClient()) as unknown as SupabaseClient;

    // Create event
    const { data, error } = await supabase
      .from("events")
      .insert({
        name,
        starting_balance,
        total_rounds,
        status: "READY",
        current_round: 0,
        created_by: auth.user?.id,
      })
      .select("id, name, status, starting_balance, current_round, total_rounds")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to create event" },
        { status: 500 },
      );
    }

    const newEvent = data as unknown as EventRow;

    // Insert game_state row
    const { error: gsError } = await supabase.from("game_state").insert({
      event_id: newEvent.id,
      status: "READY",
      current_round: 0,
      timer_remaining: 0,
      paused_at: null,
      last_updated: new Date().toISOString(),
    });

    if (gsError) {
      console.error("[events] game_state insert failed:", gsError.message);
      // Rollback event
      await supabase.from("events").delete().eq("id", newEvent.id);
      return NextResponse.json(
        { error: "Failed to init game state: " + gsError.message },
        { status: 500 },
      );
    }

    // Create rounds
    const rounds = Array.from({ length: total_rounds }, (_, i) => ({
      event_id: newEvent.id,
      round_number: i + 1,
      duration_seconds: round_duration_seconds,
      status: "pending",
    }));

    const { error: roundsError } = await supabase.from("rounds").insert(rounds);
    if (roundsError) {
      console.error("[events] rounds insert failed:", roundsError.message);
    }

    return NextResponse.json({ ...newEvent, status: "READY" }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/admin/events ─────────────────────────────────────────────────

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request);
  if (auth.error)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = (await request.json()) as { eventId?: string };
    if (!body.eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }

    const { eventId } = body;
    const supabase = (await createServiceClient()) as unknown as SupabaseClient;

    // Delete in correct FK dependency order
    await supabase.from("admin_actions").delete().eq("event_id", eventId);
    await supabase.from("trades").delete().eq("event_id", eventId);

    const { data: portfolios } = await supabase
      .from("portfolios")
      .select("id")
      .eq("event_id", eventId);
    const portfolioIds = (portfolios ?? []).map((p: { id: string }) => p.id);

    if (portfolioIds.length > 0) {
      await supabase.from("holdings").delete().in("portfolio_id", portfolioIds);
      await supabase.from("portfolios").delete().in("id", portfolioIds);
    }

    const { data: stocks } = await supabase
      .from("stocks")
      .select("id")
      .eq("event_id", eventId);
    const stockIds = (stocks ?? []).map((s: { id: string }) => s.id);

    if (stockIds.length > 0) {
      await supabase.from("stock_prices").delete().in("stock_id", stockIds);
      await supabase.from("stocks").delete().in("id", stockIds);
    }

    await supabase.from("rounds").delete().eq("event_id", eventId);
    await supabase.from("game_state").delete().eq("event_id", eventId);
    await supabase.from("events").delete().eq("id", eventId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

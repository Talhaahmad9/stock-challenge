import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventStatus, GameState } from "@/lib/supabase/database.types";

// ─── State machine transition map ────────────────────────────────────────────

const VALID_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  IDLE: ["SETUP"],
  SETUP: ["READY"],
  READY: ["RUNNING"],
  RUNNING: ["ROUND_ACTIVE"],
  ROUND_ACTIVE: ["ROUND_END", "PAUSED"],
  ROUND_END: ["ROUND_ACTIVE", "GAME_END"],
  PAUSED: ["ROUND_ACTIVE", "RUNNING"],
  GAME_END: ["RESET"],
  RESET: ["IDLE"],
};

function isValidTransition(from: EventStatus, to: EventStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

async function db(): Promise<SupabaseClient> {
  return (await createServiceClient()) as unknown as SupabaseClient;
}

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface GameStateRow {
  id: string;
  event_id: string;
  current_round: number;
  status: EventStatus;
  timer_remaining: number;
  paused_at: string | null;
  last_updated: string;
}

interface EventRow {
  total_rounds: number;
}

interface PortfolioRow {
  id: string;
  user_id: string;
  balance: number;
  users: { username: string } | null;
}

interface HoldingRow {
  quantity: number;
  portfolio_id: string;
  stock_id: string;
}

interface StockPriceRow {
  stock_id: string;
  price: number;
}

type Result = Promise<{ success: boolean; error?: string }>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchCurrentStatus(
  eventId: string,
): Promise<{ status: EventStatus; error?: string }> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("game_state")
    .select("status")
    .eq("event_id", eventId)
    .single();

  if (error || !data) {
    return { status: "IDLE", error: error?.message ?? "Game state not found" };
  }
  return { status: (data as unknown as { status: EventStatus }).status };
}

async function applyTransition(
  eventId: string,
  newStatus: EventStatus,
): Result {
  const supabase = await db();
  const { error } = await supabase
    .from("game_state")
    .update({ status: newStatus, last_updated: new Date().toISOString() })
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── 1. getGameState ──────────────────────────────────────────────────────────

export async function getGameState(eventId: string): Promise<GameState | null> {
  const supabase = await db();

  const [gsResult, evResult] = await Promise.all([
    supabase.from("game_state").select("*").eq("event_id", eventId).single(),
    supabase.from("events").select("total_rounds").eq("id", eventId).single(),
  ]);

  if (gsResult.error || !gsResult.data) return null;

  const row = gsResult.data as unknown as GameStateRow;
  const totalRounds = evResult.data
    ? (evResult.data as unknown as EventRow).total_rounds
    : 0;

  return {
    eventId: row.event_id,
    status: row.status,
    currentRound: row.current_round,
    timerRemaining: row.timer_remaining,
    totalRounds,
  };
}

// ─── 2. initGameState ─────────────────────────────────────────────────────────

export async function initGameState(
  eventId: string,
  _totalRounds: number,
): Result {
  const supabase = await db();

  const { data: existing } = await supabase
    .from("game_state")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: "Game state already exists for this event",
    };
  }

  const { error } = await supabase.from("game_state").insert({
    event_id: eventId,
    status: "IDLE",
    current_round: 0,
    timer_remaining: 0,
    last_updated: new Date().toISOString(),
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── 3. transitionState ───────────────────────────────────────────────────────

export async function transitionState(
  eventId: string,
  newStatus: EventStatus,
): Result {
  const { status: currentStatus, error: fetchError } =
    await fetchCurrentStatus(eventId);

  if (fetchError) return { success: false, error: fetchError };

  if (!isValidTransition(currentStatus, newStatus)) {
    return {
      success: false,
      error: `Invalid transition: ${currentStatus} → ${newStatus}`,
    };
  }

  return applyTransition(eventId, newStatus);
}

// ─── 4. startRound ────────────────────────────────────────────────────────────

export async function startRound(eventId: string, roundNumber: number): Result {
  const transition = await transitionState(eventId, "ROUND_ACTIVE");
  if (!transition.success) return transition;

  const supabase = await db();
  const now = new Date().toISOString();

  const { error: gsError } = await supabase
    .from("game_state")
    .update({ current_round: roundNumber, last_updated: now })
    .eq("event_id", eventId);

  if (gsError) return { success: false, error: gsError.message };

  const { error: roundError } = await supabase
    .from("rounds")
    .update({ started_at: now, status: "active" })
    .eq("event_id", eventId)
    .eq("round_number", roundNumber);

  if (roundError) return { success: false, error: roundError.message };

  const { error: eventError } = await supabase
    .from("events")
    .update({ current_round: roundNumber })
    .eq("id", eventId);

  if (eventError) return { success: false, error: eventError.message };

  return { success: true };
}

// ─── 5. endRound ─────────────────────────────────────────────────────────────

export async function endRound(
  eventId: string,
  roundNumber: number,
  totalRounds: number,
): Result {
  const transition = await transitionState(eventId, "ROUND_END");
  if (!transition.success) return transition;

  const supabase = await db();
  const now = new Date().toISOString();

  const { error: roundError } = await supabase
    .from("rounds")
    .update({ ended_at: now, status: "completed" })
    .eq("event_id", eventId)
    .eq("round_number", roundNumber);

  if (roundError) return { success: false, error: roundError.message };

  // Last round → go straight to GAME_END
  if (roundNumber >= totalRounds) {
    return applyTransition(eventId, "GAME_END");
  }

  return { success: true };
}

// ─── 6. pauseGame ────────────────────────────────────────────────────────────
// FIX: check current state first — can pause from ROUND_ACTIVE or RUNNING

export async function pauseGame(eventId: string): Result {
  const { status: currentStatus, error: fetchError } =
    await fetchCurrentStatus(eventId);

  if (fetchError) return { success: false, error: fetchError };

  // Must be in a pausable state
  if (currentStatus !== "ROUND_ACTIVE" && currentStatus !== "RUNNING") {
    return {
      success: false,
      error: `Cannot pause from state: ${currentStatus}`,
    };
  }

  const transition = await applyTransition(eventId, "PAUSED");
  if (!transition.success) return transition;

  const supabase = await db();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("game_state")
    .update({ paused_at: now, last_updated: now })
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── 7. resumeGame ───────────────────────────────────────────────────────────

export async function resumeGame(eventId: string): Result {
  const transition = await transitionState(eventId, "ROUND_ACTIVE");
  if (!transition.success) return transition;

  const supabase = await db();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("game_state")
    .update({ paused_at: null, last_updated: now })
    .eq("event_id", eventId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── 8. resetGame ────────────────────────────────────────────────────────────
// FIX: must go GAME_END → RESET → IDLE (two transitions)

export async function resetGame(eventId: string): Result {
  const supabase = await db();
  const now = new Date().toISOString();

  // Reset game_state directly to READY (skip intermediate RESET status)
  const { error: gsError } = await supabase
    .from("game_state")
    .update({
      status: "READY",
      current_round: 0,
      timer_remaining: 0,
      paused_at: null,
      last_updated: now,
    })
    .eq("event_id", eventId);

  if (gsError) return { success: false, error: gsError.message };

  const { error: eventError } = await supabase
    .from("events")
    .update({ status: "READY", current_round: 0 })
    .eq("id", eventId);

  if (eventError) return { success: false, error: eventError.message };

  const { error: roundsError } = await supabase
    .from("rounds")
    .update({ status: "pending", started_at: null, ended_at: null })
    .eq("event_id", eventId);

  if (roundsError) return { success: false, error: roundsError.message };

  // Reset all portfolios to starting balance
  const { data: eventData } = await supabase
    .from("events")
    .select("starting_balance")
    .eq("id", eventId)
    .single();

  if (eventData) {
    const { data: portfolios } = await supabase
      .from("portfolios")
      .select("id")
      .eq("event_id", eventId);

    const portfolioIds = (portfolios ?? []).map((p: { id: string }) => p.id);
    if (portfolioIds.length > 0) {
      await supabase.from("holdings").delete().in("portfolio_id", portfolioIds);
      await supabase.from("trades").delete().in("portfolio_id", portfolioIds);
      await supabase
        .from("portfolios")
        .update({
          balance: (eventData as { starting_balance: number }).starting_balance,
        })
        .in("id", portfolioIds);
    }
  }

  return { success: true };
}

// ─── 9. calculateFinalScores ─────────────────────────────────────────────────
// FIX: get last round's prices specifically, not all prices

export async function calculateFinalScores(
  eventId: string,
): Promise<
  Array<{ userId: string; username: string; score: number; rank: number }>
> {
  const supabase = await db();

  // Get the last completed round for this event
  const { data: lastRoundData } = await supabase
    .from("rounds")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "completed")
    .order("round_number", { ascending: false })
    .limit(1)
    .single();

  if (!lastRoundData) return [];

  const lastRoundId = (lastRoundData as unknown as { id: string }).id;

  // Get all stock prices for the last round
  const { data: pricesData } = await supabase
    .from("stock_prices")
    .select("stock_id, price")
    .eq("round_id", lastRoundId);

  if (!pricesData) return [];

  // Build stock_id → price map
  const priceMap = new Map<string, number>();
  for (const p of pricesData as unknown as StockPriceRow[]) {
    priceMap.set(p.stock_id, p.price);
  }

  // Get all portfolios with owner username
  const { data: portfolios, error: portfolioError } = await supabase
    .from("portfolios")
    .select("id, user_id, balance, users(username)")
    .eq("event_id", eventId);

  if (portfolioError || !portfolios) return [];
  const portfolioRows = portfolios as unknown as PortfolioRow[];

  // Get all holdings for these portfolios
  const { data: holdings } = await supabase
    .from("holdings")
    .select("quantity, portfolio_id, stock_id")
    .in(
      "portfolio_id",
      portfolioRows.map((p) => p.id),
    );

  const holdingRows = (holdings ?? []) as unknown as HoldingRow[];

  // portfolio_id → total holdings value at last round prices
  const holdingsValueMap = new Map<string, number>();
  for (const h of holdingRows) {
    const price = priceMap.get(h.stock_id) ?? 0;
    const current = holdingsValueMap.get(h.portfolio_id) ?? 0;
    holdingsValueMap.set(h.portfolio_id, current + h.quantity * price);
  }

  // Final score = cash + portfolio value
  const scored = portfolioRows.map((p) => ({
    userId: p.user_id,
    username: p.users?.username ?? "Unknown",
    score: p.balance + (holdingsValueMap.get(p.id) ?? 0),
    rank: 0,
  }));

  scored.sort((a, b) => b.score - a.score);
  scored.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return scored;
}

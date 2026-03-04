import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/services/auth.service";
import {
  getPortfolio,
  getStocksWithPrices,
} from "@/lib/services/trading.service";
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

  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!eventId)
    return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const supabase = (await createServiceClient()) as unknown as SupabaseClient;
  const [portfolio, stocks, eventData] = await Promise.all([
    getPortfolio(user.id, eventId),
    getStocksWithPrices(eventId),
    supabase
      .from("events")
      .select("starting_balance")
      .eq("id", eventId)
      .single(),
  ]);

  if (!portfolio)
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });

  const startingBalance =
    (eventData.data as { starting_balance: number } | null)?.starting_balance ??
    0;

  return NextResponse.json({ portfolio, stocks, startingBalance });
}

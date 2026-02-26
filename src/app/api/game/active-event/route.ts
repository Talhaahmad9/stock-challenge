import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/services/auth.service";
import { createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest): Promise<NextResponse> {
  void request;
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await verifySession(token);
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const supabase = (await createServiceClient()) as unknown as SupabaseClient;
    const { data, error } = await supabase
      .from("events")
      .select("id, name, status, starting_balance, total_rounds, current_round")
      .not("status", "eq", "IDLE")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data)
      return NextResponse.json({ error: "No active event" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

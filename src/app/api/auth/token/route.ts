import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/services/auth.service";

// Returns the raw token so the socket client can use it for auth.
// The token itself is already validated — we're just exposing it
// for the WebSocket handshake which can't read httpOnly cookies.
export async function GET(request: NextRequest): Promise<NextResponse> {
  void request;
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await verifySession(token);
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ token });
}

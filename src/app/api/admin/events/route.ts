import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/services/auth.service'
import { createServiceClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthUser } from '@/lib/supabase/database.types'

type AdminCheck =
  | { user: AuthUser; error?: never; status?: never }
  | { user?: never; error: string; status: number }

async function requireAdmin(request: NextRequest): Promise<AdminCheck> {
  void request
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) return { error: 'Not authenticated', status: 401 }
  const user = await verifySession(token)
  if (!user) return { error: 'Not authenticated', status: 401 }
  if (user.role !== 'admin') return { error: 'Forbidden', status: 403 }
  return { user }
}

interface EventRow {
  id: string
  name: string
  status: string
  starting_balance: number
  current_round: number
  total_rounds: number
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const supabase = (await createServiceClient()) as unknown as SupabaseClient

    const { data, error } = await supabase
      .from('events')
      .select('id, name, status, starting_balance, current_round, total_rounds')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message as string }, { status: 500 })
    }

    return NextResponse.json((data as unknown as EventRow[]) ?? [])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

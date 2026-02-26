import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  verifySession,
  createParticipantUsers,
  resetUserPassword,
  setUserActive,
} from '@/lib/services/auth.service'
import { createServiceClient } from '@/lib/supabase/server'
import type { AuthUser } from '@/lib/supabase/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Auth helper ─────────────────────────────────────────────────────────────

type AdminCheck =
  | { user: AuthUser; error?: never; status?: never }
  | { user?: never; error: string; status: number }

async function requireAdmin(request: NextRequest): Promise<AdminCheck> {
  void request
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) {
    return { error: 'Not authenticated', status: 401 }
  }

  const user = await verifySession(token)
  if (!user) {
    return { error: 'Not authenticated', status: 401 }
  }

  if (user.role !== 'admin') {
    return { error: 'Forbidden', status: 403 }
  }

  return { user }
}

// ─── Row shape ───────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  username: string
  is_active: boolean
  created_at: string
}

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const supabase = (await createServiceClient()) as unknown as SupabaseClient

    const { data, error } = await supabase
      .from('users')
      .select('id, username, is_active, created_at')
      .eq('role', 'participant')
      .order('username', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message as string }, { status: 500 })
    }

    const users = (data as unknown as UserRow[]) ?? []
    return NextResponse.json(users)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── POST /api/admin/users ────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = (await request.json()) as {
      action: string
      count?: number
      prefix?: string
      userId?: string
      isActive?: boolean
    }

    const { action, count, prefix, userId, isActive } = body

    switch (action) {
      case 'GENERATE': {
        if (!count || count <= 0) {
          return NextResponse.json({ error: 'count must be a positive number' }, { status: 400 })
        }
        const result = await createParticipantUsers(count, prefix)
        return NextResponse.json(result)
      }

      case 'RESET_PASSWORD': {
        if (!userId) {
          return NextResponse.json({ error: 'userId required' }, { status: 400 })
        }
        const result = await resetUserPassword(userId)
        if (!result) {
          return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
        }
        return NextResponse.json(result)
      }

      case 'TOGGLE_ACTIVE': {
        if (!userId || isActive === undefined) {
          return NextResponse.json({ error: 'userId and isActive required' }, { status: 400 })
        }
        const success = await setUserActive(userId, isActive)
        return NextResponse.json({ success })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

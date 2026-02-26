import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/services/auth.service'
import {
  transitionState,
  startRound,
  endRound,
  pauseGame,
  resumeGame,
  resetGame,
} from '@/lib/services/game.service'
import { initRoundTimer } from '@/lib/services/timer.service'
import type { AuthUser } from '@/lib/supabase/database.types'

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

// ─── POST /api/admin/game ─────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = (await request.json()) as {
      action: string
      eventId: string
      roundNumber?: number
      totalRounds?: number
    }

    const { action, eventId, roundNumber, totalRounds } = body

    if (!eventId) {
      return NextResponse.json({ error: 'eventId required' }, { status: 400 })
    }

    switch (action) {
      case 'START_GAME': {
        const result = await transitionState(eventId, 'RUNNING')
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json(result)
      }

      case 'START_ROUND': {
        if (roundNumber === undefined) {
          return NextResponse.json({ error: 'roundNumber required' }, { status: 400 })
        }

        const roundResult = await startRound(eventId, roundNumber)
        if (!roundResult.success) {
          return NextResponse.json({ error: roundResult.error }, { status: 400 })
        }

        const timerResult = await initRoundTimer(eventId, roundNumber)
        if (!timerResult.success) {
          return NextResponse.json({ error: timerResult.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          durationSeconds: timerResult.durationSeconds,
        })
      }

      case 'END_ROUND': {
        if (roundNumber === undefined || totalRounds === undefined) {
          return NextResponse.json(
            { error: 'roundNumber and totalRounds required' },
            { status: 400 }
          )
        }

        const result = await endRound(eventId, roundNumber, totalRounds)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json(result)
      }

      case 'PAUSE': {
        const result = await pauseGame(eventId)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json(result)
      }

      case 'RESUME': {
        const result = await resumeGame(eventId)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json(result)
      }

      case 'RESET': {
        const result = await resetGame(eventId)
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

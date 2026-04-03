import { createServiceClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Local row interfaces ─────────────────────────────────────────────────────

interface GameStateRow {
  id: string
  event_id: string
  status: string
  current_round: number
  timer_remaining: number
  round_started_at: string | null
  round_expires_at: string | null
  paused_at: string | null
}

interface RoundRow {
  id: string
  duration_seconds: number
}

function isMissingColumnError(message: string | undefined): boolean {
  return Boolean(message && message.toLowerCase().includes('column'))
}

// ─── Supabase client helper ───────────────────────────────────────────────────

async function db(): Promise<SupabaseClient> {
  return (await createServiceClient()) as unknown as SupabaseClient
}

// ─── 1. initRoundTimer ───────────────────────────────────────────────────────

export async function initRoundTimer(
  eventId: string,
  roundNumber: number
): Promise<{ success: boolean; durationSeconds: number; expiresAt: string; error?: string }> {
  try {
    const supabase = await db()

    const { data: roundData, error: roundError } = await supabase
      .from('rounds')
      .select('id, duration_seconds')
      .eq('event_id', eventId)
      .eq('round_number', roundNumber)
      .single()

    if (roundError || !roundData) {
      return { success: false, durationSeconds: 0, expiresAt: '', error: roundError?.message ?? 'Round not found' }
    }

    const round = roundData as unknown as RoundRow
    const nowMs = Date.now()
    const expiresAt = new Date(nowMs + round.duration_seconds * 1000).toISOString()
    const startedAt = new Date(nowMs).toISOString()

    const { error: updateError } = await supabase
      .from('game_state')
      .update({
        timer_remaining: round.duration_seconds,
        round_started_at: startedAt,
        round_expires_at: expiresAt,
        last_updated: new Date().toISOString(),
      })
      .eq('event_id', eventId)

    if (updateError) {
      if (isMissingColumnError(updateError.message)) {
        const { error: legacyError } = await supabase
          .from('game_state')
          .update({
            timer_remaining: round.duration_seconds,
            last_updated: new Date().toISOString(),
          })
          .eq('event_id', eventId)

        if (legacyError) {
          return { success: false, durationSeconds: 0, expiresAt: '', error: legacyError.message as string }
        }

        return { success: true, durationSeconds: round.duration_seconds, expiresAt }
      }

      return { success: false, durationSeconds: 0, expiresAt: '', error: updateError.message as string }
    }

    return { success: true, durationSeconds: round.duration_seconds, expiresAt }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return { success: false, durationSeconds: 0, expiresAt: '', error: message }
  }
}

// ─── 2. getTimerState ────────────────────────────────────────────────────────

export async function getTimerState(
  eventId: string
): Promise<{ timerRemaining: number; status: string; roundExpiresAt: string | null } | null> {
  try {
    const supabase = await db()

    const { data, error } = await supabase
      .from('game_state')
      .select('timer_remaining, status, round_expires_at')
      .eq('event_id', eventId)
      .single()

    if (error && isMissingColumnError(error.message)) {
      const { data: legacyData, error: legacyError } = await supabase
        .from('game_state')
        .select('timer_remaining, status')
        .eq('event_id', eventId)
        .single()

      if (legacyError || !legacyData) return null

      const legacyRow = legacyData as unknown as Pick<GameStateRow, 'timer_remaining' | 'status'>
      return {
        timerRemaining: legacyRow.timer_remaining,
        status: legacyRow.status,
        roundExpiresAt: null,
      }
    }

    if (error || !data) return null

    const row = data as unknown as Pick<GameStateRow, 'timer_remaining' | 'status' | 'round_expires_at'>

    return {
      timerRemaining: row.timer_remaining,
      status: row.status,
      roundExpiresAt: row.round_expires_at,
    }
  } catch {
    return null
  }
}

// ─── 3. tickTimer ────────────────────────────────────────────────────────────

export async function tickTimer(
  eventId: string
): Promise<{ timerRemaining: number; expired: boolean }> {
  try {
    const supabase = await db()

    const { data, error } = await supabase
      .from('game_state')
      .select('timer_remaining')
      .eq('event_id', eventId)
      .single()

    if (error || !data) return { timerRemaining: 0, expired: true }

    const current = (data as unknown as Pick<GameStateRow, 'timer_remaining'>).timer_remaining

    if (current <= 0) return { timerRemaining: 0, expired: true }

    const newValue = current - 1

    await supabase
      .from('game_state')
      .update({
        timer_remaining: newValue,
        last_updated: new Date().toISOString(),
      })
      .eq('event_id', eventId)

    return { timerRemaining: newValue, expired: newValue <= 0 }
  } catch {
    return { timerRemaining: 0, expired: true }
  }
}

// ─── 4. pauseTimer ───────────────────────────────────────────────────────────

export async function pauseTimer(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await db()
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('game_state')
      .update({ paused_at: now, last_updated: now })
      .eq('event_id', eventId)

    if (error) return { success: false, error: error.message as string }
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return { success: false, error: message }
  }
}

// ─── 5. resumeTimer ──────────────────────────────────────────────────────────

export async function resumeTimer(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await db()

    const { error } = await supabase
      .from('game_state')
      .update({ paused_at: null, last_updated: new Date().toISOString() })
      .eq('event_id', eventId)

    if (error) return { success: false, error: error.message as string }
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return { success: false, error: message }
  }
}

// ─── 6. setTimerRemaining ─────────────────────────────────────────────────────

export async function setTimerRemaining(
  eventId: string,
  seconds: number
): Promise<{ success: boolean; error?: string }> {
  if (seconds < 0) {
    return { success: false, error: 'seconds must be >= 0' }
  }

  try {
    const supabase = await db()

    const { error } = await supabase
      .from('game_state')
      .update({
        timer_remaining: seconds,
        last_updated: new Date().toISOString(),
      })
      .eq('event_id', eventId)

    if (error) return { success: false, error: error.message as string }
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return { success: false, error: message }
  }
}

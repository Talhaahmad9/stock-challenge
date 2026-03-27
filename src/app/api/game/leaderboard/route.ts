import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/services/auth.service'
import { createServiceClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Row shapes ───────────────────────────────────────────────────────────────

interface EventRow {
  starting_balance: number
}

interface PortfolioWithUser {
  id: string
  user_id: string
  balance: number
  users: { username: string } | null
}

interface HoldingRow {
  portfolio_id: string
  stock_id: string
  quantity: number
  avg_buy_price: number
}

interface GameStateRow {
  current_round: number
}

interface RoundRow {
  id: string
}

interface StockPriceRow {
  stock_id: string
  price: number
}

interface RpcLeaderboardRow {
  rank: number
  username: string
  total_value: number
  balance: number
  portfolio_value: number
  pnl: number
  is_current_user: boolean
}

// ─── Response shape ───────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number
  username: string
  totalValue: number
  balance: number
  portfolioValue: number
  pnl: number
  isCurrentUser: boolean
}

function normalizeRpcRows(rows: RpcLeaderboardRow[]): LeaderboardEntry[] {
  return rows.map((row) => ({
    rank: Number(row.rank),
    username: row.username,
    totalValue: Number(row.total_value),
    balance: Number(row.balance),
    portfolioValue: Number(row.portfolio_value),
    pnl: Number(row.pnl),
    isCurrentUser: row.is_current_user,
  }))
}

// ─── GET /api/game/leaderboard?eventId=xxx ────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Auth — any authenticated user may view the leaderboard
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const user = await verifySession(token)
  if (!user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const eventId = request.nextUrl.searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 })
  }

  try {
    const supabase = (await createServiceClient()) as unknown as SupabaseClient

    // Fast path: use DB-side aggregation if the RPC is available.
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_event_leaderboard',
      {
        p_event_id: eventId,
        p_user_id: user.id,
      },
    )

    if (!rpcError && Array.isArray(rpcData)) {
      return NextResponse.json(
        normalizeRpcRows(rpcData as RpcLeaderboardRow[]),
        {
          headers: {
            'Cache-Control': 'private, max-age=2, stale-while-revalidate=8',
          },
        },
      )
    }

    const [eventRes, portfoliosRes, gameStateRes] = await Promise.all([
      supabase
        .from('events')
        .select('starting_balance')
        .eq('id', eventId)
        .single(),
      supabase
        .from('portfolios')
        .select('id, user_id, balance, users(username)')
        .eq('event_id', eventId),
      supabase
        .from('game_state')
        .select('current_round')
        .eq('event_id', eventId)
        .single(),
    ])

    if (eventRes.error || !eventRes.data) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const { starting_balance: startingBalance } =
      eventRes.data as unknown as EventRow

    const portfoliosError = portfoliosRes.error

    if (portfoliosError) {
      return NextResponse.json(
        { error: portfoliosError.message },
        { status: 500 },
      )
    }

    const portfolios = (portfoliosRes.data as unknown as PortfolioWithUser[]) ?? []

    if (portfolios.length === 0) {
      return NextResponse.json([] as LeaderboardEntry[], {
        headers: {
          'Cache-Control': 'private, max-age=2, stale-while-revalidate=8',
        },
      })
    }

    const portfolioIds = portfolios.map((p) => p.id)

    // 3. All holdings for these portfolios
    const { data: holdingsData, error: holdingsError } = await supabase
      .from('holdings')
      .select('portfolio_id, stock_id, quantity, avg_buy_price')
      .in('portfolio_id', portfolioIds)

    if (holdingsError) {
      return NextResponse.json(
        { error: holdingsError.message },
        { status: 500 },
      )
    }

    const holdings = (holdingsData as unknown as HoldingRow[]) ?? []

    // 4. Current round's stock prices (best-effort — fall back to avg_buy_price)
    let priceMap: Record<string, number> = {}

    const currentRound =
      gameStateRes.data !== null
        ? (gameStateRes.data as unknown as GameStateRow).current_round
        : 1

    // Use the highest round we can find prices for (covers ROUND_END state too)
    const { data: roundData } = await supabase
      .from('rounds')
      .select('id')
      .eq('event_id', eventId)
      .eq('round_number', currentRound)
      .single()

    if (roundData) {
      const { id: roundId } = roundData as unknown as RoundRow
      const { data: pricesData } = await supabase
        .from('stock_prices')
        .select('stock_id, price')
        .eq('round_id', roundId)

      const prices =
        (pricesData as unknown as StockPriceRow[]) ?? []
      priceMap = Object.fromEntries(prices.map((p) => [p.stock_id, p.price]))
    }

    // 5. Group holdings by portfolio
    const holdingsByPortfolio = holdings.reduce<Record<string, HoldingRow[]>>(
      (acc, h) => {
        if (!acc[h.portfolio_id]) acc[h.portfolio_id] = []
        acc[h.portfolio_id].push(h)
        return acc
      },
      {},
    )

    // 6. Build entries
    const entries: LeaderboardEntry[] = portfolios.map((portfolio) => {
      const ph = holdingsByPortfolio[portfolio.id] ?? []
      const portfolioValue = ph.reduce((sum, h) => {
        // Fall back to avg_buy_price if no current price available
        const price = priceMap[h.stock_id] ?? h.avg_buy_price
        return sum + h.quantity * price
      }, 0)
      const totalValue = portfolio.balance + portfolioValue
      const pnl = totalValue - startingBalance

      return {
        rank: 0, // assigned after sort
        username: portfolio.users?.username ?? '—',
        totalValue,
        balance: portfolio.balance,
        portfolioValue,
        pnl,
        isCurrentUser: portfolio.user_id === user.id,
      }
    })

    // 7. Sort descending, assign rank (ties share the same rank)
    entries.sort((a, b) => b.totalValue - a.totalValue)

    let rank = 1
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].totalValue < entries[i - 1].totalValue) {
        rank = i + 1
      }
      entries[i].rank = rank
    }

    return NextResponse.json(entries, {
      headers: {
        'Cache-Control': 'private, max-age=2, stale-while-revalidate=8',
      },
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

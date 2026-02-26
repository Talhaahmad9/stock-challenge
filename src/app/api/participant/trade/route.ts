import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/services/auth.service'
import { executeTrade } from '@/lib/services/trading.service'
import type { TradeType } from '@/lib/supabase/database.types'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session_token')?.value

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const user = await verifySession(token)
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = (await request.json()) as {
    stockId?: unknown
    type?: unknown
    quantity?: unknown
    eventId?: unknown
  }

  const { stockId, type, quantity, eventId } = body

  // Validate all fields present
  if (!stockId || !type || quantity === undefined || quantity === null || !eventId) {
    return NextResponse.json({ error: 'stockId, type, quantity and eventId are required' }, { status: 400 })
  }

  // Validate type
  if (type !== 'BUY' && type !== 'SELL') {
    return NextResponse.json({ error: 'type must be BUY or SELL' }, { status: 400 })
  }

  // Validate quantity
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: 'quantity must be a positive integer' }, { status: 400 })
  }

  const result = await executeTrade({
    userId: user.id,
    stockId: stockId as string,
    type: type as TradeType,
    quantity,
    eventId: eventId as string,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    newBalance: result.newBalance,
    newHoldings: result.newHoldings,
  })
}

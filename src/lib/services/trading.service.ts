import { createServiceClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  TradeType,
  TradeResult,
  HoldingWithStock,
  StockWithPrice,
} from '@/lib/supabase/database.types'

// ─── Local row interfaces ─────────────────────────────────────────────────────

interface PortfolioRow {
  id: string
  user_id: string
  event_id: string
  balance: number
}

interface HoldingRow {
  id: string
  portfolio_id: string
  stock_id: string
  quantity: number
  avg_buy_price: number
}

interface StockPriceRow {
  stock_id: string
  price: number
  round_id: string
}

interface GameStateRow {
  status: string
  current_round: number
}

interface RoundRow {
  id: string
  round_number: number
}

interface StockRow {
  id: string
  symbol: string
  name: string
  sector: string | null
}

// ─── Supabase client helper ───────────────────────────────────────────────────

async function db(): Promise<SupabaseClient> {
  return (await createServiceClient()) as unknown as SupabaseClient
}

// ─── Internal: fetch holdings with current prices ─────────────────────────────

async function fetchUpdatedHoldings(
  supabase: SupabaseClient,
  portfolioId: string,
  currentRoundId: string
): Promise<HoldingWithStock[]> {
  const { data: holdings } = await supabase
    .from('holdings')
    .select('id, stock_id, quantity, avg_buy_price')
    .eq('portfolio_id', portfolioId)

  if (!holdings || holdings.length === 0) return []

  const holdingRows = holdings as unknown as HoldingRow[]
  const stockIds = holdingRows.map((h) => h.stock_id)

  const [stocksRes, pricesRes] = await Promise.all([
    supabase.from('stocks').select('id, symbol, name, sector').in('id', stockIds),
    supabase
      .from('stock_prices')
      .select('stock_id, price, round_id')
      .eq('round_id', currentRoundId)
      .in('stock_id', stockIds),
  ])

  const stockMap = new Map<string, StockRow>()
  for (const s of (stocksRes.data ?? []) as unknown as StockRow[]) {
    stockMap.set(s.id, s)
  }

  const priceMap = new Map<string, number>()
  for (const p of (pricesRes.data ?? []) as unknown as StockPriceRow[]) {
    priceMap.set(p.stock_id, p.price)
  }

  return holdingRows
    .map((h) => {
      const stock = stockMap.get(h.stock_id)
      if (!stock) return null
      const currentPrice = priceMap.get(h.stock_id) ?? 0
      return {
        id: stock.id,
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        currentPrice,
        quantity: h.quantity,
        avgBuyPrice: h.avg_buy_price,
        unrealizedPnL: (currentPrice - h.avg_buy_price) * h.quantity,
      } satisfies HoldingWithStock
    })
    .filter((h): h is HoldingWithStock => h !== null)
}

// ─── Internal: get current round id ──────────────────────────────────────────

async function getCurrentRoundId(
  supabase: SupabaseClient,
  eventId: string,
  currentRound: number
): Promise<string | null> {
  const { data } = await supabase
    .from('rounds')
    .select('id')
    .eq('event_id', eventId)
    .eq('round_number', currentRound)
    .single()

  if (!data) return null
  return (data as unknown as RoundRow).id
}

// ─── 1. executeTrade ─────────────────────────────────────────────────────────

export async function executeTrade(params: {
  userId: string
  stockId: string
  type: TradeType
  quantity: number
  eventId: string
}): Promise<TradeResult> {
  const { userId, stockId, type, quantity, eventId } = params

  // a. Validate quantity
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { success: false, error: 'Quantity must be a positive integer' }
  }

  try {
    const supabase = await db()

    // b. Check game state — trading only allowed during ROUND_ACTIVE
    const { data: gsData, error: gsError } = await supabase
      .from('game_state')
      .select('status, current_round')
      .eq('event_id', eventId)
      .single()

    if (gsError || !gsData) {
      return { success: false, error: 'Could not retrieve game state' }
    }

    const gameState = gsData as unknown as GameStateRow

    if (gameState.status !== 'ROUND_ACTIVE') {
      return { success: false, error: 'Trading is not active' }
    }

    // c. Get current round id
    const roundId = await getCurrentRoundId(supabase, eventId, gameState.current_round)
    if (!roundId) {
      return { success: false, error: 'Current round not found' }
    }

    // d. Get stock price for this round
    const { data: priceData, error: priceError } = await supabase
      .from('stock_prices')
      .select('price')
      .eq('stock_id', stockId)
      .eq('round_id', roundId)
      .single()

    if (priceError || !priceData) {
      return { success: false, error: 'Stock price not available for this round' }
    }

    const stockPrice = (priceData as unknown as StockPriceRow).price

    // e. Get portfolio
    const { data: portfolioData, error: portfolioError } = await supabase
      .from('portfolios')
      .select('id, user_id, event_id, balance')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .single()

    if (portfolioError || !portfolioData) {
      return { success: false, error: 'Portfolio not found' }
    }

    const portfolio = portfolioData as unknown as PortfolioRow

    // f. BUY logic
    if (type === 'BUY') {
      const cost = stockPrice * quantity

      if (portfolio.balance < cost) {
        return {
          success: false,
          error: `Insufficient funds. Need ₨${cost.toLocaleString()}, have ₨${portfolio.balance.toLocaleString()}`,
        }
      }

      // Deduct balance
      const { error: balanceError } = await supabase
        .from('portfolios')
        .update({ balance: portfolio.balance - cost })
        .eq('id', portfolio.id)

      if (balanceError) return { success: false, error: balanceError.message }

      // Upsert holding — update avg price if already owned
      const { data: existingHolding } = await supabase
        .from('holdings')
        .select('id, quantity, avg_buy_price')
        .eq('portfolio_id', portfolio.id)
        .eq('stock_id', stockId)
        .maybeSingle()

      if (existingHolding) {
        const existing = existingHolding as unknown as HoldingRow
        const newQty = existing.quantity + quantity
        // Weighted average: ((old_qty * old_avg) + (new_qty * new_price)) / total_qty
        const newAvg =
          (existing.quantity * existing.avg_buy_price + quantity * stockPrice) / newQty

        const { error: holdingError } = await supabase
          .from('holdings')
          .update({ quantity: newQty, avg_buy_price: newAvg })
          .eq('id', existing.id)

        if (holdingError) return { success: false, error: holdingError.message }
      } else {
        const { error: insertError } = await supabase.from('holdings').insert({
          portfolio_id: portfolio.id,
          stock_id: stockId,
          quantity,
          avg_buy_price: stockPrice,
        })

        if (insertError) return { success: false, error: insertError.message }
      }
    }

    // g. SELL logic
    if (type === 'SELL') {
      const { data: holdingData } = await supabase
        .from('holdings')
        .select('id, quantity, avg_buy_price')
        .eq('portfolio_id', portfolio.id)
        .eq('stock_id', stockId)
        .maybeSingle()

      if (!holdingData) {
        return { success: false, error: 'You do not own this stock' }
      }

      const holding = holdingData as unknown as HoldingRow

      if (holding.quantity < quantity) {
        return {
          success: false,
          error: `Insufficient holdings. Have ${holding.quantity}, trying to sell ${quantity}`,
        }
      }

      const proceeds = stockPrice * quantity

      // Add proceeds to balance
      const { error: balanceError } = await supabase
        .from('portfolios')
        .update({ balance: portfolio.balance + proceeds })
        .eq('id', portfolio.id)

      if (balanceError) return { success: false, error: balanceError.message }

      const remainingQty = holding.quantity - quantity

      if (remainingQty === 0) {
        // Remove holding entirely — no point keeping a 0 quantity row
        const { error: deleteError } = await supabase
          .from('holdings')
          .delete()
          .eq('id', holding.id)

        if (deleteError) return { success: false, error: deleteError.message }
      } else {
        const { error: holdingError } = await supabase
          .from('holdings')
          .update({ quantity: remainingQty })
          .eq('id', holding.id)

        if (holdingError) return { success: false, error: holdingError.message }
      }
    }

    // h. Record trade
    const { error: tradeError } = await supabase.from('trades').insert({
      user_id: userId,
      stock_id: stockId,
      round_id: roundId,
      event_id: eventId,
      type,
      quantity,
      price: stockPrice,
      executed_at: new Date().toISOString(),
    })

    if (tradeError) return { success: false, error: tradeError.message }

    // i. Return updated state
    const { data: updatedPortfolio } = await supabase
      .from('portfolios')
      .select('balance')
      .eq('id', portfolio.id)
      .single()

    const newBalance = updatedPortfolio
      ? (updatedPortfolio as unknown as { balance: number }).balance
      : portfolio.balance

    const newHoldings = await fetchUpdatedHoldings(supabase, portfolio.id, roundId)

    return { success: true, newBalance, newHoldings }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return { success: false, error: message }
  }
}

// ─── 2. getPortfolio ─────────────────────────────────────────────────────────

export async function getPortfolio(
  userId: string,
  eventId: string
): Promise<{ balance: number; holdings: HoldingWithStock[] } | null> {
  try {
    const supabase = await db()

    const { data: portfolioData, error: portfolioError } = await supabase
      .from('portfolios')
      .select('id, balance')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .single()

    if (portfolioError || !portfolioData) return null

    const portfolio = portfolioData as unknown as PortfolioRow

    const { data: gsData } = await supabase
      .from('game_state')
      .select('current_round')
      .eq('event_id', eventId)
      .single()

    if (!gsData) return { balance: portfolio.balance, holdings: [] }

    const { current_round } = gsData as unknown as GameStateRow

    const roundId = await getCurrentRoundId(supabase, eventId, current_round)
    if (!roundId) return { balance: portfolio.balance, holdings: [] }

    const holdings = await fetchUpdatedHoldings(supabase, portfolio.id, roundId)

    return { balance: portfolio.balance, holdings }
  } catch {
    return null
  }
}

// ─── 3. getStocksWithPrices ───────────────────────────────────────────────────
// Returns all stocks for the event with their current round price
// Uses StockWithPrice (not HoldingWithStock) — stocks ≠ holdings

export async function getStocksWithPrices(
  eventId: string
): Promise<StockWithPrice[]> {
  try {
    const supabase = await db()

    const { data: gsData } = await supabase
      .from('game_state')
      .select('current_round')
      .eq('event_id', eventId)
      .single()

    if (!gsData) return []

    const { current_round } = gsData as unknown as GameStateRow
    const roundId = await getCurrentRoundId(supabase, eventId, current_round)
    if (!roundId) return []

    const { data: stocksData } = await supabase
      .from('stocks')
      .select('id, symbol, name, sector')
      .eq('event_id', eventId)

    if (!stocksData || stocksData.length === 0) return []

    const stocks = stocksData as unknown as StockRow[]
    const stockIds = stocks.map((s) => s.id)

    const { data: pricesData } = await supabase
      .from('stock_prices')
      .select('stock_id, price')
      .eq('round_id', roundId)
      .in('stock_id', stockIds)

    const priceMap = new Map<string, number>()
    for (const p of (pricesData ?? []) as unknown as StockPriceRow[]) {
      priceMap.set(p.stock_id, p.price)
    }

    return stocks.map((s) => ({
      id: s.id,
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      currentPrice: priceMap.get(s.id) ?? 0,
    }))
  } catch {
    return []
  }
}
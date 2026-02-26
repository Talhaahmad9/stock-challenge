// Simplified Database type — avoids Supabase client inference issues
// Each table has Row (what comes back) and Insert (what you send in)

export type UserRole = 'admin' | 'participant'
export type EventStatus =
  | 'IDLE' | 'SETUP' | 'READY' | 'RUNNING'
  | 'PAUSED' | 'ROUND_ACTIVE' | 'ROUND_END'
  | 'GAME_END' | 'RESET'
export type TradeType = 'BUY' | 'SELL'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string
          password_hash: string
          role: UserRole
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          username: string
          password_hash: string
          role?: UserRole
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          password_hash?: string
          role?: UserRole
          is_active?: boolean
        }
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          token: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          expires_at: string
          created_at?: string
        }
        Update: {
          expires_at?: string
        }
      }
      events: {
        Row: {
          id: string
          name: string
          status: EventStatus
          starting_balance: number
          current_round: number
          total_rounds: number
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          status?: EventStatus
          starting_balance: number
          current_round?: number
          total_rounds?: number
          created_by: string
          created_at?: string
        }
        Update: {
          name?: string
          status?: EventStatus
          starting_balance?: number
          current_round?: number
          total_rounds?: number
        }
      }
      rounds: {
        Row: {
          id: string
          event_id: string
          round_number: number
          duration_seconds: number
          case_study: string | null
          status: string
          started_at: string | null
          ended_at: string | null
        }
        Insert: {
          id?: string
          event_id: string
          round_number: number
          duration_seconds?: number
          case_study?: string | null
          status?: string
          started_at?: string | null
          ended_at?: string | null
        }
        Update: {
          duration_seconds?: number
          case_study?: string | null
          status?: string
          started_at?: string | null
          ended_at?: string | null
        }
      }
      stocks: {
        Row: {
          id: string
          event_id: string
          symbol: string
          name: string
          sector: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          symbol: string
          name: string
          sector?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          symbol?: string
          name?: string
          sector?: string | null
          description?: string | null
        }
      }
      stock_prices: {
        Row: {
          id: string
          stock_id: string
          round_id: string
          price: number
        }
        Insert: {
          id?: string
          stock_id: string
          round_id: string
          price: number
        }
        Update: {
          price?: number
        }
      }
      portfolios: {
        Row: {
          id: string
          user_id: string
          event_id: string
          balance: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_id: string
          balance: number
          created_at?: string
        }
        Update: {
          balance?: number
        }
      }
      holdings: {
        Row: {
          id: string
          portfolio_id: string
          stock_id: string
          quantity: number
          avg_buy_price: number
        }
        Insert: {
          id?: string
          portfolio_id: string
          stock_id: string
          quantity: number
          avg_buy_price: number
        }
        Update: {
          quantity?: number
          avg_buy_price?: number
        }
      }
      trades: {
        Row: {
          id: string
          user_id: string
          stock_id: string
          round_id: string
          event_id: string
          type: TradeType
          quantity: number
          price: number
          total_value: number
          executed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stock_id: string
          round_id: string
          event_id: string
          type: TradeType
          quantity: number
          price: number
          executed_at?: string
        }
        Update: never
      }
      game_state: {
        Row: {
          id: string
          event_id: string
          current_round: number
          status: EventStatus
          timer_remaining: number
          paused_at: string | null
          last_updated: string
        }
        Insert: {
          id?: string
          event_id: string
          current_round?: number
          status?: EventStatus
          timer_remaining?: number
          paused_at?: string | null
          last_updated?: string
        }
        Update: {
          current_round?: number
          status?: EventStatus
          timer_remaining?: number
          paused_at?: string | null
          last_updated?: string
        }
      }
      admin_actions: {
        Row: {
          id: string
          admin_id: string
          event_id: string | null
          action_type: string
          details: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_id: string
          event_id?: string | null
          action_type: string
          details?: Record<string, unknown> | null
          created_at?: string
        }
        Update: never
      }
    }
  }
}

// ============================================
// APP-LEVEL TYPES (used across components)
// ============================================

export interface AuthUser {
  id: string
  username: string
  role: UserRole
}

export interface GameState {
  eventId: string
  status: EventStatus
  currentRound: number
  timerRemaining: number
  totalRounds: number
}

export interface StockWithPrice {
  id: string
  symbol: string
  name: string
  sector: string | null
  currentPrice: number
}

export interface HoldingWithStock extends StockWithPrice {
  quantity: number
  avgBuyPrice: number
  unrealizedPnL: number
}

export interface Portfolio {
  balance: number
  holdings: HoldingWithStock[]
  totalValue: number
  totalPnL: number
}

export interface TradeRequest {
  stockId: string
  type: TradeType
  quantity: number
  eventId: string
  roundId: string
}

export interface TradeResult {
  success: boolean
  newBalance?: number
  newHoldings?: HoldingWithStock[]
  error?: string
}

// ============================================
// SOCKET EVENT PAYLOADS
// ============================================

export interface RoundStartPayload {
  roundNumber: number
  durationSeconds: number
  prices: Record<string, number>
  caseStudy: string | null
}

export interface FinalScore {
  userId: string
  username: string
  score: number
  rank: number
}
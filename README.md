```
███████╗████████╗ ██████╗  ██████╗██╗  ██╗
██╔════╝╚══██╔══╝██╔═══██╗██╔════╝██║ ██╔╝
███████╗   ██║   ██║   ██║██║     █████╔╝
╚════██║   ██║   ██║   ██║██║     ██╔═██╗
███████║   ██║   ╚██████╔╝╚██████╗██║  ██╗
╚══════╝   ╚═╝    ╚═════╝  ╚═════╝╚═╝  ╚═╝

 ██████╗██╗  ██╗ █████╗ ██╗     ██╗     ███████╗███╗   ██╗ ██████╗ ███████╗
██╔════╝██║  ██║██╔══██╗██║     ██║     ██╔════╝████╗  ██║██╔════╝ ██╔════╝
██║     ███████║███████║██║     ██║     █████╗  ██╔██╗ ██║██║  ███╗█████╗
██║     ██╔══██║██╔══██║██║     ██║     ██╔══╝  ██║╚██╗██║██║   ██║██╔══╝
╚██████╗██║  ██║██║  ██║███████╗███████╗███████╗██║ ╚████║╚██████╔╝███████╗
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝
```

<div align="center">

**`[ SYSTEM: ONLINE ]` &nbsp;·&nbsp; `[ PLAYERS: CONNECTED ]` &nbsp;·&nbsp; `[ MARKET: OPEN ]`**

[![Live](https://img.shields.io/badge/LIVE-stockchallenge.vercel.app-00ff41?style=for-the-badge&logo=vercel&logoColor=black)](https://stockchallenge.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?style=for-the-badge&logo=socket.io)](https://socket.io)
[![Railway](https://img.shields.io/badge/Railway-Socket_Server-7B2FBE?style=for-the-badge&logo=railway)](https://railway.app)

</div>

---

## `> INITIALIZING SYSTEM...`

**Stock Challenge** is a real-time multiplayer stock trading simulation built for university finance society competitions. An admin controls timed trading rounds, participants trade stocks with virtual money, and a live leaderboard ranks everyone by total portfolio value. Built for ~60–70 concurrent players in a single high-pressure session.

> No real money. Maximum adrenaline.

---

## `> TABLE OF CONTENTS`

```
[01] TECH STACK
[02] FOLDER STRUCTURE
[03] DATABASE SCHEMA
[04] GAME STATE MACHINE
[05] SOCKET EVENTS
[06] ADMIN PANEL
[07] PARTICIPANT PANEL
[08] ENVIRONMENT VARIABLES
[09] DEPLOYMENT
[10] LOCAL SETUP
[11] PRE-COMPETITION CHECKLIST
[12] CREDITS
```

---

## `[01] TECH STACK`

```
╔══════════════════╦══════════════════════════════════════════════════════════╗
║ LAYER            ║ TECHNOLOGY                                               ║
╠══════════════════╬══════════════════════════════════════════════════════════╣
║ Frontend         ║ Next.js 15 (App Router), React, Tailwind CSS             ║
║ Backend          ║ Next.js API Routes (serverless, Vercel Edge)             ║
║ Database         ║ Supabase (PostgreSQL, service role — RLS disabled)       ║
║ Realtime         ║ Socket.IO (standalone Node.js server on Railway)         ║
║ Auth             ║ JWT + bcrypt + httpOnly cookies + Supabase sessions table ║
║ Deployment       ║ Vercel (Next.js) + Railway (Socket server)               ║
║ State Management ║ Zustand — gameStore, portfolioStore, authStore           ║
║ Charts           ║ Recharts — price history line charts                     ║
╚══════════════════╩══════════════════════════════════════════════════════════╝
```

---

## `[02] FOLDER STRUCTURE`

```
stock-challenge/
├── src/
│   ├── app/
│   │   ├── admin/                  # Admin dashboard (protected, role=admin)
│   │   ├── trade/                  # Participant trading page (protected)
│   │   ├── login/                  # Public login page
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/          # POST — authenticate, set httpOnly JWT cookie
│   │       │   ├── logout/         # POST — destroy session, clear cookie
│   │       │   ├── me/             # GET  — return current user from session
│   │       │   └── token/          # GET  — return raw JWT for Socket.IO auth
│   │       ├── admin/
│   │       │   ├── events/         # GET/POST/DELETE — CRUD for game events
│   │       │   ├── game/           # POST — game control actions (state transitions)
│   │       │   ├── stocks/         # GET/POST/DELETE — manage stocks & round prices
│   │       │   └── users/          # POST — bulk create, reset password, delete users
│   │       ├── participant/
│   │       │   ├── portfolio/      # GET — current balance, holdings, portfolio value
│   │       │   └── trade/          # POST — execute BUY or SELL trade
│   │       └── game/
│   │           ├── active-event/   # GET — fetch currently active/running event
│   │           ├── charts/         # GET — stock price history across all rounds
│   │           ├── leaderboard/    # GET — ranked portfolio scores for an event
│   │           └── state/          # GET — current game_state row for an event
│   │
│   ├── components/
│   │   ├── admin/
│   │   │   ├── GameControls.tsx    # START GAME / START ROUND / RESET buttons
│   │   │   ├── EventManager.tsx    # Create and delete events
│   │   │   ├── UserManager.tsx     # Bulk user generation, credentials table, delete
│   │   │   ├── StockManager.tsx    # Add stocks, set round prices
│   │   │   ├── EventSelector.tsx   # Dropdown to switch active event
│   │   │   └── TradeMonitor.tsx    # Live trade log stream (via Socket.IO)
│   │   ├── trade/
│   │   │   ├── MarketList.tsx      # Live stock prices with BUY/SELL buttons
│   │   │   ├── HoldingsList.tsx    # Current participant holdings
│   │   │   ├── TradeModal.tsx      # Quantity input + confirm/cancel trade
│   │   │   ├── StatsBar.tsx        # Balance / Portfolio Value / P&L header bar
│   │   │   ├── TimerDisplay.tsx    # Round countdown timer (live via socket)
│   │   │   └── StockChart.tsx      # Recharts line chart — price history per stock
│   │   └── shared/
│   │       ├── Leaderboard.tsx     # Ranked leaderboard — polls every 10s
│   │       ├── Spinner.tsx         # Cyberpunk pulsing signal-bar loading spinner
│   │       └── Modal.tsx           # Accessible confirm/alert modal (focus-trapped)
│   │
│   ├── hooks/
│   │   ├── useSocket.ts            # Socket.IO client — connects, authenticates,
│   │   │                           # handles all inbound game events
│   │   ├── useAuth.ts              # Auth guard — redirects if role doesn't match
│   │   └── useModal.tsx            # Modal state hook (alert / confirm API)
│   │
│   ├── store/
│   │   ├── authStore.ts            # Zustand — current user, login/logout actions
│   │   ├── gameStore.ts            # Zustand — game status, round, timer, eventId
│   │   └── portfolioStore.ts       # Zustand — balance, holdings, P&L (persisted)
│   │
│   └── lib/
│       ├── services/
│       │   ├── auth.service.ts     # Login, session verify, bulk user creation,
│       │   │                       # case-insensitive username matching
│       │   ├── game.service.ts     # State machine — startGame, startRound,
│       │   │                       # endRound, reset, GAME_END detection
│       │   └── timer.service.ts    # Round timer init, countdown management
│       └── supabase/
│           ├── server.ts           # createClient (SSR cookie-based) +
│           │                       # createServiceClient (direct supabase-js,
│           │                       # guaranteed RLS bypass via service role)
│           └── database.types.ts   # Full TypeScript types for all DB tables
│
├── socket-server/
│   ├── src/
│   │   └── index.ts                # Express + Socket.IO server — JWT auth,
│   │                               # game event broadcasting, trade relay
│   └── dist/                       # Pre-compiled JS — committed for Railway deploy
│
├── middleware.ts                    # Next.js edge middleware — cookie auth guard
├── .env.local                       # Local environment variables (never commit)
└── README.md
```

---

## `[03] DATABASE SCHEMA`

> All tables have **RLS disabled**. Every DB operation goes through the service role client (`createServiceClient`) which uses `@supabase/supabase-js` directly — not `@supabase/ssr` — to guarantee the bypass.

### Tables

```sql
-- Identity & Auth
users           (id, username, password_hash, role: 'admin'|'participant', is_active)
sessions        (id, user_id → users, token, expires_at)

-- Competition Structure
events          (id, name, status, starting_balance, total_rounds, current_round, created_by → users)
game_state      (id, event_id → events, status: event_status enum, current_round,
                 timer_remaining, paused_at, last_updated)
rounds          (id, event_id → events, round_number, duration_seconds, status, started_at, ended_at)

-- Market Data
stocks          (id, event_id → events, symbol, name)
stock_prices    (id, stock_id → stocks, round_id → rounds, price)

-- Trading
portfolios      (id, user_id → users, event_id → events, balance)
holdings        (id, portfolio_id → portfolios, stock_id → stocks, quantity)
trades          (id, user_id → users, event_id → events, portfolio_id → portfolios,
                 stock_id → stocks, round_id → rounds, type: 'BUY'|'SELL', quantity, price)

-- Audit
admin_actions   (id, event_id → events, admin_id → users, action, created_at)
```

### `game_state.status` — PostgreSQL Enum

```sql
CREATE TYPE event_status AS ENUM (
  'IDLE', 'SETUP', 'READY', 'RUNNING',
  'ROUND_ACTIVE', 'ROUND_END', 'GAME_END', 'RESET'
);
```

The `game_state` row is created **automatically** when an event is created. Never needs manual insertion.

### Deletion Cascade Order

When deleting an **event**, FK constraints must be resolved in this order:

```
admin_actions → trades → holdings → portfolios
    → stock_prices → stocks → rounds → game_state → events
```

When deleting a **user**:

```
sessions → trades → holdings → portfolios → users
```

---

## `[04] GAME STATE MACHINE`

```
                    ┌─────────────────────────────────────────────────────┐
                    │                   GAME FLOW                         │
                    └─────────────────────────────────────────────────────┘

  [Create Event]
       │
       ▼
    READY ──────────────────[ START GAME ]──────────────────► RUNNING
                                                                  │
                                                         [ START ROUND N ]
                                                                  │
                                                                  ▼
                                                           ROUND_ACTIVE
                                                          (timer running)
                                                                  │
                                                      (timer hits 0, auto)
                                                                  │
                                                                  ▼
                                                            ROUND_END
                                                                  │
                                               ┌──────────────────┘
                                               │
                              ┌────────────────▼────────────────┐
                              │   More rounds remaining?         │
                              └────────────────┬────────────────┘
                                    │                   │
                                   YES                  NO
                                    │                   │
                            [ START ROUND N+1 ]         ▼
                                    │               GAME_END
                                    ▼
                              ROUND_ACTIVE
                                 (loop)

  ──────────────────────────────────────────────────────────────────────
  RESET (any state) → clears all trades/holdings, resets all portfolios
                      to starting_balance, resets rounds → back to READY
  ──────────────────────────────────────────────────────────────────────
```

### Step-by-Step Admin Flow

| Step | Action | Resulting Status |
|------|--------|-----------------|
| 1 | Create event in **EVENTS** tab | `READY` |
| 2 | Add stocks + prices per round in **STOCKS** tab | `READY` |
| 3 | Generate participant users in **USERS** tab | `READY` |
| 4 | Click **START GAME** | `RUNNING` |
| 5 | Click **START ROUND** | `ROUND_ACTIVE` — timer starts, prices broadcast |
| 6 | Timer expires automatically | `ROUND_END` |
| 7 | Repeat steps 5–6 for each round | — |
| 8 | Last round ends | `GAME_END` (auto) |
| — | **RESET** (any time) | `READY` — all data wiped |

> **Design decision:** `END ROUND` and `PAUSE/RESUME` buttons were intentionally removed. Rounds end only when the timer expires naturally. This keeps competition fair and eliminates the risk of accidental early termination.

---

## `[05] SOCKET EVENTS`

The Socket.IO server runs as a standalone Node.js process on Railway. Next.js serverless functions cannot maintain persistent connections — hence the separation.

### Authentication Flow

```
Participant browser
    │
    ├─► GET /api/auth/token  (httpOnly cookie → server reads it, returns raw JWT)
    │         │
    │         └── JWT cannot be read from JS directly (httpOnly) — this endpoint
    │              acts as a secure bridge
    │
    └─► socket.connect({ auth: { token } })
              │
              └── Socket server validates JWT on 'connection' event
                  Invalid token → socket.disconnect()
```

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `GAME_START` | — | Game has started, transition from waiting screen |
| `ROUND_START` | `{ roundNumber, durationSeconds, prices: { [symbol]: price } }` | New round began — includes all stock prices for the round |
| `ROUND_END` | `{ roundNumber }` | Round timer expired |
| `TIMER_TICK` | `{ remaining }` | Countdown tick — seconds remaining |
| `GAME_END` | — | Competition over, show final results |
| `TRADE_EXECUTED` | `{ success, newBalance, newHoldings }` | Confirmation of a trade |
| `FORCE_LOGOUT` | `{ reason }` | Admin-triggered force disconnect |

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `JOIN_GAME` | `{ userId, token }` | Join the game room for an event |
| `EXECUTE_TRADE` | `{ type, stockId, quantity, eventId }` | Submit a BUY or SELL order |

---

## `[06] ADMIN PANEL`

Access: `/admin` — requires `role: admin` cookie session. Protected by Next.js middleware.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ADMIN CONTROL  ●  [CONTROL] [USERS] [STOCKS] [MONITOR] [EVENTS]           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tab: CONTROL

The primary game operations tab.

- **Event Selector** — dropdown to choose which event is currently being managed. All actions apply to the selected event.
- **Status Badge** — live game status (`READY` / `RUNNING` / `ROUND_ACTIVE` / `ROUND_END` / `GAME_END`)
- **Round Indicator** — `ROUND 2 / 5` etc.
- **Countdown Timer** — live timer fed by `TIMER_TICK` socket events

Three buttons, each with loading spinner:

| Button | Enabled When | Action |
|--------|-------------|--------|
| `START GAME` | `status === READY` | Transitions to `RUNNING` |
| `START ROUND` | `status === RUNNING` or `ROUND_END` | Transitions to `ROUND_ACTIVE`, starts timer, broadcasts prices |
| `RESET` | Always (requires confirmation modal) | Wipes all trades/holdings/portfolios, back to `READY` |

> END ROUND and PAUSE/RESUME have been intentionally removed. Rounds end on timer expiry only.

### Tab: USERS

Full user lifecycle management for the competition.

- **Bulk Generate** — enter a count and prefix (e.g. `player`, `30`) → creates `player01` through `player30` with random passwords
- **Credentials Table** — shows username + password for every generated user. Passwords are **masked by default** with a per-row show/hide toggle
- **Session persistence** — credentials survive page refresh via `sessionStorage` but clear on tab close (intentional — don't leave passwords exposed)
- **Reset Password** — generate a new random password for any individual user; new password shown in a modal
- **Disable / Enable** — toggle a user's `is_active` flag. Disabled users cannot log in
- **Delete Individual** — cascades: `sessions → trades → holdings → portfolios → user`
- **Delete All Participants** — one-click nuke of all non-admin users. Requires confirmation modal. Same cascade order

### Tab: STOCKS

Configure the market for the selected event.

- **Add Stock** — enter symbol (e.g. `AAPL`) and name. Stock is saved to `stocks` table for the event
- **Set Round Prices** — for each stock, enter a price per round (e.g. Round 1: 150, Round 2: 175, Round 3: 160). Saved to `stock_prices` linked to the corresponding `rounds` row
- **Delete Stock** — removes stock and all associated `stock_prices` rows
- Prices entered here are the ones broadcast to all participants when `START ROUND` is clicked

### Tab: MONITOR

Live operational overview during the competition.

- **Trade Log** — real-time stream of all trades as they execute, received via `TRADE_LOG` socket event. Shows username, action (BUY/SELL), symbol, quantity, price, timestamp
- **Leaderboard** — full ranked leaderboard polling every 10 seconds. Shows rank, username, cash balance, portfolio value, total value, P&L with rank-change flash animation

### Tab: EVENTS

Create and manage competition events.

- **Create Event** — form fields: name, starting balance (₨), number of rounds, round duration (minutes)
- **Event List** — shows all events with status badge, round count, starting balance
- **Delete Event** — full cascade deletion. Button is **disabled** during `ROUND_ACTIVE` or `PAUSED` status to prevent mid-round data corruption

---

## `[07] PARTICIPANT PANEL`

Access: `/trade` — requires any valid session (participant or admin). Protected by middleware.

### Waiting Screen

Shown when `status` is `IDLE`, `SETUP`, or `READY`, or when no active event is found.

```
> WAITING FOR GAME TO START
  Stand by — competition will begin shortly
  Logged in as player07
```

Polls `/api/game/state` every 3 seconds until status changes.

### Active Game Screen

Once `ROUND_ACTIVE`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STOCK CHALLENGE         ROUND 2/5          ● player07                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  BALANCE: ₨12,450.00    PORTFOLIO: ₨8,320.00    P&L: +₨770.00             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ⏱ 04:32 remaining                                                          │
├──────────────────────────────┬──────────────────────────────────────────────┤
│  [MARKET]  [LEADERBOARD]     │                                              │
│                              │                                              │
│  AAPL   ₨175.00  [BUY][SELL] │  Holdings:                                  │
│  MSFT   ₨320.00  [BUY][SELL] │  AAPL × 10   ₨1,750.00                     │
│  TSLA   ₨245.00  [BUY][SELL] │  MSFT × 5    ₨1,600.00                     │
│  AMZN   ₨190.00  [BUY][SELL] │                                              │
└──────────────────────────────┴──────────────────────────────────────────────┘
```

- **StatsBar** — Cash balance, portfolio value (holdings at current prices), total P&L vs starting balance
- **TimerDisplay** — Live countdown driven by `TIMER_TICK` socket events
- **MarketList** — All stocks with current round prices and BUY/SELL buttons. Buttons disabled between rounds
- **HoldingsList** — Current positions with current value
- **TradeModal** — Opens on BUY/SELL click. Quantity input, shows total cost, confirm/cancel
- **Tabs: MARKET / LEADERBOARD** — switch between the trading view and the live leaderboard

### Stock Chart

Appears after Round 1 completes. Recharts line chart showing price history across all completed rounds. One line per stock, each in a distinct cyberpunk neon color. Helps participants spot trends across rounds.

### Game End Screen

```
> COMPETITION ENDED — FINAL PORTFOLIO VALUE

  ₨ 21,340.00
  +₨ 1,340.00 P&L

  [ FINAL LEADERBOARD ]
```

Full leaderboard rendered below the final stats.

### Real-Time Sync

On `ROUND_START` socket event, participants:
1. Fetch fresh game state from `/api/game/state?eventId=...` (cache-busted)
2. Refresh portfolio from `/api/participant/portfolio` to ensure full sync

This double-fetch ensures the UI is consistent even if a socket event was missed during reconnect.

### Login

- Username matching is **case-insensitive** (`player01` = `PLAYER01` = `Player01`)
- Auth sets an httpOnly cookie with JWT — no token ever touches `localStorage`

---

## `[08] ENVIRONMENT VARIABLES`

### Vercel (Next.js App)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Auth
JWT_SECRET=your-super-secret-jwt-key

# Socket
SOCKET_SERVER_URL=https://your-railway-app.up.railway.app
NEXT_PUBLIC_SOCKET_URL=https://your-railway-app.up.railway.app
```

### Railway (Socket Server)

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=your-super-secret-jwt-key
CORS_ORIGIN=https://stockchallenge.vercel.app
PORT=4000
```

> `JWT_SECRET` must be **identical** on both Vercel and Railway — the socket server validates tokens that were signed by the Next.js API.

---

## `[09] DEPLOYMENT`

### Next.js → Vercel

```
git push origin main
→ Vercel auto-deploys
→ All API routes run as serverless functions
→ Set all env vars in Vercel project settings
```

### Socket Server → Railway

The socket server is a standalone Node.js app in `socket-server/`. It is **pre-compiled** — the `dist/` directory is committed to the repo so Railway doesn't need to run `tsc`.

```
Railway project settings:
  Root Directory:   socket-server/
  Build Command:    echo 'using prebuilt dist'
  Start Command:    node dist/index.js
```

Key deployment details:

- `typescript` is in `dependencies` (not `devDependencies`) so Railway can find it if needed
- `CORS_ORIGIN` **must** be set to the exact Vercel URL (e.g. `https://stockchallenge.vercel.app`) — no trailing slash
- If socket connections fail, check CORS first

### Supabase

- Create all tables manually or via migration scripts
- **Disable RLS** on every table
- `game_state.status` must be a PostgreSQL `enum` type named `event_status`
- Confirm `createServiceClient` uses `@supabase/supabase-js` directly — not `@supabase/ssr` — to guarantee the service role key bypasses RLS
- Apply performance migration for leaderboard RPC + indexes:

```sql
-- Run this file in Supabase SQL editor
supabase/migrations/20260327_leaderboard_rpc_indexes.sql
```

```typescript
// server.ts — correct pattern
import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

---

## `[10] LOCAL SETUP`

```bash
# 1. Clone the repo
git clone https://github.com/your-org/stock-challenge.git
cd stock-challenge

# 2. Install Next.js dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# → fill in SUPABASE, JWT_SECRET, SOCKET_SERVER_URL values

# 4. Run Next.js dev server
npm run dev
# → http://localhost:3000

# ─────────────────────────────────────────
# In a separate terminal:
# ─────────────────────────────────────────

# 5. Install socket server dependencies
cd socket-server
npm install

# 6. Run socket server
npm run dev
# → ws://localhost:4000
```

> Set `NEXT_PUBLIC_SOCKET_URL=http://localhost:4000` and `SOCKET_SERVER_URL=http://localhost:4000` in `.env.local` for local development.

---

## `[11] PRE-COMPETITION CHECKLIST`

```
┌─────────────────────────────────────────────────────────────────┐
│             PRE-COMPETITION SYSTEM CHECKLIST                    │
└─────────────────────────────────────────────────────────────────┘

  [ ] 1.  Clear all test data from Supabase
          DELETE FROM admin_actions, trades, holdings, portfolios,
                      stock_prices, stocks, rounds, game_state,
                      events, users WHERE role = 'participant';

  [ ] 2.  Create a new event
          → name, starting balance, round count, round duration (mins)
          → game_state row is created automatically

  [ ] 3.  Add all stocks to the event in the STOCKS tab
          → Set prices for EVERY round for EVERY stock
          → Missing prices = ₨0 broadcast to participants

  [ ] 4.  Generate participant users in the USERS tab
          → Copy/screenshot credentials before closing the tab
          → sessionStorage clears on tab close

  [ ] 5.  Verify game_state row exists
          SELECT * FROM game_state WHERE event_id = '<your-event-id>';
          → status should be 'READY'

  [ ] 6.  Dry run (strongly recommended)
          → START GAME
          → START ROUND 1
          → Confirm participant panel transitions from waiting → active
          → Confirm stock prices appear correctly
          → Wait for timer to expire naturally
          → Confirm status → ROUND_END
          → START ROUND 2, repeat
          → Confirm GAME_END after last round
          → RESET → back to READY

  [ ] 7.  Confirm deployments are green
          → Vercel: all API routes returning 200
          → Railway: socket server logs show 'listening on port 4000'
          → Socket connection indicator (●) is GREEN on both admin
            and participant panels

  [ ] 8.  Distribute credentials to participants
          → Confirm they can log in at https://stockchallenge.vercel.app
          → Confirm they see the "WAITING FOR GAME TO START" screen
```

---

## `[12] CREDITS`

```
╔══════════════════════════════════════════════════════════╗
║              BUILT BY                                    ║
║                                                          ║
║   Talha Ahmad                                            ║
║                                                          ║
║   Stack assembled in the dark with too much caffeine.    ║
║   If it breaks during the competition — RESET exists.    ║
╚══════════════════════════════════════════════════════════╝
```

**Technologies used:**
- [Next.js](https://nextjs.org) — the backbone
- [Supabase](https://supabase.com) — database + auth infrastructure
- [Socket.IO](https://socket.io) — real-time event bus
- [Vercel](https://vercel.com) — serverless deployment
- [Railway](https://railway.app) — persistent socket server hosting
- [Zustand](https://github.com/pmndrs/zustand) — zero-boilerplate state management
- [Tailwind CSS](https://tailwindcss.com) — cyberpunk utility-first styling
- [Recharts](https://recharts.org) — price history visualization

---

<div align="center">

```
[ SYSTEM READY ] · [ MARKET OPEN ] · [ MAY THE BEST TRADER WIN ]
```

**`https://stockchallenge.vercel.app`**

</div>

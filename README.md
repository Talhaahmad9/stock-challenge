```
███╗   ███╗ █████╗ ██████╗ ██╗  ██╗███████╗████████╗
████╗ ████║██╔══██╗██╔══██╗██║ ██╔╝██╔════╝╚══██╔══╝
██╔████╔██║███████║██████╔╝█████╔╝ █████╗     ██║
██║╚██╔╝██║██╔══██║██╔══██╗██╔═██╗ ██╔══╝     ██║
██║ ╚═╝ ██║██║  ██║██║  ██║██║  ██╗███████╗   ██║
╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝

███╗   ███╗ █████╗ ██╗   ██╗██╗  ██╗███████╗███╗   ███╗
████╗ ████║██╔══██╗╚██╗ ██╔╝██║  ██║██╔════╝████╗ ████║
██╔████╔██║███████║ ╚████╔╝ ███████║█████╗  ██╔████╔██║
██║╚██╔╝██║██╔══██║  ╚██╔╝  ██╔══██║██╔══╝  ██║╚██╔╝██║
██║ ╚═╝ ██║██║  ██║   ██║   ██║  ██║███████╗██║ ╚═╝ ██║
╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝
```

<div align="center">

**`[ SYSTEM: ONLINE ]` &nbsp;·&nbsp; `[ PLAYERS: CONNECTED ]` &nbsp;·&nbsp; `[ MARKET: OPEN ]`**

# **MARKET MAYHEM**

[![Live](https://img.shields.io/badge/LIVE-marketmayhem.vercel.app-00ff41?style=for-the-badge&logo=vercel&logoColor=black)](https://marketmayhem.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?style=for-the-badge&logo=socket.io)](https://socket.io)
[![Railway](https://img.shields.io/badge/Railway-Socket_Server-7B2FBE?style=for-the-badge&logo=railway)](https://railway.app)

</div>

---

## `> INITIALIZING SYSTEM...`

**MARKET MAYHEM** is a real-time multiplayer stock trading simulation built for university finance society competitions. An admin controls timed trading rounds, participants trade stocks with virtual money, and a live leaderboard ranks everyone by total portfolio value. Built for ~60–70 concurrent players in a single high-pressure session.

> No real money. Maximum adrenaline.

---

## `> TABLE OF CONTENTS`

```
[00] RECENT UPDATES (v1.3)
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

## `╔═ [00] RECENT UPDATES (v1.3) — April 2026`

### ✅ Completed Improvements

**Server-Driven Timer (TIMER_TICK)**
- Socket server now broadcasts `TIMER_TICK` every second with `{ eventId, remaining, expiresAt, serverTimeMs }`
- Clients consume ticks via `useSocket` and re-anchor the timer with `syncTimerSnapshot`
- Timer display derives time from `timerExpiresAtMs` + client clock offset (`useMemo`) — no cascading re-render warnings
- Compare-and-set in `timerLoop` prevents duplicate decrements across concurrent timer workers
- `USE_TIMER_V2=true` (default) activates `round_expires_at`-based server-side expiry for accurate wall-clock countdown
- Fallback to decrement mode when `round_expires_at` column is absent (legacy DB compat)

**Socket.IO State Synchronization**
- Added strict `eventId` filtering for `GAME_START`, `ROUND_START`, `ROUND_END`, `TIMER_TICK`, `GAME_PAUSED`, `GAME_RESUMED`, `GAME_STATE_UPDATED`
- Pause/resume updates only for the matching event room
- `GAME_RESET` event broadcast on admin reset; `GAME_STATE_UPDATED` alias `STATE_UPDATED` preserved for backward compat

**P&L Chart & Valuation**
- P&L chart at `/api/game/charts` and `/api/charts` refetches on round/status transitions
- Y-axis domain fixed to `[0, 15000]` for consistent scale across rounds
- Chart uses custom cyberpunk-themed tooltip with per-round P&L and total portfolio value

**Admin Controls & Security**
- Synchronous **END ROUND** control (`END_AND_START_NEXT_ROUND`):
  - Ends active round, broadcasts `ROUND_END`
  - Immediately starts next round and broadcasts `ROUND_START` (unless final round)
  - Final round transitions to `GAME_END`
- Separate `END_ROUND` action retained for standalone round-end without auto-advance
- Admin-generated user credentials persist via `localStorage`
- Password reset updates visible credentials immediately
- Admin can kick users via `ADMIN_KICK_USER` socket event (triggers `FORCE_LOGOUT` + forced disconnect)

**UI/UX**
- App branding: **MARKET MAYHEM**
- Participant trade panel: focused layout (no leaderboard tab) — Market + Holdings side-by-side
- Leaderboard available in admin MONITOR tab and via `GET /api/game/leaderboard`
- Root page (`/`) auto-redirects: admins → `/admin`, participants → `/trade`
- Currency displayed as ₨ (Pakistani Rupee) throughout trade UI

### v1.2 — March 2026
- Timer display refactored to `useMemo`-based derived state
- `END_AND_START_NEXT_ROUND` synchronous admin action added
- App renamed to Market Mayhem

---

## `╔═ [01] TECH STACK`

```
╔══════════════════╦══════════════════════════════════════════════════════════╗
║ LAYER            ║ TECHNOLOGY                                               ║
╠══════════════════╬══════════════════════════════════════════════════════════╣
║ Frontend         ║ Next.js 16 (App Router), React 19, Tailwind CSS         ║
║ Backend          ║ Next.js API Routes + Node Socket Server                  ║
║ Database         ║ Supabase (PostgreSQL, service role)                      ║
║ Realtime         ║ Socket.IO (standalone Node.js server on Railway)         ║
║ Auth             ║ JWT + bcrypt + httpOnly cookies + sessions table         ║
║ Deployment       ║ Vercel (Next.js) + Railway (Socket server)               ║
║ State Management ║ Zustand — gameStore, portfolioStore, authStore           ║
║ Charts           ║ Recharts — participant P&L history                        ║
╚══════════════════╩══════════════════════════════════════════════════════════╝
```

---

## `╔═ [02] FOLDER STRUCTURE`

```
stock-challenge/
├── src/
│   ├── app/
│   │   ├── page.tsx              # root redirect (/ → /admin or /trade)
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── admin/                # admin dashboard (/admin)
│   │   ├── trade/                # participant trade panel (/trade)
│   │   ├── login/                # login page (/login)
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/        # POST — issue session cookie + JWT
│   │       │   ├── logout/       # POST — clear session
│   │       │   ├── me/           # GET  — current user from cookie
│   │       │   └── token/        # GET  — short-lived socket token
│   │       ├── admin/
│   │       │   ├── events/       # GET/POST/DELETE events
│   │       │   ├── game/         # POST — admin game actions
│   │       │   ├── stocks/       # CRUD stock + prices
│   │       │   └── users/        # CRUD participants
│   │       ├── game/
│   │       │   ├── active-event/ # GET — current RUNNING/ROUND_ACTIVE event
│   │       │   ├── charts/       # GET — per-user P&L history
│   │       │   ├── leaderboard/  # GET — ranked portfolio values (RPC)
│   │       │   └── state/        # GET — current game_state for eventId
│   │       ├── charts/           # GET — alias P&L chart endpoint
│   │       └── participant/
│   │           ├── portfolio/    # GET — holdings + balance
│   │           └── trade/        # POST — execute BUY/SELL
│   ├── components/
│   │   ├── admin/
│   │   │   ├── EventManager.tsx
│   │   │   ├── EventSelector.tsx
│   │   │   ├── GameControls.tsx
│   │   │   ├── StockManager.tsx
│   │   │   ├── TradeMonitor.tsx
│   │   │   └── UserManager.tsx
│   │   ├── trade/
│   │   │   ├── HoldingsList.tsx
│   │   │   ├── MarketList.tsx
│   │   │   ├── StatsBar.tsx
│   │   │   ├── StockChart.tsx   # P&L chart (Recharts, Y fixed [0, 15000])
│   │   │   ├── TimerDisplay.tsx # derived-state timer, anchored to server tick
│   │   │   └── TradeModal.tsx
│   │   └── shared/
│   │       ├── Leaderboard.tsx
│   │       ├── Modal.tsx
│   │       └── Spinner.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useModal.tsx
│   │   └── useSocket.ts         # manages Socket.IO lifecycle + event handlers
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── gameStore.ts         # game status + timer snapshot state
│   │   └── portfolioStore.ts
│   └── lib/
│       ├── services/
│       │   ├── auth.service.ts
│       │   ├── game.service.ts  # state machine transitions
│       │   ├── timer.service.ts # initRoundTimer (sets round_expires_at)
│       │   └── trading.service.ts
│       └── supabase/
│           ├── client.ts
│           ├── database.types.ts
│           └── server.ts
├── socket-server/
│   ├── src/
│   │   ├── events.ts            # EVENTS const (all event names)
│   │   └── server.ts            # Express + Socket.IO + timerLoop
│   └── package.json
├── supabase/
│   └── migrations/              # local-only, not tracked by git
├── middleware.ts
└── README.md
```

---

## `╔═ [03] DATABASE SCHEMA`

Core tables:

```sql
users          — id, username, password_hash, role, is_active
sessions       — id, user_id, token, expires_at
events         — id, name, status, starting_balance, current_round, total_rounds, created_by
game_state     — id, event_id, current_round, status, timer_remaining,
                 round_started_at, round_expires_at, paused_at, last_updated
rounds         — id, event_id, round_number, duration_seconds, case_study, status, started_at, ended_at
stocks         — id, event_id, symbol, name, sector, description
stock_prices   — id, stock_id, round_id, price
portfolios     — id, user_id, event_id, balance
holdings       — id, portfolio_id, stock_id, quantity, avg_buy_price
trades         — id, user_id, stock_id, round_id, event_id, type, quantity, price, total_value, executed_at
admin_actions  — id, admin_id, event_id, action_type, details, created_at
```

`game_state.status` values:

```sql
IDLE, SETUP, READY, RUNNING, PAUSED, ROUND_ACTIVE, ROUND_END, GAME_END, RESET
```

Notes:
- `game_state.round_expires_at` is set by `initRoundTimer` and used by the socket server timer loop (`USE_TIMER_V2`) for wall-clock accurate countdown
- `game_state.round_started_at` records when the current round began
- Service-role client is used for privileged operations
- `supabase/migrations/` is intentionally not tracked on GitHub

---

## `╔═ [04] GAME STATE MACHINE`

```
                   IDLE ──► SETUP ──► READY
                                        │
                                   START GAME
                                        │
                                        ▼
                                     RUNNING ◄──────────────────────┐
                                        │                           │
                                   START ROUND               RESUME (from RUNNING)
                                        │                           │
                                        ▼                           │
                        ┌──────── ROUND_ACTIVE ────────► PAUSED ───┘
                        │               │                  │
                   PAUSE│          timer expiry        RESUME (from ROUND_ACTIVE)
                        │          or END ROUND             │
                        │               ▼                   │
                        └──────────► ROUND_END ◄────────────┘
                                        │
                          ┌─────────────┴─────────────┐
                          │                           │
                   START NEXT ROUND             FINAL ROUND
                          │                           │
                          ▼                           ▼
                      ROUND_ACTIVE               GAME_END
                                                     │
                                                   RESET
                                                     │
                                                     ▼
                                                    IDLE
```

State transition map enforced by `game.service.ts`:

```
IDLE         → SETUP
SETUP        → READY
READY        → RUNNING
RUNNING      → ROUND_ACTIVE | PAUSED
ROUND_ACTIVE → ROUND_END | PAUSED
ROUND_END    → ROUND_ACTIVE | GAME_END
PAUSED       → ROUND_ACTIVE | RUNNING
GAME_END     → RESET
RESET        → IDLE
```

RESET from admin control broadcasts `GAME_RESET` and returns event to `READY` with cleared round/trade runtime state.

---

## `╔═ [05] SOCKET EVENTS`

All game broadcasts are scoped by event room: `game:<eventId>`.

### Server → Client

```
GAME_START           — game transitioned to RUNNING
ROUND_START          — new round started; carries prices, duration, expiresAt
ROUND_END            — round ended (auto timer expiry or manual)
TIMER_TICK           — every second: { eventId, remaining, expiresAt, serverTimeMs }
GAME_PAUSED          — (alias: GAME_PAUSE) game paused; carries timerRemaining
GAME_RESUMED         — (alias: GAME_RESUME) game resumed; carries timerRemaining
GAME_STATE_UPDATED   — (alias: STATE_UPDATED) generic state sync
GAME_END             — competition over
GAME_RESET           — event reset to READY; triggers client state clear
TRADE_EXECUTED       — trade confirmation (currently via REST response, not broadcast)
TRADE_LOG            — admin trade monitor feed
FORCE_LOGOUT         — admin kicked user; client redirects to /login
JOINED               — socket ack: successfully joined game room
AUTH_ERROR           — JWT verification failed on connection
```

### Client → Server

```
JOIN_GAME            — join event room: { userId, token, eventId }
LEAVE_GAME           — leave all game rooms
EXECUTE_TRADE        — disabled; returns TRADE_ERROR (trades must use REST API)
ADMIN_KICK_USER      — admin only: force-disconnect a user by userId
```

### Internal REST (socket server, not client-facing)

```
POST /internal/broadcast       — called by Next.js API routes to push events
POST /internal/broadcast-user  — unicast to a specific userId room
```

---

## `╔═ [06] ADMIN PANEL`

Access: `/admin` (admin role required)

### Control tab buttons (current)

- `START GAME`
- `START ROUND`
- `END ROUND` (synchronous end + start next)
- `PAUSE`
- `RESUME`
- `RESET`

### End Round behavior

When a round is `ROUND_ACTIVE`, clicking **END ROUND** calls `END_AND_START_NEXT_ROUND`:

1. End active round and persist `ROUND_END`
2. Broadcast `ROUND_END`
3. If not final round:
   - initialize timer for next round
   - start next round
   - broadcast `ROUND_START` with price payload
4. If final round, game proceeds to `GAME_END`

### Other admin tabs

- `USERS`: generate/reset/toggle/delete users, credentials persisted in local storage
- `STOCKS`: define symbols and round prices
- `MONITOR`: live trades + leaderboard
- `EVENTS`: create/delete/select event

---

## `╔═ [07] PARTICIPANT PANEL`

Access: `/trade`

### Current participant layout

- Header + connection status indicator
- Stats bar (balance / portfolio value / P&L)
- Timer display during `ROUND_ACTIVE` or `PAUSED`
- Market list + holdings side-by-side
- P&L history chart after rounds begin
- No leaderboard tab in active trade panel

### End-of-game screen

- Final portfolio value and total P&L summary

---

## `╔═ [08] ENVIRONMENT VARIABLES`

### Next.js app (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
SOCKET_SERVER_URL=http://localhost:4000        # server-side only (API → socket)
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000  # client-side (browser → socket)
```

### Socket server (`.env`)

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
CORS_ORIGIN=http://localhost:3000
PORT=4000
USE_TIMER_V2=true   # default true — uses round_expires_at for wall-clock countdown
                    # set false to fall back to simple 1s decrement mode
```

`JWT_SECRET` must match across app and socket server.

---

## `╔═ [09] DEPLOYMENT`

- Next.js app: Vercel
- Socket server: Railway
- Database: Supabase

Operational notes:
- Ensure socket CORS origin matches frontend domain exactly
- Ensure both services share same JWT secret

---

## `╔═ [10] LOCAL SETUP`

```bash
# app
cd stock-challenge
npm install
npm run dev

# socket (separate terminal)
cd stock-challenge/socket-server
npm install
npm run dev
```

---

## `╔═ [11] PRE-COMPETITION CHECKLIST`

- Create/select active event
- Add stocks and all round prices
- Generate participant credentials
- Dry-run:
  - START GAME
  - START ROUND 1
  - Verify timer + prices + trades
  - Verify ROUND_END transition
  - Verify END ROUND manual transition
- Verify final round reaches GAME_END
- Verify RESET returns event to READY

---

## `╔═ [12] CREDITS`

<div align="center">

```text
╔══════════════════════════════════════════════════════════╗
║                       BUILT BY                           ║
╚══════════════════════════════════════════════════════════╝
```

### [Talha Ahmad](https://talhaahmad.vercel.app)

*Stack assembled in the dark with too much caffeine.*

**Outtrade the noise. Own the close.**

</div>

---

<div align="center">

```
[ SYSTEM READY ] · [ MARKET OPEN ] · [ MAY THE BEST TRADER WIN ]
```

**`https://marketmayhem.vercel.app`**

</div>

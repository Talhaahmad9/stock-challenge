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
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
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
[00] RECENT UPDATES (v1.2)
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

## `╔═ [00] RECENT UPDATES (v1.2) — March 2026`

### ✅ Completed Improvements

**Timer System Refactor**
- Timer display now uses derived state (`useMemo`) to avoid cascading re-render warnings
- Timer is anchored to client receipt time on `ROUND_START` to remove server/client clock skew
- Fixed live round start skew where timer appeared to start late (e.g. 38s instead of 60s)

**Socket.IO State Synchronization**
- Added strict `eventId` filtering for game status events
- Pause/resume now updates only for the matching event room
- Added safer status transitions around `ROUND_END` fallback behavior

**P&L Chart & Valuation**
- P&L chart refetches on round/status transitions
- Improved valuation fallback flow for portfolio calculations

**Admin Controls & Security**
- Added synchronous **END ROUND** control (`END_AND_START_NEXT_ROUND`) that:
  - Ends active round
  - Broadcasts `ROUND_END`
  - Starts next round immediately in the same flow (unless final round)
  - Broadcasts `ROUND_START` with next-round prices and duration
- Admin-generated user credentials persist via `localStorage`
- Password reset updates visible credentials immediately

**UI/UX**
- App branding updated to **MARKET MAYHEM**
- Participant trade panel no longer has market/leaderboard tabs (focused trading layout)
- Leaderboard remains available in admin monitor tab and via leaderboard API

### Latest Commit
- `4ee6868` — Add synchronous End Round control and rename app to Market Mayhem

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
│   │   ├── admin/
│   │   ├── trade/
│   │   ├── login/
│   │   └── api/
│   │       ├── auth/
│   │       ├── admin/
│   │       ├── participant/
│   │       └── game/
│   ├── components/
│   │   ├── admin/
│   │   ├── trade/
│   │   └── shared/
│   ├── hooks/
│   ├── store/
│   └── lib/
├── socket-server/
│   ├── src/
│   │   ├── events.ts
│   │   └── server.ts
│   └── package.json
├── supabase/
│   └── migrations/        # local-only, ignored by git
├── middleware.ts
├── .env.local
└── README.md
```

---

## `╔═ [03] DATABASE SCHEMA`

Core tables:

```sql
users, sessions,
events, game_state, rounds,
stocks, stock_prices,
portfolios, holdings, trades,
admin_actions
```

`game_state.status` values used by app:

```sql
IDLE, SETUP, READY, RUNNING, PAUSED, ROUND_ACTIVE, ROUND_END, GAME_END, RESET
```

Notes:
- Service-role client is used for privileged operations
- `supabase/migrations/` is intentionally not tracked on GitHub

---

## `╔═ [04] GAME STATE MACHINE`

```
READY ── START GAME ──► RUNNING ── START ROUND ──► ROUND_ACTIVE
                                                   │
                              timer expiry or END ROUND action
                                                   ▼
                                                ROUND_END
                                         ┌──────────┴──────────┐
                                         │                     │
                                 START NEXT ROUND         FINAL ROUND
                                         │                     │
                                         ▼                     ▼
                                     ROUND_ACTIVE            GAME_END

RESET from admin control returns event to READY with cleared round/trade runtime state.
```

---

## `╔═ [05] SOCKET EVENTS`

Broadcast flow includes:

- `GAME_START`
- `ROUND_START`
- `ROUND_END`
- `GAME_PAUSED` (`GAME_PAUSE` alias)
- `GAME_RESUMED` (`GAME_RESUME` alias)
- `GAME_STATE_UPDATED`
- `GAME_END`
- `TRADE_LOG`
- `FORCE_LOGOUT`

All game broadcasts are scoped by event room: `game:<eventId>`.

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

### Next.js app

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
SOCKET_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

### Socket server

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
CORS_ORIGIN=http://localhost:3000
PORT=4000
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

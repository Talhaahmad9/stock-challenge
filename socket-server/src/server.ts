import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server, Socket } from 'socket.io'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { EVENTS } from './events'

// ─── Environment ──────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 4000
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000'
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const JWT_SECRET = process.env.JWT_SECRET!

// ─── Supabase ─────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ─── Express + HTTP + Socket.IO ───────────────────────────────────────────────

const app = express()
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

const server = http.createServer(app)

export const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface JwtPayload {
  userId: string
  username: string
  role: 'admin' | 'participant'
}

interface SocketUser {
  userId: string
  username: string
  role: 'admin' | 'participant'
}

interface InternalBroadcastBody {
  event: string
  data: unknown
  eventId?: string
}

declare module 'socket.io' {
  interface SocketData {
    user: SocketUser
  }
}

function normalizeEventName(event: string): string {
  if (event === EVENTS.GAME_PAUSE) return EVENTS.GAME_PAUSED
  if (event === EVENTS.GAME_RESUME) return EVENTS.GAME_RESUMED
  return event
}

function gameRoom(eventId: string): string {
  return `game:${eventId}`
}

function eventIdFromData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const value = (data as { eventId?: unknown }).eventId
  return typeof value === 'string' && value.length > 0 ? value : null
}

function leaveAllGameRooms(socket: Socket): void {
  for (const room of socket.rooms) {
    if (room.startsWith('game:')) {
      void socket.leave(room)
    }
  }
}

function emitWithAliases(event: string, data: unknown, eventId?: string): void {
  const normalizedEvent = normalizeEventName(event)
  const targetEventId = eventId ?? eventIdFromData(data)
  const target = targetEventId ? io.to(gameRoom(targetEventId)) : io.to('game')
  target.emit(normalizedEvent, data)

  if (normalizedEvent === EVENTS.GAME_PAUSED) {
    target.emit(EVENTS.GAME_PAUSE, data)
  }

  if (normalizedEvent === EVENTS.GAME_RESUMED) {
    target.emit(EVENTS.GAME_RESUME, data)
  }

  if (normalizedEvent === EVENTS.GAME_STATE_UPDATED) {
    target.emit('STATE_UPDATED', data)
  }
}

// ─── JWT auth middleware ──────────────────────────────────────────────────────

io.use((socket: Socket, next) => {
  const token = socket.handshake.auth.token as string | undefined
  if (!token) return next(new Error('No token provided'))
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    socket.data.user = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
    }
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})

// ─── Socket connection handler ────────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  const { userId, role } = socket.data.user
  void socket.join(userId)
  if (role === 'admin') void socket.join('admin')
  console.log(`[socket] connected: ${socket.data.user.username} (${role}) — ${socket.id}`)

  socket.on('JOIN_GAME', (payload: { userId: string; token: string; eventId?: string }) => {
    try {
      jwt.verify(payload.token, JWT_SECRET)
      leaveAllGameRooms(socket)
      if (payload.eventId) {
        void socket.join(gameRoom(payload.eventId))
      } else {
        // Legacy fallback for older clients that don't send eventId.
        void socket.join('game')
      }
      socket.emit('JOINED', { userId: payload.userId })
    } catch {
      socket.emit('AUTH_ERROR', { error: 'Invalid token' })
    }
  })

  socket.on('LEAVE_GAME', () => {
    leaveAllGameRooms(socket)
    void socket.leave('game')
  })

  socket.on('EXECUTE_TRADE', () => {
    socket.emit('TRADE_ERROR', { error: 'Use REST API for trades' })
  })

  socket.on('ADMIN_KICK_USER', (payload: { userId: string }) => {
    if (socket.data.user.role !== 'admin') return
    io.to(payload.userId).emit('FORCE_LOGOUT', { reason: 'Kicked by admin' })
    io.in(payload.userId)
      .fetchSockets()
      .then((sockets) => { for (const s of sockets) s.disconnect(true) })
      .catch((err: Error) => console.error('[socket] kick error:', err.message))
  })

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected: ${socket.data.user.username} — ${reason}`)
  })
})

// ─── Internal broadcast endpoint (called by Next.js API routes) ───────────────
// This is how the server-side API routes push real-time events to clients
// without going through a socket connection themselves.

app.post('/internal/broadcast', (req, res) => {
  const { event, data, eventId } = req.body as InternalBroadcastBody
  emitWithAliases(event, data, eventId)
  console.log(`[broadcast] ${normalizeEventName(event)}`, data)
  res.json({ ok: true })
})

app.post('/internal/broadcast-user', (req, res) => {
  const { userId, event, data } = req.body as { userId: string; event: string; data: unknown }
  io.to(userId).emit(event, data)
  res.json({ ok: true })
})

// ─── Timer loop ───────────────────────────────────────────────────────────────
// Polls DB every second for active rounds and broadcasts TIMER_TICK

async function timerLoop(): Promise<void> {
  try {
    // Find all events with an active round
    const { data: activeStates } = await supabase
      .from('game_state')
      .select('event_id, timer_remaining, status')
      .eq('status', 'ROUND_ACTIVE')

    if (activeStates && activeStates.length > 0) {
      for (const state of activeStates as { event_id: string; timer_remaining: number; status: string }[]) {
        const newRemaining = Math.max(0, state.timer_remaining - 1)

        // Compare-and-set avoids duplicate decrements across concurrent timer workers.
        const { data: updatedRows, error: updateError } = await supabase
          .from('game_state')
          .update({ timer_remaining: newRemaining })
          .eq('status', 'ROUND_ACTIVE')
          .eq('timer_remaining', state.timer_remaining)
          .eq('event_id', state.event_id)
          .select('event_id')

        if (updateError) {
          console.error(`[timer] update error for event ${state.event_id}:`, updateError.message)
          continue
        }

        if (!updatedRows || updatedRows.length === 0) {
          console.log(`[timer] compare-and-set failed for event ${state.event_id}: timer_remaining changed, skipping tick`);
          continue
        }

        // Timer is now calculated client-side, no need to broadcast TIMER_TICK every second
        // This reduces server load and eliminates the eventId serialization issue
        // io.to(gameRoom(state.event_id)).emit('TIMER_TICK', tickPayload)

        // If timer expired, auto-end the round
        if (newRemaining === 0) {
          console.log(`[timer] round expired for event ${state.event_id}, emitting ROUND_END`)
          io.to(gameRoom(state.event_id)).emit('ROUND_END', {
            eventId: state.event_id,
            auto: true,
          })
          await supabase
            .from('game_state')
            .update({ status: 'ROUND_END' })
            .eq('status', 'ROUND_ACTIVE')
            .eq('event_id', state.event_id)
        }
      }
    }
  } catch (err) {
    console.error('[timer] error:', err)
  }

  setTimeout(() => void timerLoop(), 1000)
}

// ─── HTTP routes ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', connections: io.engine.clientsCount })
})

// ─── Broadcast helpers ────────────────────────────────────────────────────────

export function broadcastToGame(event: string, data: unknown, eventId?: string): void {
  if (eventId) {
    io.to(gameRoom(eventId)).emit(event, data)
    return
  }
  io.to('game').emit(event, data)
}

export function broadcastToUser(userId: string, event: string, data: unknown): void {
  io.to(userId).emit(event, data)
}

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[socket] server running on port ${PORT}`)
  void timerLoop()
})
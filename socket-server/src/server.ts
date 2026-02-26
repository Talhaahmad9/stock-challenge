import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import http from 'http'
import { Server, Socket } from 'socket.io'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

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

declare module 'socket.io' {
  interface SocketData {
    user: SocketUser
  }
}

// ─── JWT auth middleware ──────────────────────────────────────────────────────

io.use((socket: Socket, next) => {
  const token = socket.handshake.auth.token as string | undefined

  if (!token) {
    return next(new Error('No token provided'))
  }

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

  // ── 1. JOIN_GAME ────────────────────────────────────────────────────────────
  socket.on('JOIN_GAME', (payload: { userId: string; token: string }) => {
    try {
      jwt.verify(payload.token, JWT_SECRET)
      void socket.join('game')
      socket.emit('JOINED', { userId: payload.userId })
    } catch {
      socket.emit('AUTH_ERROR', { error: 'Invalid token' })
    }
  })

  // ── 2. LEAVE_GAME ───────────────────────────────────────────────────────────
  socket.on('LEAVE_GAME', () => {
    void socket.leave('game')
  })

  // ── 3. EXECUTE_TRADE — redirect to REST ─────────────────────────────────────
  socket.on('EXECUTE_TRADE', () => {
    socket.emit('TRADE_ERROR', { error: 'Use REST API for trades' })
  })

  // ── 4. ADMIN_START_GAME ─────────────────────────────────────────────────────
  socket.on('ADMIN_START_GAME', (payload: { eventId: string }) => {
    if (socket.data.user.role !== 'admin') return
    io.to('game').emit('GAME_START', {
      eventId: payload.eventId,
      startTime: new Date().toISOString(),
    })
  })

  // ── 5. ADMIN_PAUSE_GAME ─────────────────────────────────────────────────────
  socket.on('ADMIN_PAUSE_GAME', (payload: { eventId: string }) => {
    if (socket.data.user.role !== 'admin') return
    io.to('game').emit('GAME_PAUSE', { eventId: payload.eventId })
  })

  // ── 6. ADMIN_RESUME_GAME ────────────────────────────────────────────────────
  socket.on('ADMIN_RESUME_GAME', (payload: { eventId: string; remainingTime: number }) => {
    if (socket.data.user.role !== 'admin') return
    io.to('game').emit('GAME_RESUME', {
      eventId: payload.eventId,
      remainingTime: payload.remainingTime,
    })
  })

  // ── 7. ADMIN_END_GAME ───────────────────────────────────────────────────────
  socket.on('ADMIN_END_GAME', (payload: { eventId: string; finalScores: unknown }) => {
    if (socket.data.user.role !== 'admin') return
    io.to('game').emit('GAME_END', {
      eventId: payload.eventId,
      finalScores: payload.finalScores,
    })
  })

  // ── 8. ADMIN_KICK_USER ──────────────────────────────────────────────────────
  socket.on('ADMIN_KICK_USER', (payload: { userId: string }) => {
    if (socket.data.user.role !== 'admin') return
    io.to(payload.userId).emit('FORCE_LOGOUT', { reason: 'Kicked by admin' })
    io.in(payload.userId)
      .fetchSockets()
      .then((sockets) => {
        for (const s of sockets) s.disconnect(true)
      })
      .catch((err: Error) => console.error('[socket] kick error:', err.message))
  })

  // ── 9. BROADCAST_ROUND_START — admin only ───────────────────────────────────
  socket.on('BROADCAST_ROUND_START', (payload: {
    eventId: string
    roundNumber: number
    durationSeconds: number
    prices: Record<string, number>
    caseStudy: string | null
  }) => {
    if (socket.data.user.role !== 'admin') return  // FIX: guard added
    io.to('game').emit('ROUND_START', {
      roundNumber: payload.roundNumber,
      durationSeconds: payload.durationSeconds,
      prices: payload.prices,
      caseStudy: payload.caseStudy,
    })
  })

  // ── 10. BROADCAST_ROUND_END — admin only ────────────────────────────────────
  socket.on('BROADCAST_ROUND_END', (payload: { eventId: string; roundNumber: number }) => {
    if (socket.data.user.role !== 'admin') return  // FIX: guard added
    io.to('game').emit('ROUND_END', { roundNumber: payload.roundNumber })
  })

  // ── 11. BROADCAST_TRADE — admin only ────────────────────────────────────────
  socket.on('BROADCAST_TRADE', (payload: { userId: string; tradeData: unknown }) => {
    if (socket.data.user.role !== 'admin') return  // FIX: guard added
    io.to(payload.userId).emit('TRADE_EXECUTED', { ...(payload.tradeData as object) })
    io.to('admin').emit('TRADE_LOG', { userId: payload.userId, tradeData: payload.tradeData })
  })

  // ── 12. TIMER_TICK ──────────────────────────────────────────────────────────
  socket.on('TIMER_TICK', (payload: { eventId: string; remaining: number }) => {
    if (socket.data.user.role !== 'admin') return  // FIX: guard added
    io.to('game').emit('TIMER_TICK', { remaining: payload.remaining })
  })

  // ── Disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected: ${socket.data.user.username} — ${reason}`)
  })
})

// ─── Broadcast helpers (used by admin panel directly) ─────────────────────────

export function broadcastToGame(event: string, data: unknown): void {
  io.to('game').emit(event, data)
}

export function broadcastToUser(userId: string, event: string, data: unknown): void {
  io.to(userId).emit(event, data)
}

// ─── HTTP routes ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', connections: io.engine.clientsCount })
})

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[socket] server running on port ${PORT}`)
})
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.supabase = void 0;
exports.broadcastToGame = broadcastToGame;
exports.broadcastToUser = broadcastToUser;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const supabase_js_1 = require("@supabase/supabase-js");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// ─── Environment ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
// ─── Supabase ─────────────────────────────────────────────────────────────────
exports.supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
// ─── Express + HTTP + Socket.IO ───────────────────────────────────────────────
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: CORS_ORIGIN }));
app.use(express_1.default.json());
const server = http_1.default.createServer(app);
exports.io = new socket_io_1.Server(server, {
    cors: {
        origin: CORS_ORIGIN,
        methods: ['GET', 'POST'],
    },
});
// ─── JWT auth middleware ──────────────────────────────────────────────────────
exports.io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token)
        return next(new Error('No token provided'));
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        socket.data.user = {
            userId: payload.userId,
            username: payload.username,
            role: payload.role,
        };
        next();
    }
    catch {
        next(new Error('Invalid token'));
    }
});
// ─── Socket connection handler ────────────────────────────────────────────────
exports.io.on('connection', (socket) => {
    const { userId, role } = socket.data.user;
    void socket.join(userId);
    if (role === 'admin')
        void socket.join('admin');
    console.log(`[socket] connected: ${socket.data.user.username} (${role}) — ${socket.id}`);
    socket.on('JOIN_GAME', (payload) => {
        try {
            jsonwebtoken_1.default.verify(payload.token, JWT_SECRET);
            void socket.join('game');
            socket.emit('JOINED', { userId: payload.userId });
        }
        catch {
            socket.emit('AUTH_ERROR', { error: 'Invalid token' });
        }
    });
    socket.on('LEAVE_GAME', () => { void socket.leave('game'); });
    socket.on('EXECUTE_TRADE', () => {
        socket.emit('TRADE_ERROR', { error: 'Use REST API for trades' });
    });
    socket.on('ADMIN_KICK_USER', (payload) => {
        if (socket.data.user.role !== 'admin')
            return;
        exports.io.to(payload.userId).emit('FORCE_LOGOUT', { reason: 'Kicked by admin' });
        exports.io.in(payload.userId)
            .fetchSockets()
            .then((sockets) => { for (const s of sockets)
            s.disconnect(true); })
            .catch((err) => console.error('[socket] kick error:', err.message));
    });
    socket.on('disconnect', (reason) => {
        console.log(`[socket] disconnected: ${socket.data.user.username} — ${reason}`);
    });
});
// ─── Internal broadcast endpoint (called by Next.js API routes) ───────────────
// This is how the server-side API routes push real-time events to clients
// without going through a socket connection themselves.
app.post('/internal/broadcast', (req, res) => {
    const { event, data } = req.body;
    exports.io.to('game').emit(event, data);
    console.log(`[broadcast] ${event}`, data);
    res.json({ ok: true });
});
app.post('/internal/broadcast-user', (req, res) => {
    const { userId, event, data } = req.body;
    exports.io.to(userId).emit(event, data);
    res.json({ ok: true });
});
// ─── Timer loop ───────────────────────────────────────────────────────────────
// Polls DB every second for active rounds and broadcasts TIMER_TICK
async function timerLoop() {
    try {
        // Find all events with an active round
        const { data: activeStates } = await exports.supabase
            .from('game_state')
            .select('event_id, timer_remaining, status')
            .eq('status', 'ROUND_ACTIVE');
        if (activeStates && activeStates.length > 0) {
            for (const state of activeStates) {
                const newRemaining = Math.max(0, state.timer_remaining - 1);
                // Update DB
                await exports.supabase
                    .from('game_state')
                    .update({ timer_remaining: newRemaining })
                    .eq('event_id', state.event_id);
                // Broadcast to participants
                exports.io.to('game').emit('TIMER_TICK', { remaining: newRemaining });
                // If timer expired, auto-end the round
                if (newRemaining === 0) {
                    console.log(`[timer] round expired for event ${state.event_id}`);
                    exports.io.to('game').emit('ROUND_END', { auto: true });
                    await exports.supabase
                        .from('game_state')
                        .update({ status: 'ROUND_END' })
                        .eq('event_id', state.event_id);
                }
            }
        }
    }
    catch (err) {
        console.error('[timer] error:', err);
    }
    setTimeout(() => void timerLoop(), 1000);
}
// ─── HTTP routes ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', connections: exports.io.engine.clientsCount });
});
// ─── Broadcast helpers ────────────────────────────────────────────────────────
function broadcastToGame(event, data) {
    exports.io.to('game').emit(event, data);
}
function broadcastToUser(userId, event, data) {
    exports.io.to(userId).emit(event, data);
}
// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`[socket] server running on port ${PORT}`);
    void timerLoop();
});

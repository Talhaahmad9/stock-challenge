export const EVENTS = {
  // Server → Client
  GAME_START:            'GAME_START',
  GAME_PAUSE:            'GAME_PAUSE',
  GAME_RESUME:           'GAME_RESUME',
  GAME_END:              'GAME_END',
  GAME_RESET:            'GAME_RESET',
  ROUND_START:           'ROUND_START',
  ROUND_END:             'ROUND_END',
  TIMER_TICK:            'TIMER_TICK',
  TRADE_EXECUTED:        'TRADE_EXECUTED',
  TRADE_LOG:             'TRADE_LOG',
  FORCE_LOGOUT:          'FORCE_LOGOUT',
  JOINED:                'JOINED',
  AUTH_ERROR:            'AUTH_ERROR',

  // Client → Server
  JOIN_GAME:             'JOIN_GAME',
  LEAVE_GAME:            'LEAVE_GAME',
  EXECUTE_TRADE:         'EXECUTE_TRADE',
  ADMIN_START_GAME:      'ADMIN_START_GAME',
  ADMIN_PAUSE_GAME:      'ADMIN_PAUSE_GAME',
  ADMIN_RESUME_GAME:     'ADMIN_RESUME_GAME',
  ADMIN_END_GAME:        'ADMIN_END_GAME',
  ADMIN_KICK_USER:       'ADMIN_KICK_USER',
  BROADCAST_ROUND_START: 'BROADCAST_ROUND_START',
  BROADCAST_ROUND_END:   'BROADCAST_ROUND_END',
  BROADCAST_TRADE:       'BROADCAST_TRADE',
} as const

export type EventName = typeof EVENTS[keyof typeof EVENTS]
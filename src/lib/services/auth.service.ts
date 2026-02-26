// lib/services/auth.service.ts
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createServiceClient } from '@/lib/supabase/server'
import type { AuthUser, UserRole } from '@/lib/supabase/database.types'

// Explicit row shapes — prevents TypeScript from losing inference
interface UserRow {
  id: string
  username: string
  password_hash: string
  role: UserRole
  is_active: boolean
}

interface SessionRow {
  id: string
  expires_at: string
}

const JWT_SECRET = process.env.JWT_SECRET!
const SESSION_DURATION_HOURS = 12

export interface LoginResult {
  success: boolean
  user?: AuthUser
  token?: string
  error?: string
}

export interface CreateUsersResult {
  created: Array<{ username: string; password: string }>
  errors: string[]
}

// ============================================
// LOGIN
// ============================================

export async function loginUser(
  username: string,
  password: string
): Promise<LoginResult> {
  const supabase = await createServiceClient()

  // 1. Find user
  const { data, error } = await supabase
    .from('users')
    .select('id, username, password_hash, role, is_active')
    .eq('username', username.toLowerCase().trim())
    .single()

  if (error || !data) {
    return { success: false, error: 'Invalid credentials' }
  }

  // Cast to known shape — Supabase loses column types on partial .select()
  const user = data as unknown as UserRow

  if (!user.is_active) {
    return { success: false, error: 'Account disabled' }
  }

  // 2. Verify password
  const passwordMatch = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatch) {
    return { success: false, error: 'Invalid credentials' }
  }

  // 3. Kill existing sessions (one device enforcement)
  await supabase
    .from('sessions')
    .delete()
    .eq('user_id', user.id)

  // 4. Create session token
  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: `${SESSION_DURATION_HOURS}h` }
  )

  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS)

  // 5. Persist session — use raw insert object to avoid Insert type mismatch
  await supabase.from('sessions').insert({
    user_id: user.id,
    token: token,
    expires_at: expiresAt.toISOString(),
  } as never)

  return {
    success: true,
    user: { id: user.id, username: user.username, role: user.role },
    token,
  }
}

// ============================================
// VERIFY SESSION
// ============================================

export async function verifySession(token: string): Promise<AuthUser | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string
      username: string
      role: UserRole
    }

    const supabase = await createServiceClient()
    const { data } = await supabase
      .from('sessions')
      .select('id, expires_at')
      .eq('token', token)
      .eq('user_id', payload.userId)
      .single()

    if (!data) return null

    const session = data as unknown as SessionRow
    if (new Date(session.expires_at) < new Date()) return null

    return { id: payload.userId, username: payload.username, role: payload.role }
  } catch {
    return null
  }
}

// ============================================
// LOGOUT
// ============================================

export async function logoutUser(token: string): Promise<void> {
  const supabase = await createServiceClient()
  await supabase.from('sessions').delete().eq('token', token)
}

// ============================================
// ADMIN: BULK CREATE PARTICIPANTS
// ============================================

export async function createParticipantUsers(
  count: number,
  prefix: string = 'player'
): Promise<CreateUsersResult> {
  const supabase = await createServiceClient()
  const created: Array<{ username: string; password: string }> = []
  const errors: string[] = []

  for (let i = 1; i <= count; i++) {
    const username = `${prefix}${String(i).padStart(2, '0')}`
    const password = generatePassword()
    const password_hash = await bcrypt.hash(password, 10)

    const { error } = await supabase.from('users').insert({
      username,
      password_hash,
      role: 'participant' as UserRole,
      is_active: true,
    } as never)

    if (error) {
      errors.push(`Failed to create ${username}: ${error.message}`)
    } else {
      created.push({ username, password })
    }
  }

  return { created, errors }
}

// ============================================
// ADMIN: RESET PASSWORD
// ============================================

export async function resetUserPassword(
  userId: string
): Promise<{ newPassword: string } | null> {
  const supabase = await createServiceClient()
  const newPassword = generatePassword()
  const password_hash = await bcrypt.hash(newPassword, 10)

  const { error } = await supabase
    .from('users')
    .update({ password_hash } as never)
    .eq('id', userId)

  if (error) return null

  await supabase.from('sessions').delete().eq('user_id', userId)
  return { newPassword }
}

// ============================================
// ADMIN: ENABLE / DISABLE USER
// ============================================

export async function setUserActive(
  userId: string,
  isActive: boolean
): Promise<boolean> {
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('users')
    .update({ is_active: isActive } as never)
    .eq('id', userId)

  if (!isActive) {
    await supabase.from('sessions').delete().eq('user_id', userId)
  }

  return !error
}

// ============================================
// HELPER
// ============================================

function generatePassword(): string {
  const words = ['alpha', 'beta', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india']
  const word = words[Math.floor(Math.random() * words.length)]
  const digits = Math.floor(100 + Math.random() * 900)
  return `${word}${digits}`
}
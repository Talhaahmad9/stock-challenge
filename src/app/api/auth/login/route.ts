import { NextRequest, NextResponse } from 'next/server'
import { loginUser } from '@/lib/services/auth.service'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password required' },
        { status: 400 }
      )
    }

    const result = await loginUser(username, password)

    if (!result.success || !result.token || !result.user) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }

    // Set httpOnly cookie — never accessible from JS (XSS protection)
    const cookieStore = await cookies()
    cookieStore.set('session_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 12, // 12 hours
      path: '/',
    })

    return NextResponse.json({
      user: result.user,
    })
  } catch (error) {
    console.error('[AUTH] Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
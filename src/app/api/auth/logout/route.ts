import { NextRequest, NextResponse } from 'next/server'
import { logoutUser } from '@/lib/services/auth.service'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session_token')?.value

    if (token) {
      await logoutUser(token)
    }

    // Clear the cookie
    cookieStore.set('session_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[AUTH] Logout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
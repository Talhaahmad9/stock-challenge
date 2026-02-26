import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/services/auth.service'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = await verifySession(token)

    if (!user) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('[AUTH] Me error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
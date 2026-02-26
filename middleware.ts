import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Routes that don't need protection
  const publicPaths = ['/login', '/api/auth/login']
  const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  // Check for our custom session token in cookie
  const token = request.cookies.get('session_token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
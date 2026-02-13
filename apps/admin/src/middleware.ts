import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/auth'

function buildLoginRedirect(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

function buildDashboardRedirect(request: NextRequest) {
  const url = request.nextUrl.clone()
  url.pathname = '/dashboard'
  url.search = ''
  return NextResponse.redirect(url)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  const session = await verifyAdminSessionToken(token)
  const isAuthenticated = Boolean(session)
  const isAuthApiRoute = pathname === '/api/auth/login' || pathname === '/api/auth/logout'
  const isApiRoute = pathname.startsWith('/api/')
  const protectedPageRoutes = ['/dashboard', '/users', '/jobs', '/subscriptions', '/referrals', '/analytics']
  const isProtectedPageRoute = protectedPageRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )

  if (pathname === '/') {
    return isAuthenticated ? buildDashboardRedirect(request) : buildLoginRedirect(request)
  }

  if (pathname === '/login') {
    return NextResponse.next()
  }

  if (isApiRoute) {
    if (isAuthApiRoute) return NextResponse.next()
    if (!isAuthenticated) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (isProtectedPageRoute && !isAuthenticated) {
    return buildLoginRedirect(request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

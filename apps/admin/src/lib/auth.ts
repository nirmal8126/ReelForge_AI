import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { NextRequest } from 'next/server'

export const ADMIN_SESSION_COOKIE = 'rf_admin_session'
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12

interface AdminSessionPayload extends JWTPayload {
  email: string
  role: 'ADMIN'
}

function getAdminSessionSecret(): Uint8Array {
  const secret =
    process.env.ADMIN_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.ADMIN_PASSWORD

  if (!secret) {
    throw new Error('Missing admin session secret configuration')
  }

  return new TextEncoder().encode(secret)
}

export async function createAdminSessionToken(email: string): Promise<string> {
  return new SignJWT({ email, role: 'ADMIN' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_TTL_SECONDS}s`)
    .sign(getAdminSessionSecret())
}

export async function verifyAdminSessionToken(token?: string | null): Promise<AdminSessionPayload | null> {
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getAdminSessionSecret(), {
      algorithms: ['HS256'],
    })

    if (payload.role !== 'ADMIN' || typeof payload.email !== 'string') {
      return null
    }

    return payload as AdminSessionPayload
  } catch {
    return null
  }
}

export async function getAdminSessionFromRequest(request: NextRequest): Promise<AdminSessionPayload | null> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  return verifyAdminSessionToken(token)
}

export function adminSessionCookieConfig(token: string) {
  return {
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  }
}

export function clearAdminSessionCookieConfig() {
  return {
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  }
}

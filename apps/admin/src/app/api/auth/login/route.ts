import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@reelforge/db'
import { adminSessionCookieConfig, createAdminSessionToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    const inputEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const inputPassword = typeof password === 'string' ? password : ''

    if (!inputEmail || !inputPassword) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      )
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
    const adminPassword = process.env.ADMIN_PASSWORD

    if (adminEmail && adminPassword && inputEmail === adminEmail && inputPassword === adminPassword) {
      const token = await createAdminSessionToken(inputEmail)
      const response = NextResponse.json({ success: true })
      response.cookies.set(adminSessionCookieConfig(token))
      return response
    }

    const adminUser = await prisma.user.findUnique({
      where: { email: inputEmail },
      select: { role: true, passwordHash: true },
    })

    if (adminUser?.role === 'ADMIN' && adminUser.passwordHash) {
      const isValid = await bcrypt.compare(inputPassword, adminUser.passwordHash)
      if (isValid) {
        const token = await createAdminSessionToken(inputEmail)
        const response = NextResponse.json({ success: true })
        response.cookies.set(adminSessionCookieConfig(token))
        return response
      }
    }

    return NextResponse.json(
      { message: 'Invalid credentials' },
      { status: 401 }
    )
  } catch {
    return NextResponse.json(
      { message: 'Invalid request body' },
      { status: 400 }
    )
  }
}

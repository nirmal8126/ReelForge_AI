import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@reelforge/db'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ deactivated: false })

    const user = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
      select: { isActive: true },
    })

    // Only return deactivated status — don't reveal if user exists for other cases
    if (user && !user.isActive) {
      return NextResponse.json({ deactivated: true })
    }

    return NextResponse.json({ deactivated: false })
  } catch {
    return NextResponse.json({ deactivated: false })
  }
}

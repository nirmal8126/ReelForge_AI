import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@reelforge/db'
import { z } from 'zod'
import { getAdminSessionFromRequest } from '@/lib/auth'

const grantSchema = z.object({
  userId: z.string(),
  amount: z.number().min(1).max(1000),
  reason: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { userId, amount, reason } = grantSchema.parse(body)

    const user = await prisma.user.update({
      where: { id: userId },
      data: { creditsBalance: { increment: amount } },
    })

    await prisma.creditTransaction.create({
      data: {
        userId,
        amount,
        type: 'ADMIN_GRANT',
        description: reason || `Admin granted ${amount} credits`,
        balanceAfter: user.creditsBalance,
      },
    })

    return NextResponse.json({ success: true, newBalance: user.creditsBalance })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@reelforge/db'
import { generateReferralCode } from '@/lib/utils'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  referralCode: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password, referralCode } = registerSchema.parse(body)

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Find referrer if code provided
    let referredByUserId: string | null = null
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
      })
      if (referrer) {
        referredByUserId = referrer.id
      }
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        referralCode: generateReferralCode(),
        referredByUserId,
      },
    })

    // Create free subscription
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: 'FREE',
        status: 'ACTIVE',
        jobsLimit: 3,
      },
    })

    // Process referral
    if (referredByUserId) {
      await prisma.referral.create({
        data: {
          referrerUserId: referredByUserId,
          referredUserId: user.id,
          referralCodeUsed: referralCode!,
          status: 'PENDING',
        },
      })

      // Award credits to referrer
      await prisma.user.update({
        where: { id: referredByUserId },
        data: {
          creditsBalance: { increment: 5 },
          totalReferrals: { increment: 1 },
        },
      })

      await prisma.creditTransaction.create({
        data: {
          userId: referredByUserId,
          amount: 5,
          type: 'REFERRAL_REWARD',
          description: `Referral reward for ${email}`,
          referenceId: user.id,
          balanceAfter: 0, // Will be computed
        },
      })
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

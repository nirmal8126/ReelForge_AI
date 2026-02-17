import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@reelforge/db'
import { generateReferralCode } from '@/lib/utils'
import { detectCountry } from '@/lib/geo'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email address').max(255),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100)
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  referralCode: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = registerSchema.parse(body)
    const name = parsed.name.trim()
    const email = parsed.email.trim().toLowerCase()
    const password = parsed.password
    const referralCode = parsed.referralCode?.trim()

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // Detect country from IP
    const country = await detectCountry(req)

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
        country,
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

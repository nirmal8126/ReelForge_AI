import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

const profileSchema = z.object({
  name: z.string().min(1).max(150),
  platform: z.enum(['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'MULTI']),
  niche: z.string().min(1).max(100),
  tone: z.enum(['PROFESSIONAL', 'CASUAL', 'ENERGETIC', 'CALM', 'HUMOROUS', 'INSPIRATIONAL']),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  hookStyle: z.string().optional(),
  musicPreference: z.string().optional(),
  defaultVoiceId: z.string().max(100).optional().nullable(),
  defaultLanguage: z.string().max(10).optional().nullable(),
})

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profiles = await prisma.channelProfile.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(profiles)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = profileSchema.parse(body)

    // Check profile limits based on plan
    const profileCount = await prisma.channelProfile.count({
      where: { userId: session.user.id },
    })

    const planLimits: Record<string, number> = {
      FREE: 0,
      STARTER: 1,
      PRO: 5,
      BUSINESS: -1,
      ENTERPRISE: -1,
    }

    const limit = planLimits[session.user.plan] ?? 0
    if (limit !== -1 && profileCount >= limit) {
      return NextResponse.json(
        { error: `Your ${session.user.plan} plan allows ${limit} channel profile(s). Upgrade to create more.` },
        { status: 403 }
      )
    }

    const isFirst = profileCount === 0

    const profile = await prisma.channelProfile.create({
      data: {
        userId: session.user.id,
        name: data.name,
        platform: data.platform,
        niche: data.niche,
        tone: data.tone,
        primaryColor: data.primaryColor,
        hookStyle: data.hookStyle,
        musicPreference: data.musicPreference,
        defaultVoiceId: data.defaultVoiceId || null,
        defaultLanguage: data.defaultLanguage || null,
        isDefault: isFirst,
      },
    })

    return NextResponse.json(profile, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Profile creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

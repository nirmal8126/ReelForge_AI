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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.channelProfile.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
    },
  })

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json(profile)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const data = profileSchema.parse(body)

    // Verify ownership
    const existing = await prisma.channelProfile.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const profile = await prisma.channelProfile.update({
      where: { id: params.id },
      data: {
        name: data.name,
        platform: data.platform,
        niche: data.niche,
        tone: data.tone,
        primaryColor: data.primaryColor,
        hookStyle: data.hookStyle,
        musicPreference: data.musicPreference,
        defaultVoiceId: data.defaultVoiceId || null,
        defaultLanguage: data.defaultLanguage || null,
      },
    })

    return NextResponse.json(profile)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const existing = await prisma.channelProfile.findFirst({
    where: {
      id: params.id,
      userId: session.user.id,
    },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Check if profile is used by any reels
  const reelsCount = await prisma.reelJob.count({
    where: { channelProfileId: params.id },
  })

  if (reelsCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete profile. It's used by ${reelsCount} reel(s).` },
      { status: 400 }
    )
  }

  await prisma.channelProfile.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ success: true })
}

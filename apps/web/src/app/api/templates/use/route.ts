import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'
import { checkModuleCredits } from '@/lib/module-config'
import {
  getReelCreditCost,
  getLongFormCreditCost,
  getQuoteCreditCost,
  getChallengeCreditCost,
  getGameplayCreditCost,
} from '@/lib/credit-cost'
import {
  enqueueReelJob,
  enqueueLongFormJob,
  enqueueQuoteJob,
  enqueueChallengeJob,
  enqueueGameplayJob,
} from '@/lib/queue'

const useTemplateSchema = z.object({
  templateId: z.string().min(1),
  topic: z.string().min(3).max(5000),
  channelProfileId: z.string().optional(),
  overrides: z.record(z.unknown()).optional(), // Override any default setting
})

// Module ID mapping for credit checks
const MODULE_IDS: Record<string, string> = {
  REEL: 'reels',
  LONG_FORM: 'long_form',
  QUOTE: 'quotes',
  CHALLENGE: 'challenges',
  GAMEPLAY: 'gameplay',
  IMAGE_STUDIO: 'image_studio',
  CARTOON: 'cartoon_studio',
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = useTemplateSchema.parse(body)

    // Fetch template
    const template = await prisma.contentTemplate.findFirst({
      where: {
        id: data.templateId,
        OR: [
          { isSystem: true, isPublic: true },
          { userId: session.user.id },
        ],
      },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Merge template defaults with user overrides
    const settings = {
      ...(template.defaultSettings as Record<string, unknown>),
      ...(data.overrides || {}),
    }

    // Replace {{topic}} in prompt template
    const prompt = template.promptTemplate.replace(/\{\{topic\}\}/g, data.topic)

    // Get module ID for credit check
    const moduleId = MODULE_IDS[template.moduleType]
    if (!moduleId) {
      return NextResponse.json({ error: 'Unsupported module type' }, { status: 400 })
    }

    // Calculate credit cost based on module type
    let creditCost = 1
    switch (template.moduleType) {
      case 'REEL':
        creditCost = getReelCreditCost((settings.durationSeconds as number) || 30)
        break
      case 'LONG_FORM':
        creditCost = getLongFormCreditCost((settings.durationMinutes as number) || 10)
        break
      case 'QUOTE':
        creditCost = getQuoteCreditCost()
        break
      case 'CHALLENGE':
        creditCost = getChallengeCreditCost(
          (settings.numQuestions as number) || 3,
          (settings.voiceEnabled as boolean) || false
        )
        break
      case 'GAMEPLAY':
        creditCost = getGameplayCreditCost((settings.duration as number) || 30)
        break
    }

    // Check credits
    const creditCheck = await checkModuleCredits(session.user.id, moduleId, creditCost)
    if (!creditCheck.ok) {
      return NextResponse.json({ error: creditCheck.error }, { status: creditCheck.status })
    }

    const plan = creditCheck.subscription.plan
    let jobId: string
    let jobType: string

    // Create job based on module type
    switch (template.moduleType) {
      case 'REEL': {
        const reelJob = await prisma.reelJob.create({
          data: {
            userId: session.user.id,
            channelProfileId: data.channelProfileId || null,
            title: data.topic.slice(0, 80),
            prompt,
            style: (settings.style as string) || null,
            language: (settings.language as string) || 'hi',
            voiceId: (settings.voiceId as string) || null,
            durationSeconds: (settings.durationSeconds as number) || 30,
            aspectRatio: (settings.aspectRatio as string) || '9:16',
            status: 'QUEUED',
            creditsCost: creditCheck.creditsCost,
          },
        })
        await enqueueReelJob({
          reelJobId: reelJob.id,
          userId: session.user.id,
          prompt,
          style: settings.style as string,
          language: (settings.language as string) || 'hi',
          voiceId: settings.voiceId as string,
          durationSeconds: (settings.durationSeconds as number) || 30,
          aspectRatio: (settings.aspectRatio as string) || '9:16',
          channelProfileId: data.channelProfileId,
          plan,
        })
        jobId = reelJob.id
        jobType = 'reel'
        break
      }

      case 'LONG_FORM': {
        const longFormJob = await prisma.longFormJob.create({
          data: {
            userId: session.user.id,
            channelProfileId: data.channelProfileId || null,
            title: data.topic.slice(0, 80),
            prompt,
            durationMinutes: (settings.durationMinutes as number) || 10,
            style: (settings.style as string) || null,
            language: (settings.language as string) || 'hi',
            voiceId: (settings.voiceId as string) || null,
            aspectRatio: (settings.aspectRatio as string) || '16:9',
            aiClipRatio: (settings.aiClipRatio as number) || 0.3,
            useStockFootage: (settings.useStockFootage as boolean) ?? true,
            useStaticVisuals: (settings.useStaticVisuals as boolean) ?? true,
            publishToYouTube: false,
            status: 'QUEUED',
            creditsCost: creditCheck.creditsCost,
          },
        })
        await enqueueLongFormJob({
          longFormJobId: longFormJob.id,
          userId: session.user.id,
          prompt,
          title: data.topic.slice(0, 80),
          durationMinutes: (settings.durationMinutes as number) || 10,
          style: settings.style as string,
          language: (settings.language as string) || 'hi',
          voiceId: settings.voiceId as string,
          aspectRatio: (settings.aspectRatio as string) || '16:9',
          aiClipRatio: (settings.aiClipRatio as number) || 0.3,
          useStockFootage: (settings.useStockFootage as boolean) ?? true,
          useStaticVisuals: (settings.useStaticVisuals as boolean) ?? true,
          publishToYouTube: false,
          channelProfileId: data.channelProfileId,
          plan,
        })
        jobId = longFormJob.id
        jobType = 'long_form'
        break
      }

      case 'QUOTE': {
        const quoteJob = await prisma.quoteJob.create({
          data: {
            userId: session.user.id,
            prompt,
            category: (settings.category as string) || 'motivational',
            language: (settings.language as string) || 'hi',
            status: 'QUEUED',
            creditsCost: creditCheck.creditsCost,
          },
        })
        await enqueueQuoteJob({
          quoteJobId: quoteJob.id,
          userId: session.user.id,
          prompt,
          category: (settings.category as string) || 'motivational',
          language: (settings.language as string) || 'hi',
          quoteLength: (settings.quoteLength as string) || 'medium',
          plan,
        })
        jobId = quoteJob.id
        jobType = 'quote'
        break
      }

      case 'CHALLENGE': {
        const challengeJob = await prisma.challengeJob.create({
          data: {
            userId: session.user.id,
            challengeType: (settings.challengeType as string) || 'gk_quiz',
            category: (settings.category as string) || 'general',
            difficulty: (settings.difficulty as string) || 'medium',
            numQuestions: (settings.numQuestions as number) || 3,
            timerSeconds: (settings.timerSeconds as number) || 5,
            language: (settings.language as string) || 'hi',
            prompt: prompt || null,
            templateStyle: (settings.templateStyle as string) || 'neon',
            voiceEnabled: (settings.voiceEnabled as boolean) || false,
            voiceId: (settings.voiceId as string) || null,
            status: 'QUEUED',
            creditsCost: creditCheck.creditsCost,
          },
        })
        await enqueueChallengeJob({
          challengeJobId: challengeJob.id,
          userId: session.user.id,
          challengeType: (settings.challengeType as string) || 'gk_quiz',
          category: (settings.category as string) || 'general',
          difficulty: (settings.difficulty as string) || 'medium',
          numQuestions: (settings.numQuestions as number) || 3,
          timerSeconds: (settings.timerSeconds as number) || 5,
          language: (settings.language as string) || 'hi',
          prompt,
          templateStyle: (settings.templateStyle as string) || 'neon',
          voiceEnabled: (settings.voiceEnabled as boolean) || false,
          voiceId: settings.voiceId as string,
          plan,
        })
        jobId = challengeJob.id
        jobType = 'challenge'
        break
      }

      case 'GAMEPLAY': {
        const duration = (settings.duration as number) || 30
        const gameplayJob = await prisma.gameplayJob.create({
          data: {
            userId: session.user.id,
            template: ((settings.template as string) || 'ENDLESS_RUNNER') as 'ENDLESS_RUNNER' | 'BALL_MAZE' | 'OBSTACLE_TOWER' | 'COLOR_SWITCH',
            theme: (settings.theme as string) || 'neon',
            difficulty: (settings.difficulty as string) || 'medium',
            duration,
            aspectRatio: (settings.aspectRatio as string) || '9:16',
            musicStyle: (settings.musicStyle as string) || 'upbeat',
            gameTitle: (settings.gameTitle as string) || null,
            showScore: (settings.showScore as boolean) ?? true,
            ctaText: (settings.ctaText as string) || null,
            status: 'QUEUED',
            creditsCost: creditCheck.creditsCost,
          },
        })
        await enqueueGameplayJob({
          gameplayJobId: gameplayJob.id,
          userId: session.user.id,
          template: (settings.template as string) || 'ENDLESS_RUNNER',
          theme: (settings.theme as string) || 'neon',
          difficulty: (settings.difficulty as string) || 'medium',
          duration,
          aspectRatio: (settings.aspectRatio as string) || '9:16',
          musicStyle: (settings.musicStyle as string) || 'upbeat',
          gameTitle: settings.gameTitle as string,
          showScore: (settings.showScore as boolean) ?? true,
          ctaText: settings.ctaText as string,
          plan,
        })
        jobId = gameplayJob.id
        jobType = 'gameplay'
        break
      }

      default:
        return NextResponse.json({ error: `Module type ${template.moduleType} not yet supported for templates` }, { status: 400 })
    }

    // Increment use count
    await prisma.contentTemplate.update({
      where: { id: template.id },
      data: { useCount: { increment: 1 } },
    })

    return NextResponse.json({
      jobId,
      jobType,
      templateName: template.name,
      message: `Job created from "${template.name}" template`,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('POST /api/templates/use error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

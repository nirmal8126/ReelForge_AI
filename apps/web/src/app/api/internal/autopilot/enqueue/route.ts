import { NextRequest, NextResponse } from 'next/server'
import {
  enqueueReelJob,
  enqueueLongFormJob,
  enqueueQuoteJob,
  enqueueChallengeJob,
  enqueueGameplayJob,
  enqueueCartoonEpisode,
} from '@/lib/queue'

export async function POST(req: NextRequest) {
  // Verify worker secret
  const workerSecret = req.headers.get('x-worker-secret')
  if (!workerSecret || workerSecret !== process.env.WORKER_CALLBACK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { moduleType, jobId, userId, plan, scheduleData } = body

  try {
    let queueJobId: string | undefined

    switch (moduleType) {
      case 'REEL':
        queueJobId = await enqueueReelJob({
          reelJobId: jobId,
          userId,
          prompt: scheduleData.prompt,
          style: scheduleData.style,
          language: scheduleData.language,
          voiceId: scheduleData.voiceId,
          durationSeconds: scheduleData.durationSeconds,
          aspectRatio: scheduleData.aspectRatio,
          channelProfileId: scheduleData.channelProfileId,
          plan,
        })
        break

      case 'LONG_FORM':
        queueJobId = await enqueueLongFormJob({
          longFormJobId: jobId,
          userId,
          prompt: scheduleData.prompt,
          title: scheduleData.title,
          durationMinutes: scheduleData.durationMinutes,
          style: scheduleData.style,
          language: scheduleData.language,
          voiceId: scheduleData.voiceId,
          aspectRatio: scheduleData.aspectRatio,
          aiClipRatio: scheduleData.aiClipRatio,
          useStockFootage: scheduleData.useStockFootage,
          useStaticVisuals: scheduleData.useStaticVisuals,
          publishToYouTube: scheduleData.publishToYouTube || false,
          channelProfileId: scheduleData.channelProfileId,
          plan,
        })
        break

      case 'QUOTE':
        queueJobId = await enqueueQuoteJob({
          quoteJobId: jobId,
          userId,
          prompt: scheduleData.prompt,
          category: scheduleData.category,
          language: scheduleData.language,
          quoteLength: scheduleData.quoteLength,
          plan,
        })
        break

      case 'CHALLENGE':
        queueJobId = await enqueueChallengeJob({
          challengeJobId: jobId,
          userId,
          challengeType: scheduleData.challengeType,
          category: scheduleData.category,
          difficulty: scheduleData.difficulty,
          numQuestions: scheduleData.numQuestions,
          timerSeconds: scheduleData.timerSeconds,
          language: scheduleData.language,
          prompt: scheduleData.prompt,
          templateStyle: scheduleData.templateStyle,
          voiceEnabled: scheduleData.voiceEnabled,
          voiceId: scheduleData.voiceId,
          plan,
        })
        break

      case 'GAMEPLAY':
        queueJobId = await enqueueGameplayJob({
          gameplayJobId: jobId,
          userId,
          template: scheduleData.template,
          theme: scheduleData.theme,
          difficulty: scheduleData.difficulty,
          duration: scheduleData.duration,
          aspectRatio: scheduleData.aspectRatio,
          musicStyle: scheduleData.musicStyle,
          gameTitle: scheduleData.gameTitle,
          showScore: scheduleData.showScore,
          ctaText: scheduleData.ctaText,
          plan,
        })
        break

      case 'CARTOON':
        queueJobId = await enqueueCartoonEpisode({
          episodeId: scheduleData.episodeId,
          seriesId: scheduleData.seriesId,
          userId,
          prompt: scheduleData.prompt,
          title: scheduleData.title,
          language: scheduleData.language,
          aspectRatio: scheduleData.aspectRatio,
          narratorVoiceId: scheduleData.narratorVoiceId,
          plan,
        })
        break

      default:
        return NextResponse.json({ error: `Unsupported module: ${moduleType}` }, { status: 400 })
    }

    return NextResponse.json({ queueJobId })
  } catch (error) {
    console.error('Autopilot enqueue error:', error)
    return NextResponse.json({ error: 'Failed to enqueue job' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'
import { publishToPlatform } from '@/lib/social-publish'

// ---------------------------------------------------------------------------
// Valid job types (mapped to Prisma model names)
// ---------------------------------------------------------------------------

const JOB_TYPE_MODELS: Record<string, string> = {
  reel: 'reelJob',
  quote: 'quoteJob',
  challenge: 'challengeJob',
  gameplay: 'gameplayJob',
  long_form: 'longFormJob',
  cartoon: 'cartoonEpisode',
  image_studio: 'imageStudioJob',
}

// ---------------------------------------------------------------------------
// POST /api/publish — publish content to social media
// ---------------------------------------------------------------------------

const publishSchema = z.object({
  jobType: z.string().min(1),
  jobId: z.string().min(1),
  accountIds: z.array(z.string().min(1)).min(1),
  formats: z.record(z.string(), z.string()).optional(),
  title: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  textContent: z.string().max(5000).optional(), // For text-only content (e.g. quotes)
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const data = publishSchema.parse(body)

  // Validate job type
  const modelName = JOB_TYPE_MODELS[data.jobType]
  if (!modelName) {
    return NextResponse.json({ error: 'Invalid job type' }, { status: 400 })
  }

  // QuoteJob uses different field names (imageUrl/videoUrl instead of outputUrl)
  const isQuote = modelName === 'quoteJob'
  const selectFields = isQuote
    ? { id: true, status: true, imageUrl: true, videoUrl: true, quoteText: true, thumbnailUrl: true }
    : { id: true, status: true, outputUrl: true, title: true, thumbnailUrl: true }

  // Verify user owns the job and it's completed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const job = await (prisma as any)[modelName].findFirst({
    where: {
      id: data.jobId,
      userId: session.user.id,
    },
    select: selectFields,
  })

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (job.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'Job is not completed yet' }, { status: 400 })
  }

  // Resolve the media URL and determine content type
  const mediaUrl: string = job.outputUrl || job.videoUrl || job.imageUrl || ''
  const jobTitle: string = job.title || job.quoteText || ''
  const isImage = isQuote && !!job.imageUrl && !job.videoUrl
  const isTextOnly = !mediaUrl && !!data.textContent

  if (!mediaUrl && !isTextOnly) {
    return NextResponse.json({ error: 'Job has no output file' }, { status: 400 })
  }

  // Verify all accounts belong to user and are active
  const accounts = await prisma.socialAccount.findMany({
    where: {
      id: { in: data.accountIds },
      userId: session.user.id,
      isActive: true,
    },
  })

  if (accounts.length !== data.accountIds.length) {
    return NextResponse.json({ error: 'One or more accounts are invalid or inactive' }, { status: 400 })
  }

  // Create publish records (PENDING) for each selected account
  const records = await Promise.all(
    accounts.map((account) =>
      prisma.publishRecord.create({
        data: {
          userId: session.user.id,
          socialAccountId: account.id,
          jobType: data.jobType,
          jobId: data.jobId,
          title: data.title || jobTitle || null,
          description: data.description || null,
          status: 'PENDING',
        },
        include: {
          socialAccount: {
            select: {
              platform: true,
              accountName: true,
            },
          },
        },
      })
    )
  )

  // Upload to each platform (in parallel)
  await Promise.all(
    records.map(async (record) => {
      const account = accounts.find((a) => a.id === record.socialAccountId)!
      const format = data.formats?.[account.id]

      // Mark as uploading
      await prisma.publishRecord.update({
        where: { id: record.id },
        data: { status: 'UPLOADING' },
      })

      try {
        const result = await publishToPlatform(account.platform, {
          accessToken: account.accessToken,
          accountId: account.accountId,
          videoUrl: mediaUrl,
          title: data.title || jobTitle || 'Untitled',
          description: data.description,
          format,
          isImage,
          textContent: data.textContent,
        })

        await prisma.publishRecord.update({
          where: { id: record.id },
          data: result.success
            ? {
                status: 'PUBLISHED',
                publishedAt: new Date(),
                platformPostId: result.platformPostId || null,
                platformUrl: result.platformUrl || null,
              }
            : {
                status: 'FAILED',
                errorMessage: result.errorMessage || 'Unknown error',
              },
        })
      } catch (err) {
        await prisma.publishRecord.update({
          where: { id: record.id },
          data: {
            status: 'FAILED',
            errorMessage: err instanceof Error ? err.message : 'Unexpected error',
          },
        })
      }
    })
  )

  // Refetch updated records
  const updatedRecords = await prisma.publishRecord.findMany({
    where: { id: { in: records.map((r) => r.id) } },
    include: {
      socialAccount: {
        select: {
          platform: true,
          accountName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ records: updatedRecords })
}

// ---------------------------------------------------------------------------
// GET /api/publish — list user's publish history
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const jobType = searchParams.get('jobType')
  const jobId = searchParams.get('jobId')
  const limit = parseInt(searchParams.get('limit') || '20')

  const where: Record<string, unknown> = { userId: session.user.id }
  if (jobType) where.jobType = jobType
  if (jobId) where.jobId = jobId

  const records = await prisma.publishRecord.findMany({
    where,
    include: {
      socialAccount: {
        select: {
          platform: true,
          accountName: true,
          accountAvatar: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  })

  return NextResponse.json({ records })
}

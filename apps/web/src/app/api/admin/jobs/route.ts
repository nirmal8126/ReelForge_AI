import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (!user || user.role !== 'ADMIN') {
    return { error: 'Forbidden — Super Admin access required', status: 403 }
  }

  return { userId: session.user.id }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/jobs — delete a job by type and id
// ---------------------------------------------------------------------------

const deleteJobSchema = z.object({
  jobType: z.enum(['reel', 'quote', 'challenge', 'longForm', 'cartoonSeries', 'imageStudio']),
  jobId: z.string().min(1),
})

export async function DELETE(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await req.json()
  const data = deleteJobSchema.parse(body)

  switch (data.jobType) {
    case 'reel':
      await prisma.reelJob.delete({ where: { id: data.jobId } })
      break
    case 'quote':
      await prisma.quoteJob.delete({ where: { id: data.jobId } })
      break
    case 'challenge':
      await prisma.challengeJob.delete({ where: { id: data.jobId } })
      break
    case 'longForm':
      await prisma.longFormJob.delete({ where: { id: data.jobId } })
      break
    case 'cartoonSeries':
      await prisma.cartoonSeries.delete({ where: { id: data.jobId } })
      break
    case 'imageStudio':
      await prisma.imageStudioJob.delete({ where: { id: data.jobId } })
      break
  }

  return NextResponse.json({ deleted: true, jobType: data.jobType, jobId: data.jobId })
}

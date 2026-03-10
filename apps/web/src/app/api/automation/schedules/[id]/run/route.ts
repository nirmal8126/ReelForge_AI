import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

// ---------------------------------------------------------------------------
// POST /api/automation/schedules/:id/run — trigger an immediate run
// Sets nextRunAt to now so the scheduler picks it up on next tick
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const schedule = await prisma.autopilotSchedule.findFirst({
    where: { id, userId: session.user.id },
  })

  if (!schedule) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }

  // Set nextRunAt to now and ensure it's active — scheduler will pick it up
  await prisma.autopilotSchedule.update({
    where: { id },
    data: {
      nextRunAt: new Date(),
      isActive: true,
    },
  })

  return NextResponse.json({ success: true, message: 'Schedule will run on next scheduler tick (up to 5 minutes)' })
}

import { NextResponse } from 'next/server'
import { prisma } from '@reelforge/db'

export async function GET() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    totalUsers,
    totalJobs,
    completedJobs,
    jobsToday,
    starterSubs,
    proSubs,
    businessSubs,
    recentUsers,
    recentJobs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.reelJob.count(),
    prisma.reelJob.count({ where: { status: 'COMPLETED' } }),
    prisma.reelJob.count({ where: { createdAt: { gte: today } } }),
    prisma.subscription.count({ where: { plan: 'STARTER', status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { plan: 'PRO', status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { plan: 'BUSINESS', status: 'ACTIVE' } }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, name: true, email: true, createdAt: true } }),
    prisma.reelJob.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { name: true } } } }),
  ])

  const mrr = (starterSubs * 19) + (proSubs * 49) + (businessSubs * 99)
  const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0

  return NextResponse.json({
    kpis: { totalUsers, mrr, jobsToday, successRate, totalJobs },
    recentUsers,
    recentJobs,
  })
}

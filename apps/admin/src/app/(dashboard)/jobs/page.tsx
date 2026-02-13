import { prisma, ReelJobStatus } from '@reelforge/db'
import { format } from 'date-fns'
import { Search, Film, Filter } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface JobsPageProps {
  searchParams: { status?: string; q?: string }
}

const statusColors: Record<string, string> = {
  QUEUED: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  PROCESSING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  SCRIPT_GENERATING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  VOICE_GENERATING: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  VIDEO_GENERATING: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  COMPOSING: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  UPLOADING: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const allStatuses: ReelJobStatus[] = [
  'QUEUED',
  'PROCESSING',
  'SCRIPT_GENERATING',
  'VOICE_GENERATING',
  'VIDEO_GENERATING',
  'COMPOSING',
  'UPLOADING',
  'COMPLETED',
  'FAILED',
]

export default async function AdminJobsPage({ searchParams }: JobsPageProps) {
  const statusFilter = searchParams.status as ReelJobStatus | undefined
  const search = searchParams.q || ''

  const where: any = {}
  if (statusFilter && allStatuses.includes(statusFilter)) {
    where.status = statusFilter
  }
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { user: { name: { contains: search } } },
      { user: { email: { contains: search } } },
    ]
  }

  const jobs = await prisma.reelJob.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  function formatProcessingTime(ms: number | null): string {
    if (!ms) return '--'
    if (ms < 1000) return `${ms}ms`
    const seconds = Math.round(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Jobs</h1>
          <p className="text-gray-400 mt-1">
            {jobs.length.toLocaleString()} jobs
            {statusFilter ? ` with status ${statusFilter}` : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <form method="GET" className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="Search jobs..."
            className="pl-10 pr-4 py-2 bg-gray-900/60 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-colors text-sm w-64"
          />
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        </form>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500 mr-1" />
          <Link
            href="/jobs"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !statusFilter
                ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            All
          </Link>
          {allStatuses.map((status) => (
            <Link
              key={status}
              href={`/jobs?status=${status}${search ? `&q=${search}` : ''}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {status.replace(/_/g, ' ')}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900/60 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  ID
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Title
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  User
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Duration
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  AI Provider
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Processing
                </th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <span className="text-xs text-gray-500 font-mono">
                      {job.id.slice(0, 8)}...
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium text-white truncate max-w-[200px] block">
                      {job.title}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-sm text-gray-300">{job.user.name}</p>
                      <p className="text-xs text-gray-500">{job.user.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        statusColors[job.status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}
                    >
                      {job.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-300">
                      {formatDuration(job.durationSeconds)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-300">
                      {job.aiProvider || '--'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-300">
                      {formatProcessingTime(job.processingTimeMs)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-500">
                      {format(new Date(job.createdAt), 'MMM d, HH:mm')}
                    </span>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <Film className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      {statusFilter
                        ? `No jobs with status "${statusFilter}"`
                        : search
                        ? `No jobs matching "${search}"`
                        : 'No jobs found'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

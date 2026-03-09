'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Zap,
  Plus,
  Loader2,
  Play,
  Pause,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Film,
  Video,
  Quote,
  Gamepad2,
  Joystick,
  ImageIcon,
  Clapperboard,
  Calendar,
  Globe,
  ChevronDown,
  ChevronUp,
  Send,
  RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Schedule {
  id: string
  name: string
  moduleType: string
  isActive: boolean
  frequency: string
  scheduledTime: string
  timezone: string
  language: string
  autoPublish: boolean
  requireApproval: boolean
  publishDelay: number
  customTopics: string[] | null
  totalGenerated: number
  totalPublished: number
  totalFailed: number
  lastRunAt: string | null
  nextRunAt: string | null
  channelProfile: { id: string; name: string } | null
  publishTargets: Array<{ socialAccountId: string; format?: string }> | null
  _count: { logs: number }
  createdAt: string
}

interface AutopilotLog {
  id: string
  moduleType: string
  jobId: string
  status: string
  topic: string | null
  publishStatus: string
  errorMessage: string | null
  publishedAt: string | null
  requiresApproval: boolean
  createdAt: string
  autopilotSchedule: { id: string; name: string; moduleType: string }
}

interface SocialAccount {
  id: string
  platform: string
  accountName: string
}

interface ChannelProfile {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODULE_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  REEL: { label: 'Reels', icon: Film },
  LONG_FORM: { label: 'Long-Form', icon: Video },
  QUOTE: { label: 'Quotes', icon: Quote },
  CHALLENGE: { label: 'Challenges', icon: Gamepad2 },
  GAMEPLAY: { label: '3D Gameplay', icon: Joystick },
  IMAGE_STUDIO: { label: 'Image Studio', icon: ImageIcon },
  CARTOON: { label: 'Cartoon', icon: Clapperboard },
}

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 Weeks',
  MONTHLY: 'Monthly',
  CUSTOM: 'Custom',
}

const PUBLISH_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'text-gray-400' },
  AWAITING_APPROVAL: { label: 'Awaiting Approval', color: 'text-yellow-400' },
  SCHEDULED: { label: 'Scheduled', color: 'text-blue-400' },
  PUBLISHING: { label: 'Publishing...', color: 'text-brand-400' },
  PUBLISHED: { label: 'Published', color: 'text-green-400' },
  FAILED: { label: 'Failed', color: 'text-red-400' },
  SKIPPED: { label: 'Skipped', color: 'text-gray-500' },
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function AutomationPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'schedules' | 'logs' | 'create'>('schedules')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [logs, setLogs] = useState<AutopilotLog[]>([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [channelProfiles, setChannelProfiles] = useState<ChannelProfile[]>([])
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null)

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/automation/schedules')
      const data = await res.json()
      setSchedules(data.schedules || [])
    } catch {
      toast.error('Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await fetch('/api/automation/logs?limit=30')
      const data = await res.json()
      setLogs(data.logs || [])
    } catch {
      toast.error('Failed to load logs')
    } finally {
      setLogsLoading(false)
    }
  }, [])

  // Fetch social accounts & channel profiles (for create form)
  const fetchFormData = useCallback(async () => {
    const [accountsRes, profilesRes] = await Promise.all([
      fetch('/api/social-accounts').catch(() => null),
      fetch('/api/profiles').catch(() => null),
    ])
    if (accountsRes?.ok) {
      const data = await accountsRes.json()
      setSocialAccounts(data.accounts || [])
    }
    if (profilesRes?.ok) {
      const data = await profilesRes.json()
      setChannelProfiles(data.profiles || [])
    }
  }, [])

  useEffect(() => {
    fetchSchedules()
    fetchFormData()
  }, [fetchSchedules, fetchFormData])

  useEffect(() => {
    if (tab === 'logs') fetchLogs()
  }, [tab, fetchLogs])

  // Toggle schedule active/inactive
  const toggleSchedule = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/automation/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
      if (!res.ok) throw new Error()
      toast.success(isActive ? 'Schedule paused' : 'Schedule activated')
      fetchSchedules()
    } catch {
      toast.error('Failed to update schedule')
    }
  }

  // Delete schedule
  const deleteSchedule = async (id: string) => {
    if (!confirm('Delete this automation schedule? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/automation/schedules/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Schedule deleted')
      fetchSchedules()
    } catch {
      toast.error('Failed to delete schedule')
    }
  }

  // Approve/reject a log
  const handleLogAction = async (logId: string, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/automation/logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, action }),
      })
      if (!res.ok) throw new Error()
      toast.success(action === 'approve' ? 'Approved for publishing' : 'Publishing skipped')
      fetchLogs()
    } catch {
      toast.error('Failed to update')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
            <Zap className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Automation</h1>
            <p className="text-sm text-gray-400">Schedule jobs to generate & publish automatically</p>
          </div>
        </div>
        <button
          onClick={() => setTab('create')}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Schedule
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-white/[0.03] p-1">
        {(['schedules', 'logs', 'create'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'bg-white/[0.08] text-white'
                : 'text-gray-400 hover:text-gray-200'
            )}
          >
            {t === 'schedules' ? 'Schedules' : t === 'logs' ? 'Activity Log' : 'Create New'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'schedules' && (
        <SchedulesList
          schedules={schedules}
          loading={loading}
          expandedSchedule={expandedSchedule}
          onToggleExpand={(id) => setExpandedSchedule(expandedSchedule === id ? null : id)}
          onToggle={toggleSchedule}
          onDelete={deleteSchedule}
        />
      )}

      {tab === 'logs' && (
        <LogsList
          logs={logs}
          loading={logsLoading}
          onAction={handleLogAction}
          onRefresh={fetchLogs}
        />
      )}

      {tab === 'create' && (
        <CreateScheduleForm
          socialAccounts={socialAccounts}
          channelProfiles={channelProfiles}
          onCreated={() => {
            setTab('schedules')
            fetchSchedules()
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schedules List Component
// ---------------------------------------------------------------------------

function SchedulesList({
  schedules,
  loading,
  expandedSchedule,
  onToggleExpand,
  onToggle,
  onDelete,
}: {
  schedules: Schedule[]
  loading: boolean
  expandedSchedule: string | null
  onToggleExpand: (id: string) => void
  onToggle: (id: string, isActive: boolean) => void
  onDelete: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    )
  }

  if (schedules.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
        <Zap className="mx-auto h-12 w-12 text-gray-600" />
        <h3 className="mt-4 text-lg font-medium text-white">No automation schedules yet</h3>
        <p className="mt-2 text-sm text-gray-400">Create your first schedule to start generating content automatically.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {schedules.map((schedule) => {
        const module = MODULE_LABELS[schedule.moduleType] || { label: schedule.moduleType, icon: Zap }
        const ModuleIcon = module.icon
        const isExpanded = expandedSchedule === schedule.id

        return (
          <div key={schedule.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            {/* Main Row */}
            <div className="flex items-center gap-4 p-4">
              {/* Module Icon */}
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                schedule.isActive ? 'bg-brand-500/10' : 'bg-white/[0.04]'
              )}>
                <ModuleIcon className={cn('h-5 w-5', schedule.isActive ? 'text-brand-400' : 'text-gray-500')} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-white truncate">{schedule.name}</h3>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-medium',
                    schedule.isActive
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-gray-500/10 text-gray-500'
                  )}>
                    {schedule.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  <span>{module.label}</span>
                  <span>·</span>
                  <span>{FREQUENCY_LABELS[schedule.frequency] || schedule.frequency}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {schedule.scheduledTime} {schedule.timezone}
                  </span>
                  {schedule.autoPublish && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-brand-400">
                        <Send className="h-3 w-3" />
                        Auto-Publish
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="hidden md:flex items-center gap-4 text-xs">
                <div className="text-center">
                  <p className="text-gray-500">Generated</p>
                  <p className="text-white font-medium">{schedule.totalGenerated}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500">Published</p>
                  <p className="text-green-400 font-medium">{schedule.totalPublished}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500">Failed</p>
                  <p className="text-red-400 font-medium">{schedule.totalFailed}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onToggle(schedule.id, schedule.isActive)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-white/[0.06] hover:text-white transition-colors"
                  title={schedule.isActive ? 'Pause' : 'Activate'}
                >
                  {schedule.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => onDelete(schedule.id)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onToggleExpand(schedule.id)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="border-t border-white/[0.06] bg-white/[0.01] p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <p className="text-gray-500 mb-1">Channel</p>
                    <p className="text-white">{schedule.channelProfile?.name || 'None'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Language</p>
                    <p className="text-white">{schedule.language.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Next Run</p>
                    <p className="text-white">
                      {schedule.nextRunAt
                        ? new Date(schedule.nextRunAt).toLocaleString()
                        : 'Not scheduled'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Last Run</p>
                    <p className="text-white">
                      {schedule.lastRunAt
                        ? new Date(schedule.lastRunAt).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Publish Delay</p>
                    <p className="text-white">{schedule.publishDelay} min</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Approval Required</p>
                    <p className="text-white">{schedule.requireApproval ? 'Yes' : 'No'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500 mb-1">Topics ({(schedule.customTopics || []).length})</p>
                    <div className="flex flex-wrap gap-1">
                      {(schedule.customTopics || []).slice(0, 5).map((t, i) => (
                        <span key={i} className="rounded bg-white/[0.06] px-2 py-0.5 text-gray-300 text-[11px]">
                          {t.length > 40 ? t.slice(0, 40) + '...' : t}
                        </span>
                      ))}
                      {(schedule.customTopics || []).length > 5 && (
                        <span className="text-gray-500 text-[11px]">
                          +{(schedule.customTopics || []).length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity Logs Component
// ---------------------------------------------------------------------------

function LogsList({
  logs,
  loading,
  onAction,
  onRefresh,
}: {
  logs: AutopilotLog[]
  loading: boolean
  onAction: (logId: string, action: 'approve' | 'reject') => void
  onRefresh: () => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-400">Recent Activity</h2>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-gray-600" />
          <h3 className="mt-4 text-lg font-medium text-white">No activity yet</h3>
          <p className="mt-2 text-sm text-gray-400">Automation logs will appear here once your schedules start running.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const module = MODULE_LABELS[log.moduleType] || { label: log.moduleType, icon: Zap }
            const ModuleIcon = module.icon
            const publishConfig = PUBLISH_STATUS_CONFIG[log.publishStatus] || { label: log.publishStatus, color: 'text-gray-400' }

            return (
              <div
                key={log.id}
                className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                {/* Status Icon */}
                <div className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  log.status === 'COMPLETED' ? 'bg-green-500/10' :
                  log.status === 'FAILED' ? 'bg-red-500/10' :
                  'bg-yellow-500/10'
                )}>
                  {log.status === 'COMPLETED' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : log.status === 'FAILED' ? (
                    <XCircle className="h-4 w-4 text-red-400" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <ModuleIcon className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm font-medium text-white truncate">
                      {log.autopilotSchedule.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 truncate">
                    {log.topic || 'No topic'}
                  </p>
                </div>

                {/* Publish Status */}
                <div className="text-right">
                  <p className={cn('text-xs font-medium', publishConfig.color)}>
                    {publishConfig.label}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>

                {/* Approval Actions */}
                {log.publishStatus === 'AWAITING_APPROVAL' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onAction(log.id, 'approve')}
                      className="rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onAction(log.id, 'reject')}
                      className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      Skip
                    </button>
                  </div>
                )}

                {/* Error message */}
                {log.errorMessage && (
                  <div className="group relative">
                    <AlertCircle className="h-4 w-4 text-red-400 cursor-help" />
                    <div className="invisible group-hover:visible absolute right-0 top-6 z-10 w-64 rounded-lg bg-gray-900 p-3 text-xs text-red-300 border border-red-500/20 shadow-xl">
                      {log.errorMessage}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create Schedule Form
// ---------------------------------------------------------------------------

function CreateScheduleForm({
  socialAccounts,
  channelProfiles,
  onCreated,
}: {
  socialAccounts: SocialAccount[]
  channelProfiles: ChannelProfile[]
  onCreated: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    moduleType: 'REEL' as string,
    channelProfileId: '',
    frequency: 'DAILY' as string,
    scheduledTime: '09:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    language: 'hi',
    customTopics: '' as string, // textarea, one per line
    durationSeconds: 30,
    durationMinutes: 10,
    aspectRatio: '9:16',
    style: '',
    voiceId: '',
    autoPublish: false,
    publishDelay: 0,
    requireApproval: false,
    selectedAccountIds: [] as string[],

    // Module-specific
    challengeType: 'gk_quiz',
    category: 'general',
    difficulty: 'medium',
    numQuestions: 3,
    timerSeconds: 5,
    templateStyle: 'neon',
    voiceEnabled: false,
    gameplayTemplate: 'ENDLESS_RUNNER',
    gameplayTheme: 'neon',
    musicStyle: 'upbeat',
    showScore: true,
    quoteCategory: 'motivational',
    quoteLength: 'medium',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')

    const topics = form.customTopics
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)

    if (topics.length === 0) return toast.error('Add at least one topic')

    // Build module settings based on type
    let moduleSettings: Record<string, unknown> = {}
    switch (form.moduleType) {
      case 'CHALLENGE':
        moduleSettings = {
          challengeType: form.challengeType,
          category: form.category,
          difficulty: form.difficulty,
          numQuestions: form.numQuestions,
          timerSeconds: form.timerSeconds,
          templateStyle: form.templateStyle,
          voiceEnabled: form.voiceEnabled,
        }
        break
      case 'GAMEPLAY':
        moduleSettings = {
          template: form.gameplayTemplate,
          theme: form.gameplayTheme,
          difficulty: form.difficulty,
          duration: form.durationSeconds,
          musicStyle: form.musicStyle,
          showScore: form.showScore,
        }
        break
      case 'QUOTE':
        moduleSettings = {
          category: form.quoteCategory,
          quoteLength: form.quoteLength,
        }
        break
      case 'LONG_FORM':
        moduleSettings = {
          aiClipRatio: 0.3,
          useStockFootage: true,
          useStaticVisuals: true,
        }
        break
    }

    const publishTargets = form.selectedAccountIds.map((id) => ({
      socialAccountId: id,
    }))

    setSubmitting(true)
    try {
      const res = await fetch('/api/automation/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          moduleType: form.moduleType,
          channelProfileId: form.channelProfileId || undefined,
          frequency: form.frequency,
          scheduledTime: form.scheduledTime,
          timezone: form.timezone,
          language: form.language,
          customTopics: topics,
          durationSeconds: form.durationSeconds,
          durationMinutes: form.durationMinutes,
          aspectRatio: form.aspectRatio,
          style: form.style || undefined,
          voiceId: form.voiceId || undefined,
          moduleSettings,
          autoPublish: form.autoPublish,
          publishDelay: form.publishDelay,
          requireApproval: form.requireApproval,
          publishTargets: publishTargets.length > 0 ? publishTargets : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create schedule')
      }

      toast.success('Automation schedule created!')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create schedule')
    } finally {
      setSubmitting(false)
    }
  }

  const showDurationSeconds = ['REEL', 'CHALLENGE', 'GAMEPLAY'].includes(form.moduleType)
  const showDurationMinutes = form.moduleType === 'LONG_FORM'

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-5">
        <h2 className="text-lg font-semibold text-white">Create Automation Schedule</h2>

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Schedule Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Daily Motivation Reels"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none"
          />
        </div>

        {/* Module Type */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Content Type</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {Object.entries(MODULE_LABELS).map(([key, { label, icon: Icon }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setForm({ ...form, moduleType: key })}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-colors',
                  form.moduleType === key
                    ? 'border-brand-500/50 bg-brand-500/10 text-brand-400'
                    : 'border-white/[0.06] bg-white/[0.02] text-gray-400 hover:border-white/[0.12]'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Frequency</label>
            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
            >
              {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                <option key={key} value={key} className="bg-gray-900">{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Time</label>
            <input
              type="time"
              value={form.scheduledTime}
              onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Channel Profile */}
        {channelProfiles.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Channel Profile (optional)</label>
            <select
              value={form.channelProfileId}
              onChange={(e) => setForm({ ...form, channelProfileId: e.target.value })}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
            >
              <option value="" className="bg-gray-900">No channel</option>
              {channelProfiles.map((p) => (
                <option key={p.id} value={p.id} className="bg-gray-900">{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Language & Aspect Ratio */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Language</label>
            <select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
            >
              <option value="hi" className="bg-gray-900">Hindi</option>
              <option value="en" className="bg-gray-900">English</option>
              <option value="es" className="bg-gray-900">Spanish</option>
              <option value="fr" className="bg-gray-900">French</option>
              <option value="de" className="bg-gray-900">German</option>
              <option value="pt" className="bg-gray-900">Portuguese</option>
              <option value="ja" className="bg-gray-900">Japanese</option>
              <option value="ko" className="bg-gray-900">Korean</option>
              <option value="ar" className="bg-gray-900">Arabic</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Aspect Ratio</label>
            <select
              value={form.aspectRatio}
              onChange={(e) => setForm({ ...form, aspectRatio: e.target.value })}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
            >
              <option value="9:16" className="bg-gray-900">9:16 (Portrait)</option>
              <option value="16:9" className="bg-gray-900">16:9 (Landscape)</option>
              <option value="1:1" className="bg-gray-900">1:1 (Square)</option>
            </select>
          </div>
        </div>

        {/* Duration */}
        {showDurationSeconds && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Duration (seconds)</label>
            <select
              value={form.durationSeconds}
              onChange={(e) => setForm({ ...form, durationSeconds: parseInt(e.target.value) })}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
            >
              <option value={15} className="bg-gray-900">15 seconds</option>
              <option value={30} className="bg-gray-900">30 seconds</option>
              <option value={60} className="bg-gray-900">60 seconds</option>
              <option value={90} className="bg-gray-900">90 seconds</option>
            </select>
          </div>
        )}
        {showDurationMinutes && (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Duration (minutes)</label>
            <select
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) })}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
            >
              <option value={5} className="bg-gray-900">5 minutes</option>
              <option value={10} className="bg-gray-900">10 minutes</option>
              <option value={15} className="bg-gray-900">15 minutes</option>
              <option value={20} className="bg-gray-900">20 minutes</option>
              <option value={30} className="bg-gray-900">30 minutes</option>
            </select>
          </div>
        )}

        {/* Module-specific: Challenge */}
        {form.moduleType === 'CHALLENGE' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Challenge Type</label>
              <select
                value={form.challengeType}
                onChange={(e) => setForm({ ...form, challengeType: e.target.value })}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
              >
                <option value="gk_quiz" className="bg-gray-900">GK Quiz</option>
                <option value="emoji_guess" className="bg-gray-900">Emoji Guess</option>
                <option value="riddle" className="bg-gray-900">Riddle</option>
                <option value="math" className="bg-gray-900">Math</option>
                <option value="would_you_rather" className="bg-gray-900">Would You Rather</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Questions</label>
              <select
                value={form.numQuestions}
                onChange={(e) => setForm({ ...form, numQuestions: parseInt(e.target.value) })}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n} className="bg-gray-900">{n}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Module-specific: Gameplay */}
        {form.moduleType === 'GAMEPLAY' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Game Template</label>
              <select
                value={form.gameplayTemplate}
                onChange={(e) => setForm({ ...form, gameplayTemplate: e.target.value })}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
              >
                <option value="ENDLESS_RUNNER" className="bg-gray-900">Endless Runner</option>
                <option value="BALL_MAZE" className="bg-gray-900">Ball Maze</option>
                <option value="OBSTACLE_TOWER" className="bg-gray-900">Obstacle Tower</option>
                <option value="COLOR_SWITCH" className="bg-gray-900">Color Switch</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Theme</label>
              <select
                value={form.gameplayTheme}
                onChange={(e) => setForm({ ...form, gameplayTheme: e.target.value })}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
              >
                {['neon', 'pastel', 'retro', 'dark', 'candy'].map((t) => (
                  <option key={t} value={t} className="bg-gray-900">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Module-specific: Quote */}
        {form.moduleType === 'QUOTE' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Category</label>
              <input
                type="text"
                value={form.quoteCategory}
                onChange={(e) => setForm({ ...form, quoteCategory: e.target.value })}
                placeholder="motivational"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Length</label>
              <select
                value={form.quoteLength}
                onChange={(e) => setForm({ ...form, quoteLength: e.target.value })}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
              >
                <option value="short" className="bg-gray-900">Short</option>
                <option value="medium" className="bg-gray-900">Medium</option>
                <option value="long" className="bg-gray-900">Long</option>
              </select>
            </div>
          </div>
        )}

        {/* Topics */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Topics (one per line — rotates through them)
          </label>
          <textarea
            value={form.customTopics}
            onChange={(e) => setForm({ ...form, customTopics: e.target.value })}
            placeholder={`e.g.\nMotivational story about never giving up\nSuccess mindset tips for entrepreneurs\nLife lessons from great leaders`}
            rows={5}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-brand-500/50 focus:outline-none resize-none"
          />
          <p className="mt-1 text-[11px] text-gray-600">
            The system will cycle through these topics in order. Add as many as you like.
          </p>
        </div>
      </div>

      {/* Auto-Publish Settings */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-5">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Send className="h-4 w-4 text-brand-400" />
          Auto-Publish Settings
        </h3>

        {/* Auto-publish toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm text-white">Enable Auto-Publish</p>
            <p className="text-xs text-gray-500">Automatically publish to social media after generation</p>
          </div>
          <input
            type="checkbox"
            checked={form.autoPublish}
            onChange={(e) => setForm({ ...form, autoPublish: e.target.checked })}
            className="h-5 w-5 rounded border-white/20 bg-white/[0.06] text-brand-500 focus:ring-brand-500/30"
          />
        </label>

        {form.autoPublish && (
          <>
            {/* Require Approval */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-white">Require Approval</p>
                <p className="text-xs text-gray-500">Review content before it gets published</p>
              </div>
              <input
                type="checkbox"
                checked={form.requireApproval}
                onChange={(e) => setForm({ ...form, requireApproval: e.target.checked })}
                className="h-5 w-5 rounded border-white/20 bg-white/[0.06] text-brand-500 focus:ring-brand-500/30"
              />
            </label>

            {/* Publish Delay */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Publish Delay (minutes after generation)
              </label>
              <input
                type="number"
                min={0}
                max={1440}
                value={form.publishDelay}
                onChange={(e) => setForm({ ...form, publishDelay: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
              />
            </div>

            {/* Social Accounts Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Publish To</label>
              {socialAccounts.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No social accounts connected. Connect accounts in Social Accounts settings first.
                </p>
              ) : (
                <div className="space-y-2">
                  {socialAccounts.map((account) => (
                    <label
                      key={account.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                        form.selectedAccountIds.includes(account.id)
                          ? 'border-brand-500/50 bg-brand-500/10'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={form.selectedAccountIds.includes(account.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm({ ...form, selectedAccountIds: [...form.selectedAccountIds, account.id] })
                          } else {
                            setForm({ ...form, selectedAccountIds: form.selectedAccountIds.filter((id) => id !== account.id) })
                          }
                        }}
                        className="h-4 w-4 rounded border-white/20 bg-white/[0.06] text-brand-500 focus:ring-brand-500/30"
                      />
                      <div>
                        <p className="text-sm text-white">{account.accountName}</p>
                        <p className="text-[11px] text-gray-500">{account.platform}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Create Automation Schedule
          </>
        )}
      </button>
    </form>
  )
}

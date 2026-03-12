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
  Mic,
  Ratio,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  User,
  ListChecks,
  Pencil,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES, VIDEO_STYLES, CHALLENGE_TYPES, CHALLENGE_CATEGORIES, CHALLENGE_DIFFICULTIES, CHALLENGE_TEMPLATES, QUOTE_CATEGORIES } from '@/lib/constants'
import { MusicSelector } from '@/components/ui/music-selector'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Schedule {
  id: string
  name: string
  moduleType: string
  isActive: boolean
  frequency: string
  minuteInterval: number
  hourlyInterval: number
  scheduledTime: string
  timezone: string
  language: string
  autoPublish: boolean
  requireApproval: boolean
  publishDelay: number
  customTopics: string[] | null
  durationSeconds: number
  durationMinutes: number
  aspectRatio: string
  bgMusicTrack: string | null
  bgMusicVolume: number | null
  style: string | null
  voiceId: string | null
  channelProfileId: string | null
  moduleSettings: Record<string, unknown> | null
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
  niche: string
  primaryColor: string
  tone: string
  platform: string
  defaultVoiceId: string | null
  defaultLanguage: string | null
}

interface CartoonSeriesOption {
  id: string
  name: string
  artStyle: string | null
  narratorVoiceId: string | null
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
  EVERY_MINUTES: 'Minutes',
  HOURLY: 'Hourly',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 Weeks',
  MONTHLY: 'Monthly',
}

const MINUTE_INTERVALS = [5, 10, 15, 20, 30, 45] as const
const HOURLY_INTERVALS = [1, 2, 3, 4, 6, 8, 12] as const

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
  const [cartoonSeries, setCartoonSeries] = useState<CartoonSeriesOption[]>([])
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)

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

  // Fetch social accounts, channel profiles & cartoon series (for create form)
  const fetchFormData = useCallback(async () => {
    const [accountsRes, profilesRes, seriesRes] = await Promise.all([
      fetch('/api/social-accounts').catch(() => null),
      fetch('/api/profiles').catch(() => null),
      fetch('/api/cartoon-studio/series').catch(() => null),
    ])
    if (accountsRes?.ok) {
      const data = await accountsRes.json()
      setSocialAccounts(data.accounts || [])
    }
    if (profilesRes?.ok) {
      const data = await profilesRes.json()
      setChannelProfiles(Array.isArray(data) ? data : [])
    }
    if (seriesRes?.ok) {
      const data = await seriesRes.json()
      setCartoonSeries((data.series || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        artStyle: s.artStyle,
        narratorVoiceId: s.narratorVoiceId,
      })))
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

  // Run schedule immediately
  const runScheduleNow = async (id: string) => {
    try {
      const res = await fetch(`/api/automation/schedules/${id}/run`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success('Schedule queued — job will be created on next scheduler tick (up to 5 min)')
      fetchSchedules()
    } catch {
      toast.error('Failed to trigger schedule')
    }
  }

  // Approve/reject a log
  const handleLogAction = async (logId: string, action: 'approve' | 'reject' | 'retry') => {
    try {
      const res = await fetch('/api/automation/logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, action }),
      })
      if (!res.ok) throw new Error()
      const messages = {
        approve: 'Approved for publishing',
        reject: 'Publishing skipped',
        retry: 'Retrying — new job queued',
      }
      toast.success(messages[action])
      fetchLogs()
      if (action === 'retry') fetchSchedules()
    } catch {
      toast.error('Failed to update')
    }
  }

  return (
    <div className="mx-auto px-4 py-8">
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
          onClick={() => { setEditingSchedule(null); setTab('create') }}
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
            {t === 'schedules' ? 'Schedules' : t === 'logs' ? 'Activity Log' : editingSchedule ? 'Edit Schedule' : 'Create New'}
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
          onEdit={(schedule) => {
            setEditingSchedule(schedule)
            setTab('create')
          }}
          onRunNow={runScheduleNow}
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
          key={editingSchedule?.id || 'new'}
          socialAccounts={socialAccounts}
          channelProfiles={channelProfiles}
          cartoonSeries={cartoonSeries}
          editingSchedule={editingSchedule}
          onCreated={() => {
            setTab('schedules')
            setEditingSchedule(null)
            fetchSchedules()
          }}
          onCancel={() => {
            setEditingSchedule(null)
            setTab('schedules')
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
  onEdit,
  onRunNow,
}: {
  schedules: Schedule[]
  loading: boolean
  expandedSchedule: string | null
  onToggleExpand: (id: string) => void
  onToggle: (id: string, isActive: boolean) => void
  onDelete: (id: string) => void
  onEdit: (schedule: Schedule) => void
  onRunNow: (id: string) => void
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
                  <span>
                    {schedule.frequency === 'EVERY_MINUTES'
                      ? `Every ${schedule.minuteInterval}min`
                      : schedule.frequency === 'HOURLY'
                        ? schedule.hourlyInterval === 1 ? 'Every Hour' : `Every ${schedule.hourlyInterval}h`
                        : FREQUENCY_LABELS[schedule.frequency] || schedule.frequency}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {schedule.frequency === 'EVERY_MINUTES' || schedule.frequency === 'HOURLY'
                      ? schedule.timezone
                      : `${schedule.scheduledTime} ${schedule.timezone}`}
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
                  onClick={() => onRunNow(schedule.id)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-green-500/10 hover:text-green-400 transition-colors"
                  title="Run Now"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onEdit(schedule)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-brand-500/10 hover:text-brand-400 transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
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
  onAction: (logId: string, action: 'approve' | 'reject' | 'retry') => void
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
                  'bg-brand-500/10'
                )}>
                  {log.status === 'COMPLETED' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : log.status === 'FAILED' ? (
                    <XCircle className="h-4 w-4 text-red-400" />
                  ) : (
                    <Clock className="h-4 w-4 text-brand-400" />
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

                {/* Retry for failed */}
                {log.status === 'FAILED' && (
                  <button
                    onClick={() => onAction(log.id, 'retry')}
                    className="rounded-lg bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-500/20 transition-colors"
                  >
                    Retry
                  </button>
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

const VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', desc: 'Professional Female' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', desc: 'Professional Male' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', desc: 'Energetic Female' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', desc: 'Energetic Male' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', desc: 'Calm Female' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', desc: 'Calm Male' },
  { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Emily', desc: 'Casual Female' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will', desc: 'Casual Male' },
]

const DURATIONS = [
  { value: 5, label: '5s', desc: 'Ultra short' },
  { value: 10, label: '10s', desc: 'Quick clip' },
  { value: 15, label: '15s', desc: 'Quick hook' },
  { value: 30, label: '30s', desc: 'Standard' },
  { value: 60, label: '60s', desc: 'Deep dive' },
]

const LONG_FORM_DURATIONS = [
  { value: 5, label: '5 min', desc: 'Quick' },
  { value: 10, label: '10 min', desc: 'Short' },
  { value: 15, label: '15 min', desc: 'Medium' },
  { value: 20, label: '20 min', desc: 'Long' },
  { value: 30, label: '30 min', desc: 'Extended' },
]

const ASPECTS = [
  { value: '9:16', label: '9:16', desc: 'Reels · Shorts · TikTok · Stories' },
  { value: '1:1', label: '1:1', desc: 'Instagram Feed · Facebook Post' },
  { value: '16:9', label: '16:9', desc: 'YouTube · Desktop · TV' },
]

const GAMEPLAY_TEMPLATES = [
  { id: 'ENDLESS_RUNNER', name: 'Endless Runner' },
  { id: 'BALL_MAZE', name: 'Ball Maze' },
  { id: 'OBSTACLE_TOWER', name: 'Obstacle Tower' },
  { id: 'COLOR_SWITCH', name: 'Color Switch' },
]

const GAMEPLAY_THEMES = [
  { id: 'neon', name: 'Neon', color: '#06B6D4' },
  { id: 'pastel', name: 'Pastel', color: '#F9A8D4' },
  { id: 'retro', name: 'Retro', color: '#D97706' },
  { id: 'dark', name: 'Dark', color: '#1E293B' },
  { id: 'candy', name: 'Candy', color: '#EC4899' },
]

function CreateScheduleForm({
  socialAccounts,
  channelProfiles,
  cartoonSeries,
  editingSchedule,
  onCreated,
  onCancel,
}: {
  socialAccounts: SocialAccount[]
  channelProfiles: ChannelProfile[]
  cartoonSeries: CartoonSeriesOption[]
  editingSchedule: Schedule | null
  onCreated: () => void
  onCancel: () => void
}) {
  const isEditing = !!editingSchedule
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  const buildInitialForm = () => {
    if (!editingSchedule) {
      return {
        name: '',
        moduleType: 'REEL' as string,
        channelProfileId: '',
        frequency: 'DAILY' as string,
        minuteInterval: 30,
        hourlyInterval: 1,
        scheduledTime: '09:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        language: 'hi',
        customTopics: '' as string,
        durationSeconds: 30,
        durationMinutes: 10,
        aspectRatio: '9:16',
        bgMusicTrack: 'none',
        bgMusicVolume: 15,
        style: 'cinematic',
        voiceId: 'EXAVITQu4vr4xnSDxMaL',
        autoPublish: false,
        publishDelay: 0,
        requireApproval: false,
        selectedAccountIds: [] as string[],
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
        cartoonSeriesId: '',
      }
    }
    const ms = (editingSchedule.moduleSettings || {}) as Record<string, unknown>
    return {
      name: editingSchedule.name,
      moduleType: editingSchedule.moduleType,
      channelProfileId: editingSchedule.channelProfileId || '',
      frequency: editingSchedule.frequency,
      minuteInterval: editingSchedule.minuteInterval || 30,
      hourlyInterval: editingSchedule.hourlyInterval || 1,
      scheduledTime: editingSchedule.scheduledTime,
      timezone: editingSchedule.timezone,
      language: editingSchedule.language,
      customTopics: (editingSchedule.customTopics || []).join('\n'),
      durationSeconds: editingSchedule.durationSeconds || 30,
      durationMinutes: editingSchedule.durationMinutes || 10,
      aspectRatio: editingSchedule.aspectRatio || '9:16',
      bgMusicTrack: editingSchedule.bgMusicTrack || 'none',
      bgMusicVolume: editingSchedule.bgMusicVolume ?? 15,
      style: editingSchedule.style || 'cinematic',
      voiceId: editingSchedule.voiceId || 'EXAVITQu4vr4xnSDxMaL',
      autoPublish: editingSchedule.autoPublish,
      publishDelay: editingSchedule.publishDelay,
      requireApproval: editingSchedule.requireApproval,
      selectedAccountIds: (editingSchedule.publishTargets || []).map(t => t.socialAccountId),
      challengeType: (ms.challengeType as string) || 'gk_quiz',
      category: (ms.category as string) || 'general',
      difficulty: (ms.difficulty as string) || 'medium',
      numQuestions: (ms.numQuestions as number) || 3,
      timerSeconds: (ms.timerSeconds as number) || 5,
      templateStyle: (ms.templateStyle as string) || 'neon',
      voiceEnabled: (ms.voiceEnabled as boolean) || false,
      gameplayTemplate: (ms.template as string) || 'ENDLESS_RUNNER',
      gameplayTheme: (ms.theme as string) || 'neon',
      musicStyle: (ms.musicStyle as string) || 'upbeat',
      showScore: (ms.showScore as boolean) ?? true,
      quoteCategory: (ms.category as string) || 'motivational',
      quoteLength: (ms.quoteLength as string) || 'medium',
      cartoonSeriesId: (ms.seriesId as string) || '',
    }
  }

  const [form, setForm] = useState(buildInitialForm)

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
      case 'CARTOON':
        moduleSettings = {
          seriesId: form.cartoonSeriesId || undefined,
          narratorVoiceId: cartoonSeries.find(s => s.id === form.cartoonSeriesId)?.narratorVoiceId || undefined,
        }
        break
    }

    const publishTargets = form.selectedAccountIds.map((id) => ({
      socialAccountId: id,
    }))

    const payload = {
      name: form.name,
      moduleType: form.moduleType,
      channelProfileId: form.channelProfileId || null,
      frequency: form.frequency,
      minuteInterval: form.frequency === 'EVERY_MINUTES' ? form.minuteInterval : 30,
      hourlyInterval: form.frequency === 'HOURLY' ? form.hourlyInterval : 1,
      scheduledTime: form.scheduledTime,
      timezone: form.timezone,
      language: form.language,
      customTopics: topics,
      durationSeconds: form.durationSeconds,
      durationMinutes: form.durationMinutes,
      aspectRatio: form.aspectRatio,
      bgMusicTrack: form.bgMusicTrack !== 'none' ? form.bgMusicTrack : null,
      bgMusicVolume: form.bgMusicTrack !== 'none' ? form.bgMusicVolume : null,
      style: form.style || null,
      voiceId: form.voiceId || null,
      moduleSettings,
      autoPublish: form.autoPublish,
      publishDelay: form.publishDelay,
      requireApproval: form.requireApproval,
      publishTargets: publishTargets.length > 0 ? publishTargets : null,
    }

    setSubmitting(true)
    try {
      const url = isEditing
        ? `/api/automation/schedules/${editingSchedule!.id}`
        : '/api/automation/schedules'
      const res = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Failed to ${isEditing ? 'update' : 'create'} schedule`)
      }

      toast.success(isEditing ? 'Schedule updated!' : 'Automation schedule created!')
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} schedule`)
    } finally {
      setSubmitting(false)
    }
  }

  const showDuration = ['REEL', 'CHALLENGE', 'GAMEPLAY'].includes(form.moduleType)
  const showLongFormDuration = form.moduleType === 'LONG_FORM'
  const showVoice = ['REEL', 'LONG_FORM'].includes(form.moduleType)
  const showStyle = ['REEL', 'LONG_FORM'].includes(form.moduleType)

  const canProceedStep1 = form.name.trim().length > 0 && (form.moduleType !== 'CARTOON' || form.cartoonSeriesId)

  const STEP_LABELS = [
    { num: 1, label: 'Content & Settings', icon: Sparkles },
    { num: 2, label: 'Schedule & Publish', icon: Calendar },
  ]

  return (
    <form onSubmit={handleSubmit} className="mx-auto space-y-6" style={{ maxWidth: step === 1 ? '100%' : '56rem' }}>
      {/* ── Edit Banner ── */}
      {isEditing && (
        <div className="flex items-center justify-between rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-brand-400" />
            <p className="text-sm text-brand-300">Editing: <span className="font-medium text-white">{editingSchedule!.name}</span></p>
          </div>
          <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-white transition">
            Cancel
          </button>
        </div>
      )}

      {/* ── Step Indicator ── */}
      <div className="flex items-center gap-2 mb-2">
        {STEP_LABELS.map((s, i) => (
          <div key={s.num} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => s.num <= step && setStep(s.num as 1 | 2)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition w-full',
                s.num === step
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                  : s.num < step
                  ? 'bg-green-500/10 text-green-400 cursor-pointer'
                  : 'bg-white/5 text-gray-500'
              )}
            >
              <s.icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{s.label}</span>
            </button>
            {i < STEP_LABELS.length - 1 && <div className="w-6 h-px bg-white/10 flex-shrink-0 mx-1" />}
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
         STEP 1: Content Type, Settings, Module Config, Topics
         ══════════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <>
          {/* ── Basic Info ── */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Content Configuration</h2>
              <p className="text-xs text-gray-500 mt-0.5">Choose content type and configure settings</p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Schedule Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Daily Motivation Reels"
                className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
              />
            </div>

            {/* Module Type */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Content Type</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {Object.entries(MODULE_LABELS).map(([key, { label, icon: Icon }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, moduleType: key })}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition',
                      form.moduleType === key
                        ? 'border-brand-500 bg-brand-500/10 text-brand-400 ring-1 ring-brand-500'
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Channel Profile */}
            {channelProfiles.length > 0 && form.moduleType !== 'CARTOON' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Channel Profile</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, channelProfileId: '' })}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-3.5 text-left transition',
                      !form.channelProfileId
                        ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    )}
                  >
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0', !form.channelProfileId ? 'bg-brand-500/20' : 'bg-white/[0.06]')}>
                      <Globe className={cn('h-4 w-4', !form.channelProfileId ? 'text-brand-400' : 'text-gray-500')} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">No Profile</p>
                      <p className="text-[10px] text-gray-500">Use default settings</p>
                    </div>
                    {!form.channelProfileId && <Check className="h-4 w-4 text-brand-400 ml-auto flex-shrink-0" />}
                  </button>
                  {channelProfiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const updates: Record<string, any> = { channelProfileId: p.id }
                        if (p.defaultLanguage) updates.language = p.defaultLanguage
                        if (p.defaultVoiceId) updates.voiceId = p.defaultVoiceId
                        setForm(prev => ({ ...prev, ...updates }))
                      }}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3.5 text-left transition',
                        form.channelProfileId === p.id
                          ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      )}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: `${p.primaryColor}20` }}>
                        <User className="h-4 w-4" style={{ color: p.primaryColor }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-500 truncate capitalize">{p.niche} · {p.platform.toLowerCase()}</p>
                      </div>
                      {form.channelProfileId === p.id && <Check className="h-4 w-4 text-brand-400 ml-auto flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cartoon Series Selector */}
            {form.moduleType === 'CARTOON' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Cartoon Series *</label>
                {cartoonSeries.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
                    <Clapperboard className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No cartoon series found</p>
                    <p className="text-xs text-gray-600 mt-0.5">Create a series in Cartoon Studio first</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {cartoonSeries.map((series) => (
                      <button
                        key={series.id}
                        type="button"
                        onClick={() => setForm({ ...form, cartoonSeriesId: series.id })}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border p-3.5 text-left transition',
                          form.cartoonSeriesId === series.id
                            ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        )}
                      >
                        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0', form.cartoonSeriesId === series.id ? 'bg-brand-500/20' : 'bg-white/[0.06]')}>
                          <Clapperboard className={cn('h-4 w-4', form.cartoonSeriesId === series.id ? 'text-brand-400' : 'text-gray-500')} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{series.name}</p>
                          {series.artStyle && (
                            <p className="text-[10px] text-gray-500 truncate">{series.artStyle}</p>
                          )}
                        </div>
                        {form.cartoonSeriesId === series.id && <Check className="h-4 w-4 text-brand-400 ml-auto flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Output Settings ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Language */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white mb-0.5">Output Settings</h3>
                <p className="text-xs text-gray-500">Language, format & duration</p>
              </div>

              {/* Language */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Language</label>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setForm({ ...form, language: lang.code })}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                        form.language === lang.code
                          ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                      )}
                    >
                      <span className="text-sm">{lang.flag}</span>
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  <span className="flex items-center gap-1.5"><Ratio className="h-3.5 w-3.5" /> Aspect Ratio</span>
                </label>
                <div className="flex gap-2">
                  {ASPECTS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => setForm({ ...form, aspectRatio: a.value })}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-2 text-center transition',
                        form.aspectRatio === a.value
                          ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                      )}
                    >
                      <p className="text-sm font-bold">{a.label}</p>
                      <p className="text-[10px] text-gray-500">{a.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Music */}
              <MusicSelector
                value={form.bgMusicTrack}
                volume={form.bgMusicVolume}
                onTrackChange={(t) => setForm({ ...form, bgMusicTrack: t })}
                onVolumeChange={(v) => setForm({ ...form, bgMusicVolume: v })}
                compact
              />

              {/* Duration (short-form) */}
              {showDuration && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Duration</span>
                  </label>
                  <div className="flex gap-2">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setForm({ ...form, durationSeconds: d.value })}
                        className={cn(
                          'flex-1 rounded-lg border px-2 py-2 text-center transition',
                          form.durationSeconds === d.value
                            ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                        )}
                      >
                        <p className="text-sm font-bold">{d.label}</p>
                        <p className="text-[10px] text-gray-500">{d.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Duration (long-form) */}
              {showLongFormDuration && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Duration</span>
                  </label>
                  <div className="flex gap-2">
                    {LONG_FORM_DURATIONS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setForm({ ...form, durationMinutes: d.value })}
                        className={cn(
                          'flex-1 rounded-lg border px-2 py-2 text-center transition',
                          form.durationMinutes === d.value
                            ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                        )}
                      >
                        <p className="text-sm font-bold">{d.label}</p>
                        <p className="text-[10px] text-gray-500">{d.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  <span className="flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" /> Topics</span>
                </label>
                <textarea
                  value={form.customTopics}
                  onChange={(e) => setForm({ ...form, customTopics: e.target.value })}
                  placeholder={form.moduleType === 'CARTOON'
                    ? `e.g.\nBaby elephant learns to swim\nThe day the sun forgot to rise\nA friendly dragon helps travellers`
                    : `e.g.\nMotivational story about never giving up\nSuccess mindset tips for entrepreneurs\nLife lessons from great leaders`}
                  rows={4}
                  className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                />
                <p className="text-[10px] text-gray-600 mt-1.5">
                  One topic per line — the system cycles through them in order.
                </p>
              </div>
            </div>

            {/* Right: Style (for Reel/Long-Form) or Module-specific */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
              {showStyle ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">Visual Style</h3>
                    <p className="text-xs text-gray-500">Choose a visual style for your content</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">Style</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {VIDEO_STYLES.map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setForm({ ...form, style: style.id })}
                          className={cn(
                            'rounded-xl border p-2.5 text-left transition',
                            form.style === style.id
                              ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                              : 'border-white/10 bg-white/5 hover:bg-white/10'
                          )}
                        >
                          <div className="h-4 w-4 rounded-md mb-1.5" style={{ backgroundColor: style.color }} />
                          <p className="text-[11px] font-medium text-white">{style.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">
                      {form.moduleType === 'CHALLENGE' ? 'Challenge Settings' :
                       form.moduleType === 'GAMEPLAY' ? 'Gameplay Settings' :
                       form.moduleType === 'QUOTE' ? 'Quote Settings' :
                       form.moduleType === 'CARTOON' ? 'Episode Settings' :
                       'Module Settings'}
                    </h3>
                    <p className="text-xs text-gray-500">Configure module-specific options</p>
                  </div>

                  {/* Challenge */}
                  {form.moduleType === 'CHALLENGE' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Challenge Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          {CHALLENGE_TYPES.map((ct) => (
                            <button key={ct.id} type="button" onClick={() => setForm({ ...form, challengeType: ct.id })}
                              className={cn('rounded-lg border p-2.5 text-left transition text-xs',
                                form.challengeType === ct.id ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500' : 'border-white/10 bg-white/5 hover:bg-white/10'
                              )}>
                              <p className="font-medium text-white">{ct.name}</p>
                              <p className="text-[10px] text-gray-500">{ct.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Category</label>
                        <div className="flex flex-wrap gap-1.5">
                          {CHALLENGE_CATEGORIES.map((cat) => (
                            <button key={cat.id} type="button" onClick={() => setForm({ ...form, category: cat.id })}
                              className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                                form.category === cat.id ? 'border-brand-500 bg-brand-500/15 text-brand-400' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                              )}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Difficulty</label>
                        <div className="flex gap-2">
                          {CHALLENGE_DIFFICULTIES.map((d) => (
                            <button key={d.id} type="button" onClick={() => setForm({ ...form, difficulty: d.id })}
                              className={cn('flex-1 rounded-lg border py-2 text-center text-xs font-medium transition',
                                form.difficulty === d.id ? 'border-brand-500 bg-brand-500/15 text-brand-400' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                              )}>{d.name}</button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-2">Questions</label>
                          <div className="flex gap-2">
                            {[1, 3, 5].map((n) => (
                              <button key={n} type="button" onClick={() => setForm({ ...form, numQuestions: n })}
                                className={cn('flex-1 rounded-lg border py-2 text-xs font-medium transition',
                                  form.numQuestions === n ? 'border-brand-500 bg-brand-500/15 text-brand-400' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                                )}>{n}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-2">Timer</label>
                          <div className="flex gap-2">
                            {[5, 10, 15].map((t) => (
                              <button key={t} type="button" onClick={() => setForm({ ...form, timerSeconds: t })}
                                className={cn('flex-1 rounded-lg border py-2 text-xs font-medium transition',
                                  form.timerSeconds === t ? 'border-brand-500 bg-brand-500/15 text-brand-400' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                                )}>{t}s</button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Template</label>
                        <div className="flex gap-2">
                          {CHALLENGE_TEMPLATES.map((t) => (
                            <button key={t.id} type="button" onClick={() => setForm({ ...form, templateStyle: t.id })}
                              className={cn('flex-1 rounded-lg border p-2.5 text-center transition',
                                form.templateStyle === t.id ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500' : 'border-white/10 bg-white/5 hover:bg-white/10'
                              )}>
                              <div className="h-3 w-3 rounded mx-auto mb-1" style={{ backgroundColor: t.color }} />
                              <p className="text-[11px] font-medium text-white">{t.name}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Gameplay */}
                  {form.moduleType === 'GAMEPLAY' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Game Template</label>
                        <div className="grid grid-cols-2 gap-2">
                          {GAMEPLAY_TEMPLATES.map((t) => (
                            <button key={t.id} type="button" onClick={() => setForm({ ...form, gameplayTemplate: t.id })}
                              className={cn('rounded-lg border p-3 text-xs font-medium transition',
                                form.gameplayTemplate === t.id ? 'border-brand-500 bg-brand-500/10 text-brand-400 ring-1 ring-brand-500' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                              )}>{t.name}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Theme</label>
                        <div className="flex flex-wrap gap-2">
                          {GAMEPLAY_THEMES.map((t) => (
                            <button key={t.id} type="button" onClick={() => setForm({ ...form, gameplayTheme: t.id })}
                              className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                                form.gameplayTheme === t.id ? 'border-brand-500 bg-brand-500/15 text-brand-400' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                              )}>
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />{t.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Difficulty</label>
                        <div className="flex gap-2">
                          {CHALLENGE_DIFFICULTIES.map((d) => (
                            <button key={d.id} type="button" onClick={() => setForm({ ...form, difficulty: d.id })}
                              className={cn('flex-1 rounded-lg border py-2 text-xs font-medium text-center transition',
                                form.difficulty === d.id ? 'border-brand-500 bg-brand-500/15 text-brand-400' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                              )}>{d.name}</button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Quote */}
                  {form.moduleType === 'QUOTE' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Category</label>
                        <div className="flex flex-wrap gap-1.5">
                          {QUOTE_CATEGORIES.map((cat) => (
                            <button key={cat.id} type="button" onClick={() => setForm({ ...form, quoteCategory: cat.id })}
                              className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                                form.quoteCategory === cat.id ? 'border-brand-500 bg-brand-500/15 text-brand-400' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                              )}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">Length</label>
                        <div className="flex gap-2">
                          {[{ id: 'short', label: 'Short', desc: '1-2 lines' }, { id: 'medium', label: 'Medium', desc: '2-4 lines' }, { id: 'long', label: 'Long', desc: '4-6 lines' }].map((l) => (
                            <button key={l.id} type="button" onClick={() => setForm({ ...form, quoteLength: l.id })}
                              className={cn('flex-1 rounded-lg border px-3 py-2 text-center transition',
                                form.quoteLength === l.id ? 'border-brand-500 bg-brand-500/15 text-brand-400' : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                              )}>
                              <p className="text-xs font-medium">{l.label}</p>
                              <p className="text-[10px] text-gray-500">{l.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Cartoon — episode prompt hints */}
                  {form.moduleType === 'CARTOON' && (
                    <p className="text-xs text-gray-500">
                      Episodes will be generated using topics from the next section. Each topic becomes an episode prompt for the selected series.
                    </p>
                  )}

                  {/* IMAGE_STUDIO — minimal */}
                  {form.moduleType === 'IMAGE_STUDIO' && (
                    <p className="text-xs text-gray-500">
                      Images will be generated from your topic list. Each topic becomes a prompt for AI image generation.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── AI Voices ── */}
          {showVoice && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white mb-0.5">AI Voice</h3>
                <p className="text-xs text-gray-500">Select a voice for AI narration</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {VOICES.map((voice) => (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => setForm({ ...form, voiceId: voice.id })}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border p-3 text-left transition',
                      form.voiceId === voice.id
                        ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0',
                      form.voiceId === voice.id ? 'bg-brand-500/20' : 'bg-white/10'
                    )}>
                      <Mic className={cn('h-3.5 w-3.5', form.voiceId === voice.id ? 'text-brand-400' : 'text-gray-500')} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{voice.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{voice.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Next Button ── */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (!form.name.trim()) return toast.error('Name is required')
                if (form.moduleType === 'CARTOON' && !form.cartoonSeriesId) return toast.error('Select a cartoon series')
                const topics = form.customTopics.split('\n').map(t => t.trim()).filter(Boolean)
                if (topics.length === 0) return toast.error('Add at least one topic')
                setStep(2)
              }}
              disabled={!canProceedStep1}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Schedule & Publish <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
         STEP 2: Schedule Timing & Auto-Publish
         ══════════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <>
          {/* ── Schedule Timing ── */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Schedule & Timing</h2>
              <p className="text-xs text-gray-500 mt-0.5">When should content be generated?</p>
            </div>

            {/* Frequency Dropdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Frequency</label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none appearance-none cursor-pointer"
                >
                  {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                    <option key={key} value={key} className="bg-gray-900 text-white">
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Interval dropdown — changes based on frequency */}
              {form.frequency === 'EVERY_MINUTES' && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Run Every</label>
                  <select
                    value={form.minuteInterval}
                    onChange={(e) => setForm({ ...form, minuteInterval: Number(e.target.value) })}
                    className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none appearance-none cursor-pointer"
                  >
                    {MINUTE_INTERVALS.map((min) => (
                      <option key={min} value={min} className="bg-gray-900 text-white">
                        Every {min} Minutes
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {form.frequency === 'HOURLY' && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Run Every</label>
                  <select
                    value={form.hourlyInterval}
                    onChange={(e) => setForm({ ...form, hourlyInterval: Number(e.target.value) })}
                    className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none appearance-none cursor-pointer"
                  >
                    {HOURLY_INTERVALS.map((hr) => (
                      <option key={hr} value={hr} className="bg-gray-900 text-white">
                        {hr === 1 ? 'Every Hour' : `Every ${hr} Hours`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Time of Day — only for daily/weekly/biweekly/monthly */}
              {!['EVERY_MINUTES', 'HOURLY'].includes(form.frequency) && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Time of Day</span>
                  </label>
                  <input
                    type="time"
                    value={form.scheduledTime}
                    onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
                    className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                  <p className="text-[11px] text-gray-600 mt-1">{form.timezone}</p>
                </div>
              )}
            </div>

            {/* Timezone */}
            {['EVERY_MINUTES', 'HOURLY'].includes(form.frequency) && (
              <p className="text-[11px] text-gray-600">Timezone: {form.timezone}</p>
            )}
          </div>

          {/* ── Auto-Publish ── */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-brand-400" />
              <div>
                <h3 className="text-sm font-semibold text-white">Auto-Publish</h3>
                <p className="text-xs text-gray-500">Publish to social media after generation</p>
              </div>
            </div>

            {/* Auto-publish toggle */}
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-white">Enable Auto-Publish</p>
                <p className="text-xs text-gray-500">Automatically publish after content is ready</p>
              </div>
              <div className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                form.autoPublish ? 'bg-brand-500' : 'bg-white/10'
              )}>
                <input type="checkbox" checked={form.autoPublish} onChange={(e) => setForm({ ...form, autoPublish: e.target.checked })} className="sr-only" />
                <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', form.autoPublish ? 'translate-x-6' : 'translate-x-1')} />
              </div>
            </label>

            {form.autoPublish && (
              <>
                {/* Require Approval */}
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm text-white">Require Approval</p>
                    <p className="text-xs text-gray-500">Review content before publishing</p>
                  </div>
                  <div className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', form.requireApproval ? 'bg-brand-500' : 'bg-white/10')}>
                    <input type="checkbox" checked={form.requireApproval} onChange={(e) => setForm({ ...form, requireApproval: e.target.checked })} className="sr-only" />
                    <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', form.requireApproval ? 'translate-x-6' : 'translate-x-1')} />
                  </div>
                </label>

                {/* Publish Delay */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Publish Delay (minutes after generation)</label>
                  <input
                    type="number" min={0} max={1440} value={form.publishDelay}
                    onChange={(e) => setForm({ ...form, publishDelay: parseInt(e.target.value) || 0 })}
                    className="w-full max-w-xs rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                </div>

                {/* Social Accounts */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Publish To</label>
                  {socialAccounts.length === 0 ? (
                    <p className="text-xs text-gray-500">No social accounts connected. Connect accounts in Social Accounts settings first.</p>
                  ) : (
                    <div className="space-y-2">
                      {socialAccounts.map((account) => (
                        <label key={account.id} className={cn('flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition',
                          form.selectedAccountIds.includes(account.id) ? 'border-brand-500/50 bg-brand-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                        )}>
                          <input type="checkbox" checked={form.selectedAccountIds.includes(account.id)}
                            onChange={(e) => {
                              if (e.target.checked) setForm({ ...form, selectedAccountIds: [...form.selectedAccountIds, account.id] })
                              else setForm({ ...form, selectedAccountIds: form.selectedAccountIds.filter((id) => id !== account.id) })
                            }} className="sr-only" />
                          <div className={cn('h-4 w-4 rounded border flex items-center justify-center flex-shrink-0',
                            form.selectedAccountIds.includes(account.id) ? 'border-brand-500 bg-brand-500' : 'border-white/20 bg-white/5'
                          )}>
                            {form.selectedAccountIds.includes(account.id) && <Check className="h-3 w-3 text-white" />}
                          </div>
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

          {/* ── Summary Card ── */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-gray-500">Type</p>
                <p className="text-white font-medium">{MODULE_LABELS[form.moduleType]?.label || form.moduleType}</p>
              </div>
              <div>
                <p className="text-gray-500">Language</p>
                <p className="text-white font-medium">{SUPPORTED_LANGUAGES.find(l => l.code === form.language)?.name || form.language}</p>
              </div>
              <div>
                <p className="text-gray-500">Frequency</p>
                <p className="text-white font-medium">
                  {form.frequency === 'EVERY_MINUTES'
                    ? `Every ${form.minuteInterval} Minutes`
                    : form.frequency === 'HOURLY'
                      ? form.hourlyInterval === 1 ? 'Every Hour' : `Every ${form.hourlyInterval} Hours`
                      : `${FREQUENCY_LABELS[form.frequency]} at ${form.scheduledTime}`}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Topics</p>
                <p className="text-white font-medium">{form.customTopics.split('\n').filter(t => t.trim()).length} topics</p>
              </div>
              {form.channelProfileId && (
                <div>
                  <p className="text-gray-500">Channel</p>
                  <p className="text-white font-medium">{channelProfiles.find(p => p.id === form.channelProfileId)?.name || 'Selected'}</p>
                </div>
              )}
              {form.moduleType === 'CARTOON' && form.cartoonSeriesId && (
                <div>
                  <p className="text-gray-500">Series</p>
                  <p className="text-white font-medium">{cartoonSeries.find(s => s.id === form.cartoonSeriesId)?.name || 'Selected'}</p>
                </div>
              )}
              {showVoice && (
                <div>
                  <p className="text-gray-500">Voice</p>
                  <p className="text-white font-medium">{VOICES.find(v => v.id === form.voiceId)?.name || 'Default'}</p>
                </div>
              )}
              {showStyle && (
                <div>
                  <p className="text-gray-500">Style</p>
                  <p className="text-white font-medium capitalize">{form.style}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Navigation ── */}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-brand-600 px-8 py-3 text-sm font-semibold text-white hover:from-purple-500 hover:to-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-brand-500/25"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {isEditing ? 'Saving...' : 'Creating...'}</>
              ) : (
                <><Zap className="h-4 w-4" /> {isEditing ? 'Save Changes' : 'Create Schedule'}</>
              )}
            </button>
          </div>
        </>
      )}
    </form>
  )
}

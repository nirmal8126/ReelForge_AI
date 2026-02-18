'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Tag,
  TicketPercent,
  Bell,
  Sparkles,
  AlertTriangle,
  Star,
  Info,
  CheckCircle,
  X,
  Copy,
  MousePointerClick,
  Calendar,
  Wand2,
  Image,
  ImagePlus,
  Type,
  Loader2,
  Upload,
  Film,
  Video,
  Quote,
  Gamepad2,
  Clapperboard,
  Globe,
  RefreshCw,
  LayoutDashboard,
  PanelLeft,
  Maximize2,
  ArrowDownToLine,
  TrendingUp,
  Mail,
  Send,
  Users,
  Play,
  Percent,
  DollarSign,
  Coins,
  FlaskConical,
  Timer,
  MousePointer,
  ScrollText,
  LogOut,
  Clock,
  UserPlus,
  Trophy,
  BarChart3,
  Pause,
  Split,
  Hash,
  Target,
  PieChart as PieChartIcon,
  Award,
  Zap,
  Download,
  Filter,
  Gift,
  Shield,
  Flame,
  Crown,
  Crosshair,
  FileText,
  CalendarDays,
  Link2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Clipboard,
} from 'lucide-react'

/* ─────────────── types ─────────────── */
interface Banner {
  id: string
  title: string
  message: string
  type: string
  contentType: string
  targetModule: string | null
  linkUrl: string | null
  linkText: string | null
  imageUrl: string | null
  bgColor: string | null
  textColor: string | null
  placement: string
  targetPlans: string[] | null
  priority: number
  isActive: boolean
  startsAt: string | null
  expiresAt: string | null
  dismissible: boolean
  triggerType: string
  triggerDelay: number | null
  triggerScrollPercent: number | null
  showFrequency: string
  maxImpressions: number | null
  viewCount: number
  clickCount: number
  createdAt: string
}

interface PromoCode {
  id: string
  code: string
  description: string | null
  discountType: string
  discountValue: number
  bonusCredits: number
  maxUses: number | null
  usedCount: number
  targetPlans: string[] | null
  isActive: boolean
  startsAt: string | null
  expiresAt: string | null
  createdAt: string
  _count: { redemptions: number }
}

interface NotificationBatch {
  title: string
  message: string
  type: string
  linkUrl: string | null
  _count: { id: number }
  _min: { createdAt: string }
}

interface EmailCampaign {
  id: string
  name: string
  subject: string
  body: string
  status: string
  targetPlans: string[] | null
  targetCountries: string[] | null
  scheduledAt: string | null
  sentAt: string | null
  totalRecipients: number
  sentCount: number
  openCount: number
  createdAt: string
}

interface EmailSequence {
  id: string
  name: string
  trigger: string
  isActive: boolean
  createdAt: string
  _count: { steps: number; enrollments: number }
}

interface SequenceStep {
  id: string
  sequenceId: string
  stepOrder: number
  delayDays: number
  subject: string
  body: string
}

interface Experiment {
  id: string
  name: string
  bannerAId: string
  bannerBId: string
  splitPercent: number
  status: string
  winnerBannerId: string | null
  startedAt: string
  endedAt: string | null
  createdAt: string
  bannerA: { id: string; title: string; viewCount: number; clickCount: number; isActive: boolean; placement: string } | null
  bannerB: { id: string; title: string; viewCount: number; clickCount: number; isActive: boolean; placement: string } | null
}

const TRIGGER_TYPES = [
  { value: 'IMMEDIATE', label: 'Immediate', icon: Play, desc: 'Show on page load', color: 'text-green-400' },
  { value: 'DELAY', label: 'Delay', icon: Timer, desc: 'After N seconds', color: 'text-blue-400' },
  { value: 'SCROLL', label: 'Scroll', icon: ScrollText, desc: 'At scroll %', color: 'text-purple-400' },
  { value: 'EXIT_INTENT', label: 'Exit Intent', icon: LogOut, desc: 'Mouse leaves page', color: 'text-red-400' },
  { value: 'IDLE', label: 'Idle', icon: Clock, desc: '30s no activity', color: 'text-yellow-400' },
  { value: 'FIRST_VISIT', label: 'First Visit', icon: UserPlus, desc: 'New visitors only', color: 'text-cyan-400' },
]

const SHOW_FREQUENCIES = [
  { value: 'EVERY_VISIT', label: 'Every Visit' },
  { value: 'ONCE_PER_SESSION', label: 'Once Per Session' },
  { value: 'ONCE', label: 'Once Ever' },
]

const EXPERIMENT_STATUS_COLORS: Record<string, string> = {
  RUNNING: 'bg-green-500/20 text-green-400',
  COMPLETED: 'bg-blue-500/20 text-blue-400',
  STOPPED: 'bg-gray-500/20 text-gray-400',
}

const SEQUENCE_TRIGGERS = [
  { value: 'SIGNUP', label: 'Sign Up', icon: UserPlus, desc: 'When user registers', color: 'text-green-400' },
  { value: 'INACTIVITY_7D', label: '7-Day Inactive', icon: Clock, desc: 'No login for 7 days', color: 'text-yellow-400' },
  { value: 'INACTIVITY_30D', label: '30-Day Inactive', icon: Clock, desc: 'No login for 30 days', color: 'text-orange-400' },
  { value: 'PLAN_EXPIRY', label: 'Plan Expiry', icon: AlertTriangle, desc: 'Subscription ending', color: 'text-red-400' },
  { value: 'FIRST_REEL', label: 'First Reel', icon: Film, desc: 'After first reel created', color: 'text-blue-400' },
  { value: 'UPGRADE', label: 'Upgrade', icon: TrendingUp, desc: 'After plan upgrade', color: 'text-purple-400' },
]

const NOTIF_TYPES = [
  { value: 'INFO', label: 'Info', icon: Info, color: 'text-blue-400' },
  { value: 'SUCCESS', label: 'Success', icon: CheckCircle, color: 'text-green-400' },
  { value: 'WARNING', label: 'Warning', icon: AlertTriangle, color: 'text-yellow-400' },
  { value: 'PROMOTION', label: 'Promotion', icon: Tag, color: 'text-brand-400' },
  { value: 'ANNOUNCEMENT', label: 'Announcement', icon: Bell, color: 'text-purple-400' },
  { value: 'NEW_FEATURE', label: 'New Feature', icon: Sparkles, color: 'text-cyan-400' },
  { value: 'SYSTEM', label: 'System', icon: Info, color: 'text-gray-400' },
]

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400',
  SCHEDULED: 'bg-yellow-500/20 text-yellow-400',
  SENDING: 'bg-blue-500/20 text-blue-400',
  SENT: 'bg-green-500/20 text-green-400',
  FAILED: 'bg-red-500/20 text-red-400',
}

const BANNER_TYPES = [
  { value: 'INFO', label: 'Info', icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { value: 'SUCCESS', label: 'Success', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  { value: 'WARNING', label: 'Warning', icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  { value: 'PROMOTION', label: 'Promotion', icon: Tag, color: 'text-brand-400', bg: 'bg-brand-500/10 border-brand-500/20' },
  { value: 'ANNOUNCEMENT', label: 'Announcement', icon: Bell, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  { value: 'NEW_FEATURE', label: 'New Feature', icon: Sparkles, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
]

const MODULES = [
  { value: '', label: 'Platform (General)', icon: Globe, description: 'About the entire ReelForge AI platform' },
  { value: 'reels', label: 'AI Reels', icon: Film, description: 'Short video reel generation module' },
  { value: 'long_form', label: 'Long-Form Videos', icon: Video, description: '5-30 minute video creation' },
  { value: 'quotes', label: 'AI Quotes', icon: Quote, description: 'Quote image & video generator' },
  { value: 'challenges', label: 'Challenge Reels', icon: Gamepad2, description: 'Quiz & game reel maker' },
  { value: 'cartoon_studio', label: 'Cartoon Studio', icon: Clapperboard, description: 'Animated cartoon series' },
]

const PLACEMENTS = [
  { value: 'DASHBOARD_TOP', label: 'Dashboard Top', icon: LayoutDashboard, description: 'Top of main dashboard' },
  { value: 'DASHBOARD_BOTTOM', label: 'Dashboard Bottom', icon: ArrowDownToLine, description: 'Bottom of main dashboard' },
  { value: 'SIDEBAR', label: 'Sidebar', icon: PanelLeft, description: 'In the side navigation' },
  { value: 'FULL_PAGE_MODAL', label: 'Full Page Modal', icon: Maximize2, description: 'Full-screen overlay' },
]

const PLANS = ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE']

const DISCOUNT_TYPES = [
  { value: 'PERCENTAGE', label: 'Percentage', desc: 'Discount by %', icon: Percent, color: 'brand' },
  { value: 'FIXED_AMOUNT', label: 'Fixed Amount', desc: 'Flat $ off', icon: DollarSign, color: 'emerald' },
  { value: 'CREDIT_BONUS', label: 'Bonus Credits', desc: 'Extra credits', icon: Coins, color: 'amber' },
]

const MARKETING_NAV = [
  { group: 'CONTENT', items: [
    { key: 'banners', label: 'Banners & Announcements', icon: Bell, countKey: 'banners' },
    { key: 'templates', label: 'Email Templates', icon: FileText, countKey: 'templates' },
    { key: 'notifications', label: 'Notifications', icon: Send, countKey: null },
  ]},
  { group: 'CAMPAIGNS', items: [
    { key: 'campaigns', label: 'Email Campaigns', icon: Mail, countKey: 'campaigns' },
    { key: 'sequences', label: 'Sequences', icon: Split, countKey: 'sequences' },
    { key: 'experiments', label: 'A/B Tests', icon: FlaskConical, countKey: 'experiments' },
  ]},
  { group: 'MONETIZATION', items: [
    { key: 'promos', label: 'Promo Codes', icon: TicketPercent, countKey: 'promos' },
    { key: 'referral-campaigns', label: 'Referral Campaigns', icon: Gift, countKey: 'referralCampaigns' },
  ]},
  { group: 'TARGETING', items: [
    { key: 'segments', label: 'Segments', icon: Target, countKey: 'segments' },
  ]},
  { group: 'INSIGHTS', items: [
    { key: 'analytics', label: 'Analytics', icon: BarChart3, countKey: null },
    { key: 'utm-links', label: 'UTM Links', icon: Link2, countKey: 'utmLinks' },
    { key: 'calendar', label: 'Calendar', icon: CalendarDays, countKey: null },
  ]},
]

/* ─────────────── page ─────────────── */
export default function AdminMarketingPage() {
  const [activeTab, setActiveTab] = useState<'banners' | 'promos' | 'notifications' | 'campaigns' | 'experiments' | 'sequences' | 'segments' | 'analytics' | 'referral-campaigns' | 'templates' | 'calendar' | 'utm-links'>('banners')
  const [banners, setBanners] = useState<Banner[]>([])
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Banner modal
  const [bannerModal, setBannerModal] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [bannerForm, setBannerForm] = useState({
    title: '',
    message: '',
    type: 'INFO' as string,
    contentType: 'text' as 'text' | 'image',
    targetModule: '' as string,
    linkUrl: '',
    linkText: '',
    imageUrl: '',
    bgColor: '',
    textColor: '',
    placement: 'DASHBOARD_TOP' as string,
    targetPlans: [] as string[],
    priority: 0,
    isActive: true,
    startsAt: '',
    expiresAt: '',
    dismissible: true,
    triggerType: 'IMMEDIATE' as string,
    triggerDelay: null as number | null,
    triggerScrollPercent: null as number | null,
    showFrequency: 'EVERY_VISIT' as string,
    maxImpressions: null as number | null,
    goal: '', // optional AI context
  })
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Promo modal
  const [promoModal, setPromoModal] = useState(false)
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null)
  const [generatingPromo, setGeneratingPromo] = useState(false)
  const [promoForm, setPromoForm] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE' as string,
    discountValue: 0,
    bonusCredits: 0,
    maxUses: null as number | null,
    targetPlans: [] as string[],
    isActive: true,
    startsAt: '',
    expiresAt: '',
  })

  // Notifications
  const [notifBatches, setNotifBatches] = useState<NotificationBatch[]>([])
  const [notifModal, setNotifModal] = useState(false)
  const [sendingNotif, setSendingNotif] = useState(false)
  const [generatingNotif, setGeneratingNotif] = useState(false)
  const [notifForm, setNotifForm] = useState({
    title: '', message: '', type: 'INFO',
    linkUrl: '', targetType: 'all' as 'all' | 'plans' | 'countries' | 'user',
    targetPlans: [] as string[], targetCountries: '',
    targetUserId: '',
  })

  // Email Campaigns
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [campaignModal, setCampaignModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaign | null>(null)
  const [campaignForm, setCampaignForm] = useState({
    name: '', subject: '', body: '',
    targetPlans: [] as string[], targetCountries: '',
    scheduledAt: '',
  })
  const [sendingCampaign, setSendingCampaign] = useState(false)
  const [generatingCampaign, setGeneratingCampaign] = useState(false)

  // A/B Experiments
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [experimentModal, setExperimentModal] = useState(false)
  const [experimentForm, setExperimentForm] = useState({
    name: '',
    bannerAId: '',
    bannerBId: '',
    splitPercent: 50,
  })
  const [savingExperiment, setSavingExperiment] = useState(false)

  // Email Sequences
  const [sequences, setSequences] = useState<EmailSequence[]>([])
  const [sequenceModal, setSequenceModal] = useState(false)
  const [editingSequence, setEditingSequence] = useState<EmailSequence | null>(null)
  const [sequenceForm, setSequenceForm] = useState({
    name: '',
    trigger: 'SIGNUP' as string,
    isActive: true,
  })
  const [savingSequence, setSavingSequence] = useState(false)
  const [stepsModal, setStepsModal] = useState<{ sequenceId: string; sequenceName: string } | null>(null)
  const [steps, setSteps] = useState<SequenceStep[]>([])
  const [stepForm, setStepForm] = useState({ stepOrder: 0, delayDays: 0, subject: '', body: '' })
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null)
  const [savingStep, setSavingStep] = useState(false)
  const [generatingSequence, setGeneratingSequence] = useState(false)

  // User Segments
  const [segments, setSegments] = useState<any[]>([])
  const [segmentModal, setSegmentModal] = useState(false)
  const [editingSegment, setEditingSegment] = useState<any>(null)
  const [segmentForm, setSegmentForm] = useState({
    name: '',
    description: '',
    match: 'all' as 'all' | 'any',
    conditions: [{ field: 'plan', operator: 'in', value: [] as any }] as Array<{ field: string; operator: string; value: any }>,
    isActive: true,
  })
  const [savingSegment, setSavingSegment] = useState(false)
  const [segmentPreview, setSegmentPreview] = useState<{ count: number; loading: boolean }>({ count: 0, loading: false })

  // Analytics
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsDateRange, setAnalyticsDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  })

  // Referral Campaigns
  const [referralCampaigns, setReferralCampaigns] = useState<any[]>([])
  const [referralCampaignModal, setReferralCampaignModal] = useState(false)
  const [editingReferralCampaign, setEditingReferralCampaign] = useState<any>(null)
  const [referralCampaignForm, setReferralCampaignForm] = useState({
    name: '',
    description: '',
    creditMultiplier: 2,
    bonusCredits: 0,
    cashMultiplier: 1,
    status: 'DRAFT' as string,
    startsAt: '',
    endsAt: '',
    targetSegmentId: '' as string,
  })
  const [savingReferralCampaign, setSavingReferralCampaign] = useState(false)
  const [badgeCounts, setBadgeCounts] = useState<any[]>([])

  // Email Templates
  const [templates, setTemplates] = useState<any[]>([])
  const [templateModal, setTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [templateForm, setTemplateForm] = useState({
    name: '', category: 'CUSTOM' as string, subject: '', body: '', isActive: true,
  })
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templatePreview, setTemplatePreview] = useState<{ html: string; subject: string } | null>(null)
  const [generatingTemplate, setGeneratingTemplate] = useState(false)
  const [templateDescription, setTemplateDescription] = useState('')

  // Marketing Calendar
  const [calendarEvents, setCalendarEvents] = useState<any[]>([])
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [calendarEventModal, setCalendarEventModal] = useState(false)
  const [calendarEventForm, setCalendarEventForm] = useState({ title: '', description: '', date: '', endDate: '', color: '#6B7280' })
  const [savingCalendarEvent, setSavingCalendarEvent] = useState(false)

  // UTM Links
  const [utmLinks, setUtmLinks] = useState<any[]>([])
  const [utmModal, setUtmModal] = useState(false)
  const [editingUtmLink, setEditingUtmLink] = useState<any>(null)
  const [utmForm, setUtmForm] = useState({
    destinationUrl: '', utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '', isActive: true,
  })
  const [savingUtmLink, setSavingUtmLink] = useState(false)
  const [utmStatsModal, setUtmStatsModal] = useState<any>(null)
  const [utmStats, setUtmStats] = useState<any>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'banner' | 'promo' | 'campaign'; id: string; name: string } | null>(null)

  useEffect(() => {
    fetchBanners()
    fetchPromos()
    fetchNotifBatches()
    fetchCampaigns()
    fetchExperiments()
    fetchSequences()
    fetchSegments()
    fetchReferralCampaigns()
    fetchBadgeCounts()
  }, [])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  async function fetchBanners() {
    try {
      const res = await fetch('/api/admin/marketing/banners')
      const data = await res.json()
      setBanners(data.banners || [])
    } catch {
      setToast({ type: 'error', message: 'Failed to load banners' })
    } finally {
      setLoading(false)
    }
  }

  async function fetchPromos() {
    try {
      const res = await fetch('/api/admin/marketing/promos')
      const data = await res.json()
      setPromos(data.promos || [])
    } catch {
      setToast({ type: 'error', message: 'Failed to load promo codes' })
    }
  }

  async function fetchNotifBatches() {
    try {
      const res = await fetch('/api/admin/notifications')
      const data = await res.json()
      setNotifBatches(data.batches || [])
    } catch {}
  }

  async function fetchCampaigns() {
    try {
      const res = await fetch('/api/admin/marketing/campaigns')
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch {}
  }

  async function fetchExperiments() {
    try {
      const res = await fetch('/api/admin/marketing/experiments')
      const data = await res.json()
      setExperiments(data.experiments || [])
    } catch {}
  }

  async function fetchSequences() {
    try {
      const res = await fetch('/api/admin/marketing/sequences')
      const data = await res.json()
      setSequences(data.sequences || [])
    } catch {}
  }

  async function fetchSegments() {
    try {
      const res = await fetch('/api/admin/marketing/segments')
      const data = await res.json()
      setSegments(data.segments || [])
    } catch {}
  }

  async function fetchAnalytics() {
    setAnalyticsLoading(true)
    try {
      const res = await fetch(`/api/admin/marketing/analytics?dateFrom=${analyticsDateRange.from}&dateTo=${analyticsDateRange.to}`)
      const data = await res.json()
      setAnalyticsData(data)
    } catch {}
    setAnalyticsLoading(false)
  }

  async function fetchReferralCampaigns() {
    try {
      const res = await fetch('/api/admin/marketing/referral-campaigns')
      const data = await res.json()
      setReferralCampaigns(data.campaigns || [])
    } catch {}
  }

  async function fetchBadgeCounts() {
    try {
      const res = await fetch('/api/admin/marketing/badges')
      const data = await res.json()
      setBadgeCounts(data.badges || [])
    } catch {}
  }

  // Email Templates
  async function fetchTemplates() {
    try {
      const res = await fetch('/api/admin/marketing/templates')
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch {}
  }

  function openTemplateCreate() {
    setEditingTemplate(null)
    setTemplateForm({ name: '', category: 'CUSTOM', subject: '', body: '', isActive: true })
    setTemplatePreview(null)
    setTemplateDescription('')
    setTemplateModal(true)
  }

  function openTemplateEdit(t: any) {
    setEditingTemplate(t)
    setTemplateForm({ name: t.name, category: t.category, subject: t.subject, body: t.body, isActive: t.isActive })
    setTemplatePreview(null)
    setTemplateDescription('')
    setTemplateModal(true)
  }

  async function saveTemplate() {
    setSavingTemplate(true)
    try {
      const method = editingTemplate ? 'PUT' : 'POST'
      const payload = editingTemplate ? { id: editingTemplate.id, ...templateForm } : templateForm
      const res = await fetch('/api/admin/marketing/templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Save failed')
      setTemplateModal(false)
      fetchTemplates()
      showToast('success', editingTemplate ? 'Template updated' : 'Template created')
    } catch {
      showToast('error', 'Failed to save template')
    } finally {
      setSavingTemplate(false)
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return
    try {
      await fetch(`/api/admin/marketing/templates?id=${id}`, { method: 'DELETE' })
      fetchTemplates()
      showToast('success', 'Template deleted')
    } catch {
      showToast('error', 'Failed to delete')
    }
  }

  async function previewTemplate() {
    if (!editingTemplate?.id) return
    try {
      const res = await fetch(`/api/admin/marketing/templates/${editingTemplate.id}/preview`)
      const data = await res.json()
      setTemplatePreview({ html: data.html, subject: data.subject })
    } catch {}
  }

  async function generateTemplateAI() {
    if (!templateDescription.trim()) return
    setGeneratingTemplate(true)
    try {
      const res = await fetch('/api/admin/marketing/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: templateDescription, category: templateForm.category }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      setTemplateForm((prev) => ({
        ...prev,
        subject: data.subject || prev.subject,
        body: data.body || prev.body,
      }))
      showToast('success', 'Template generated with AI')
    } catch {
      showToast('error', 'AI generation failed')
    } finally {
      setGeneratingTemplate(false)
    }
  }

  // Marketing Calendar
  async function fetchCalendarEvents(month?: string) {
    try {
      const m = month || calendarMonth
      const res = await fetch(`/api/admin/marketing/calendar?month=${m}`)
      const data = await res.json()
      setCalendarEvents(data.events || [])
    } catch {}
  }

  async function saveCalendarEvent() {
    setSavingCalendarEvent(true)
    try {
      const res = await fetch('/api/admin/marketing/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calendarEventForm),
      })
      if (!res.ok) throw new Error('Save failed')
      setCalendarEventModal(false)
      fetchCalendarEvents()
      showToast('success', 'Event created')
    } catch {
      showToast('error', 'Failed to create event')
    } finally {
      setSavingCalendarEvent(false)
    }
  }

  async function deleteCalendarEvent(id: string) {
    if (!confirm('Delete this event?')) return
    try {
      await fetch(`/api/admin/marketing/calendar?id=${id}`, { method: 'DELETE' })
      fetchCalendarEvents()
      showToast('success', 'Event deleted')
    } catch {
      showToast('error', 'Failed to delete')
    }
  }

  function navigateMonth(delta: number) {
    const [y, m] = calendarMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setCalendarMonth(newMonth)
    fetchCalendarEvents(newMonth)
  }

  // UTM Links
  async function fetchUtmLinks() {
    try {
      const res = await fetch('/api/admin/marketing/utm-links')
      const data = await res.json()
      setUtmLinks(data.links || [])
    } catch {}
  }

  function openUtmCreate() {
    setEditingUtmLink(null)
    setUtmForm({ destinationUrl: '', utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '', isActive: true })
    setUtmModal(true)
  }

  function openUtmEdit(link: any) {
    setEditingUtmLink(link)
    setUtmForm({
      destinationUrl: link.destinationUrl,
      utmSource: link.utmSource,
      utmMedium: link.utmMedium,
      utmCampaign: link.utmCampaign,
      utmTerm: link.utmTerm || '',
      utmContent: link.utmContent || '',
      isActive: link.isActive,
    })
    setUtmModal(true)
  }

  async function saveUtmLink() {
    setSavingUtmLink(true)
    try {
      const method = editingUtmLink ? 'PUT' : 'POST'
      const payload = editingUtmLink ? { id: editingUtmLink.id, ...utmForm } : utmForm
      const res = await fetch('/api/admin/marketing/utm-links', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Save failed')
      setUtmModal(false)
      fetchUtmLinks()
      showToast('success', editingUtmLink ? 'UTM link updated' : 'UTM link created')
    } catch {
      showToast('error', 'Failed to save UTM link')
    } finally {
      setSavingUtmLink(false)
    }
  }

  async function deleteUtmLink(id: string) {
    if (!confirm('Delete this UTM link?')) return
    try {
      await fetch(`/api/admin/marketing/utm-links?id=${id}`, { method: 'DELETE' })
      fetchUtmLinks()
      showToast('success', 'UTM link deleted')
    } catch {
      showToast('error', 'Failed to delete')
    }
  }

  async function fetchUtmStats(link: any) {
    setUtmStatsModal(link)
    setUtmStats(null)
    try {
      const res = await fetch(`/api/admin/marketing/utm-links/${link.id}/stats`)
      const data = await res.json()
      setUtmStats(data.stats)
    } catch {}
  }

  function copyUtmShortLink(shortCode: string) {
    const url = `${window.location.origin}/api/r/${shortCode}`
    navigator.clipboard.writeText(url)
    setCopiedLink(shortCode)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
  }

  function getNavCount(countKey: string | null): number | null {
    if (!countKey) return null
    const counts: Record<string, number> = {
      banners: banners.length,
      promos: promos.length,
      campaigns: campaigns.length,
      experiments: experiments.length,
      sequences: sequences.length,
      segments: segments.length,
      templates: templates.length,
      utmLinks: utmLinks.length,
      referralCampaigns: referralCampaigns.length,
    }
    return counts[countKey] ?? null
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab as typeof activeTab)
    setSearchQuery('')
    if (tab === 'segments' && !segments.length) fetchSegments()
    if (tab === 'analytics' && !analyticsData) fetchAnalytics()
    if (tab === 'referral-campaigns' && !referralCampaigns.length) fetchReferralCampaigns()
    if (tab === 'templates' && !templates.length) fetchTemplates()
    if (tab === 'calendar') fetchCalendarEvents()
    if (tab === 'utm-links' && !utmLinks.length) fetchUtmLinks()
  }

  /* ── Filtered data for search ── */
  const sq = searchQuery.toLowerCase()
  const filteredBanners = sq ? banners.filter(b => b.title.toLowerCase().includes(sq) || b.message.toLowerCase().includes(sq)) : banners
  const filteredPromos = sq ? promos.filter(p => p.code.toLowerCase().includes(sq) || (p.description || '').toLowerCase().includes(sq)) : promos
  const filteredCampaigns = sq ? campaigns.filter(c => c.name.toLowerCase().includes(sq) || c.subject.toLowerCase().includes(sq)) : campaigns
  const filteredSequences = sq ? sequences.filter(s => s.name.toLowerCase().includes(sq)) : sequences
  const filteredExperiments = sq ? experiments.filter(e => e.name.toLowerCase().includes(sq)) : experiments
  const filteredSegments = sq ? segments.filter((s: any) => s.name.toLowerCase().includes(sq)) : segments
  const filteredTemplates = sq ? templates.filter((t: any) => t.name.toLowerCase().includes(sq) || (t.subject || '').toLowerCase().includes(sq)) : templates
  const filteredUtmLinks = sq ? utmLinks.filter((l: any) => l.destinationUrl.toLowerCase().includes(sq) || l.utmCampaign.toLowerCase().includes(sq) || l.utmSource.toLowerCase().includes(sq)) : utmLinks
  const filteredReferralCampaigns = sq ? referralCampaigns.filter((rc: any) => rc.name.toLowerCase().includes(sq)) : referralCampaigns

  /* ── AI Auto-Generate ── */
  async function handleAutoGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bannerType: bannerForm.type,
          targetModule: bannerForm.targetModule || null,
          goal: bannerForm.goal || undefined,
        }),
      })

      if (!res.ok) throw new Error('Generation failed')

      const data = await res.json()
      const gen = data.generated

      if (gen) {
        setBannerForm((prev) => ({
          ...prev,
          title: gen.title || prev.title,
          message: gen.message || prev.message,
          linkText: gen.linkText || prev.linkText,
          linkUrl: gen.suggestedLink || prev.linkUrl,
        }))
        showToast('success', 'AI generated banner content!')
      }
    } catch {
      showToast('error', 'Auto-generate failed. Check API keys.')
    } finally {
      setGenerating(false)
    }
  }

  /* ── AI Image Generate ── */
  async function handleGenerateImage() {
    setGeneratingImage(true)
    try {
      const res = await fetch('/api/admin/marketing/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bannerForm.title || 'Marketing Banner',
          message: bannerForm.message || '',
          bannerType: bannerForm.type,
          targetModule: bannerForm.targetModule || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Image generation failed')
      }

      const data = await res.json()
      if (data.imageUrl) {
        setBannerForm((prev) => ({ ...prev, imageUrl: data.imageUrl }))
        showToast('success', 'AI generated banner image!')
      }
    } catch (err: any) {
      showToast('error', err.message || 'AI image generation failed')
    } finally {
      setGeneratingImage(false)
    }
  }

  /* ── Image Upload ── */
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      showToast('error', 'Invalid file type. Use PNG, JPEG, WebP, or SVG')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'File too large. Maximum 2MB')
      return
    }

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)

      const res = await fetch('/api/admin/settings/upload-logo', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()
      setBannerForm((prev) => ({ ...prev, imageUrl: data.url }))
      showToast('success', 'Image uploaded')
    } catch {
      showToast('error', 'Image upload failed')
    } finally {
      setUploadingImage(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  /* ── Banner CRUD ── */
  function openBannerCreate() {
    setEditingBanner(null)
    setBannerForm({
      title: '', message: '', type: 'INFO', contentType: 'text',
      targetModule: '', linkUrl: '', linkText: '', imageUrl: '',
      bgColor: '', textColor: '', placement: 'DASHBOARD_TOP',
      targetPlans: [], priority: 0, isActive: true,
      startsAt: '', expiresAt: '', dismissible: true,
      triggerType: 'IMMEDIATE', triggerDelay: null,
      triggerScrollPercent: null, showFrequency: 'EVERY_VISIT',
      maxImpressions: null, goal: '',
    })
    setBannerModal(true)
  }

  function openBannerEdit(banner: Banner) {
    setEditingBanner(banner)
    setBannerForm({
      title: banner.title,
      message: banner.message,
      type: banner.type,
      contentType: (banner.contentType as 'text' | 'image') || 'text',
      targetModule: banner.targetModule || '',
      linkUrl: banner.linkUrl || '',
      linkText: banner.linkText || '',
      imageUrl: banner.imageUrl || '',
      bgColor: banner.bgColor || '',
      textColor: banner.textColor || '',
      placement: banner.placement,
      targetPlans: banner.targetPlans || [],
      priority: banner.priority,
      isActive: banner.isActive,
      startsAt: banner.startsAt ? banner.startsAt.slice(0, 16) : '',
      expiresAt: banner.expiresAt ? banner.expiresAt.slice(0, 16) : '',
      dismissible: banner.dismissible,
      triggerType: banner.triggerType || 'IMMEDIATE',
      triggerDelay: banner.triggerDelay,
      triggerScrollPercent: banner.triggerScrollPercent,
      showFrequency: banner.showFrequency || 'EVERY_VISIT',
      maxImpressions: banner.maxImpressions,
      goal: '',
    })
    setBannerModal(true)
  }

  async function saveBanner() {
    setSaving(true)
    try {
      const payload = {
        title: bannerForm.title,
        message: bannerForm.message,
        type: bannerForm.type,
        contentType: bannerForm.contentType,
        targetModule: bannerForm.targetModule || null,
        linkUrl: bannerForm.linkUrl || null,
        linkText: bannerForm.linkText || null,
        imageUrl: bannerForm.imageUrl || null,
        bgColor: bannerForm.bgColor || null,
        textColor: bannerForm.textColor || null,
        placement: bannerForm.placement,
        targetPlans: bannerForm.targetPlans.length > 0 ? bannerForm.targetPlans : null,
        priority: bannerForm.priority,
        isActive: bannerForm.isActive,
        startsAt: bannerForm.startsAt || null,
        expiresAt: bannerForm.expiresAt || null,
        dismissible: bannerForm.dismissible,
        triggerType: bannerForm.triggerType,
        triggerDelay: bannerForm.triggerType === 'DELAY' ? bannerForm.triggerDelay : null,
        triggerScrollPercent: bannerForm.triggerType === 'SCROLL' ? bannerForm.triggerScrollPercent : null,
        showFrequency: bannerForm.showFrequency,
        maxImpressions: bannerForm.maxImpressions,
      }

      const method = editingBanner ? 'PUT' : 'POST'
      const body = editingBanner ? { id: editingBanner.id, ...payload } : payload

      const res = await fetch('/api/admin/marketing/banners', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }

      showToast('success', editingBanner ? 'Banner updated' : 'Banner created')
      setBannerModal(false)
      fetchBanners()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save banner')
    } finally {
      setSaving(false)
    }
  }

  async function toggleBannerActive(banner: Banner) {
    try {
      await fetch('/api/admin/marketing/banners', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: banner.id,
          title: banner.title,
          message: banner.message,
          type: banner.type,
          contentType: banner.contentType || 'text',
          targetModule: banner.targetModule,
          linkUrl: banner.linkUrl,
          linkText: banner.linkText,
          imageUrl: banner.imageUrl,
          bgColor: banner.bgColor,
          textColor: banner.textColor,
          placement: banner.placement,
          targetPlans: banner.targetPlans,
          priority: banner.priority,
          isActive: !banner.isActive,
          startsAt: banner.startsAt,
          expiresAt: banner.expiresAt,
          dismissible: banner.dismissible,
          triggerType: banner.triggerType || 'IMMEDIATE',
          triggerDelay: banner.triggerDelay,
          triggerScrollPercent: banner.triggerScrollPercent,
          showFrequency: banner.showFrequency || 'EVERY_VISIT',
          maxImpressions: banner.maxImpressions,
        }),
      })
      fetchBanners()
    } catch {
      showToast('error', 'Failed to toggle banner')
    }
  }

  /* ── Promo CRUD ── */
  function openPromoCreate() {
    setEditingPromo(null)
    setPromoForm({
      code: '', description: '', discountType: 'PERCENTAGE',
      discountValue: 0, bonusCredits: 0, maxUses: null,
      targetPlans: [], isActive: true, startsAt: '', expiresAt: '',
    })
    setPromoModal(true)
  }

  function openPromoEdit(promo: PromoCode) {
    setEditingPromo(promo)
    setPromoForm({
      code: promo.code,
      description: promo.description || '',
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      bonusCredits: promo.bonusCredits,
      maxUses: promo.maxUses,
      targetPlans: promo.targetPlans || [],
      isActive: promo.isActive,
      startsAt: promo.startsAt ? promo.startsAt.slice(0, 16) : '',
      expiresAt: promo.expiresAt ? promo.expiresAt.slice(0, 16) : '',
    })
    setPromoModal(true)
  }

  async function handleGeneratePromoIdea() {
    setGeneratingPromo(true)
    try {
      const res = await fetch('/api/admin/marketing/generate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      const gen = data.generated
      if (gen) {
        const now = new Date()
        const validDays = gen.validDays || 14
        const expiresDate = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000)
        setPromoForm((prev) => ({
          ...prev,
          code: (gen.code || prev.code).toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 20),
          description: gen.description || prev.description,
          discountType: gen.discountType || prev.discountType,
          discountValue: gen.discountValue ?? prev.discountValue,
          bonusCredits: gen.bonusCredits ?? prev.bonusCredits,
          maxUses: gen.maxUses ?? prev.maxUses,
          targetPlans: gen.targetPlans?.length > 0 ? gen.targetPlans : prev.targetPlans,
          startsAt: now.toISOString().slice(0, 16),
          expiresAt: expiresDate.toISOString().slice(0, 16),
        }))
        showToast('success', `AI idea: ${gen.occasion || 'Promo generated'}!`)
      }
    } catch {
      showToast('error', 'Failed to generate promo idea. Check API keys.')
    } finally {
      setGeneratingPromo(false)
    }
  }

  async function savePromo() {
    setSaving(true)
    try {
      const payload = {
        ...promoForm,
        description: promoForm.description || null,
        targetPlans: promoForm.targetPlans.length > 0 ? promoForm.targetPlans : null,
        startsAt: promoForm.startsAt || null,
        expiresAt: promoForm.expiresAt || null,
      }

      const method = editingPromo ? 'PUT' : 'POST'
      const body = editingPromo ? { id: editingPromo.id, ...payload } : payload

      const res = await fetch('/api/admin/marketing/promos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }

      showToast('success', editingPromo ? 'Promo code updated' : 'Promo code created')
      setPromoModal(false)
      fetchPromos()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save promo code')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const endpoints: Record<string, string> = {
        banner: `/api/admin/marketing/banners?id=${deleteTarget.id}`,
        promo: `/api/admin/marketing/promos?id=${deleteTarget.id}`,
        campaign: `/api/admin/marketing/campaigns?id=${deleteTarget.id}`,
      }
      await fetch(endpoints[deleteTarget.type], { method: 'DELETE' })
      showToast('success', `${deleteTarget.type === 'banner' ? 'Banner' : deleteTarget.type === 'promo' ? 'Promo code' : 'Campaign'} deleted`)
      setDeleteTarget(null)
      if (deleteTarget.type === 'banner') fetchBanners()
      else if (deleteTarget.type === 'promo') fetchPromos()
      else fetchCampaigns()
    } catch {
      showToast('error', 'Delete failed')
    }
  }

  /* ── Notification Send ── */
  async function sendNotification() {
    setSendingNotif(true)
    try {
      const target: any = { type: notifForm.targetType }
      if (notifForm.targetType === 'plans') target.plans = notifForm.targetPlans
      if (notifForm.targetType === 'countries') target.countries = notifForm.targetCountries.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
      if (notifForm.targetType === 'user') target.userId = notifForm.targetUserId

      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notifForm.title,
          message: notifForm.message,
          type: notifForm.type,
          linkUrl: notifForm.linkUrl || null,
          target,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }

      const data = await res.json()
      showToast('success', `Notification sent to ${data.count} users`)
      setNotifModal(false)
      setNotifForm({ title: '', message: '', type: 'INFO', linkUrl: '', targetType: 'all', targetPlans: [], targetCountries: '', targetUserId: '' })
      fetchNotifBatches()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to send notification')
    } finally {
      setSendingNotif(false)
    }
  }

  async function handleGenerateNotifIdea() {
    setGeneratingNotif(true)
    try {
      const res = await fetch('/api/admin/marketing/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'notification' }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      const gen = data.generated
      if (gen) {
        setNotifForm((prev) => ({
          ...prev,
          title: gen.title || prev.title,
          message: gen.message || prev.message,
          type: gen.type || prev.type,
          linkUrl: gen.linkUrl || prev.linkUrl,
        }))
        showToast('success', `AI idea: ${gen.occasion || 'Notification generated'}!`)
      }
    } catch {
      showToast('error', 'Failed to generate notification idea. Check API keys.')
    } finally {
      setGeneratingNotif(false)
    }
  }

  async function handleGenerateCampaignIdea() {
    setGeneratingCampaign(true)
    try {
      const res = await fetch('/api/admin/marketing/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'campaign' }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      const gen = data.generated
      if (gen) {
        setCampaignForm((prev) => ({
          ...prev,
          name: gen.name || prev.name,
          subject: gen.subject || prev.subject,
          body: gen.body || prev.body,
        }))
        showToast('success', `AI idea: ${gen.occasion || 'Campaign generated'}!`)
      }
    } catch {
      showToast('error', 'Failed to generate campaign idea. Check API keys.')
    } finally {
      setGeneratingCampaign(false)
    }
  }

  /* ── Campaign CRUD ── */
  function openCampaignCreate() {
    setEditingCampaign(null)
    setCampaignForm({ name: '', subject: '', body: '', targetPlans: [], targetCountries: '', scheduledAt: '' })
    setCampaignModal(true)
  }

  function openCampaignEdit(c: EmailCampaign) {
    setEditingCampaign(c)
    setCampaignForm({
      name: c.name, subject: c.subject, body: c.body,
      targetPlans: c.targetPlans || [],
      targetCountries: c.targetCountries ? (c.targetCountries as string[]).join(', ') : '',
      scheduledAt: c.scheduledAt ? c.scheduledAt.slice(0, 16) : '',
    })
    setCampaignModal(true)
  }

  async function saveCampaign() {
    setSaving(true)
    try {
      const payload = {
        name: campaignForm.name, subject: campaignForm.subject, body: campaignForm.body,
        targetPlans: campaignForm.targetPlans.length > 0 ? campaignForm.targetPlans : null,
        targetCountries: campaignForm.targetCountries ? campaignForm.targetCountries.split(',').map(c => c.trim().toUpperCase()).filter(Boolean) : null,
        scheduledAt: campaignForm.scheduledAt || null,
      }

      const method = editingCampaign ? 'PUT' : 'POST'
      const body = editingCampaign ? { id: editingCampaign.id, ...payload } : payload

      const res = await fetch('/api/admin/marketing/campaigns', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })

      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }

      showToast('success', editingCampaign ? 'Campaign updated' : 'Campaign saved as draft')
      setCampaignModal(false)
      fetchCampaigns()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save campaign')
    } finally {
      setSaving(false)
    }
  }

  async function sendCampaign(id: string) {
    setSendingCampaign(true)
    try {
      const res = await fetch(`/api/admin/marketing/campaigns/${id}/send`, { method: 'POST' })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      const data = await res.json()
      showToast('success', `Campaign sending to ${data.totalRecipients} recipients`)
      fetchCampaigns()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to send campaign')
    } finally {
      setSendingCampaign(false)
    }
  }

  /* ── Experiment CRUD ── */
  async function saveExperiment() {
    setSavingExperiment(true)
    try {
      const res = await fetch('/api/admin/marketing/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(experimentForm),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      showToast('success', 'Experiment created')
      setExperimentModal(false)
      fetchExperiments()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create experiment')
    } finally {
      setSavingExperiment(false)
    }
  }

  async function stopExperiment(id: string) {
    try {
      await fetch('/api/admin/marketing/experiments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'STOPPED' }),
      })
      showToast('success', 'Experiment stopped')
      fetchExperiments()
    } catch {
      showToast('error', 'Failed to stop experiment')
    }
  }

  async function declareWinner(experimentId: string, winnerId: string) {
    try {
      const res = await fetch(`/api/admin/marketing/experiments/${experimentId}/winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerId }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      showToast('success', 'Winner declared! Losing banner deactivated.')
      fetchExperiments()
      fetchBanners()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to declare winner')
    }
  }

  async function deleteExperiment(id: string) {
    try {
      await fetch(`/api/admin/marketing/experiments?id=${id}`, { method: 'DELETE' })
      showToast('success', 'Experiment deleted')
      fetchExperiments()
    } catch {
      showToast('error', 'Failed to delete experiment')
    }
  }

  /* ── Sequence CRUD ── */
  async function saveSequence() {
    setSavingSequence(true)
    try {
      const method = editingSequence ? 'PUT' : 'POST'
      const body = editingSequence ? { id: editingSequence.id, ...sequenceForm } : sequenceForm
      const res = await fetch('/api/admin/marketing/sequences', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      showToast('success', editingSequence ? 'Sequence updated' : 'Sequence created')
      setSequenceModal(false)
      fetchSequences()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save sequence')
    } finally {
      setSavingSequence(false)
    }
  }

  async function deleteSequence(id: string) {
    try {
      await fetch(`/api/admin/marketing/sequences?id=${id}`, { method: 'DELETE' })
      showToast('success', 'Sequence deleted')
      fetchSequences()
    } catch {
      showToast('error', 'Failed to delete sequence')
    }
  }

  async function toggleSequenceActive(seq: EmailSequence) {
    try {
      await fetch('/api/admin/marketing/sequences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: seq.id, name: seq.name, trigger: seq.trigger, isActive: !seq.isActive }),
      })
      fetchSequences()
    } catch {
      showToast('error', 'Failed to toggle sequence')
    }
  }

  async function openStepsEditor(seq: EmailSequence) {
    setStepsModal({ sequenceId: seq.id, sequenceName: seq.name })
    setEditingStep(null)
    setStepForm({ stepOrder: 0, delayDays: 0, subject: '', body: '' })
    try {
      const res = await fetch(`/api/admin/marketing/sequences/${seq.id}/steps`)
      const data = await res.json()
      setSteps(data.steps || [])
    } catch {
      showToast('error', 'Failed to load steps')
    }
  }

  async function saveStep() {
    if (!stepsModal) return
    setSavingStep(true)
    try {
      const method = editingStep ? 'PUT' : 'POST'
      const body = editingStep
        ? { stepId: editingStep.id, ...stepForm }
        : stepForm
      const res = await fetch(`/api/admin/marketing/sequences/${stepsModal.sequenceId}/steps`, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
      showToast('success', editingStep ? 'Step updated' : 'Step added')
      setEditingStep(null)
      setStepForm({ stepOrder: steps.length, delayDays: 0, subject: '', body: '' })
      // Refetch steps
      const res2 = await fetch(`/api/admin/marketing/sequences/${stepsModal.sequenceId}/steps`)
      const data = await res2.json()
      setSteps(data.steps || [])
      fetchSequences()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save step')
    } finally {
      setSavingStep(false)
    }
  }

  async function deleteStep(stepId: string) {
    if (!stepsModal) return
    try {
      await fetch(`/api/admin/marketing/sequences/${stepsModal.sequenceId}/steps?stepId=${stepId}`, { method: 'DELETE' })
      setSteps((prev) => prev.filter((s) => s.id !== stepId))
      showToast('success', 'Step deleted')
      fetchSequences()
    } catch {
      showToast('error', 'Failed to delete step')
    }
  }

  async function handleGenerateSequenceIdea() {
    setGeneratingSequence(true)
    try {
      const res = await fetch('/api/admin/marketing/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'sequence', trigger: sequenceForm.trigger }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      const gen = data.generated
      if (gen) {
        setSequenceForm((prev) => ({
          ...prev,
          name: gen.name || prev.name,
        }))
        // If steps were generated, we can auto-populate them later
        if (gen.steps && stepsModal) {
          setSteps(gen.steps.map((s: any, i: number) => ({
            id: `temp-${i}`,
            sequenceId: stepsModal.sequenceId,
            stepOrder: i,
            delayDays: s.delayDays ?? i * 3,
            subject: s.subject || '',
            body: s.body || '',
          })))
        }
        showToast('success', `AI idea: ${gen.occasion || 'Sequence generated'}!`)
      }
    } catch {
      showToast('error', 'Failed to generate sequence idea. Check API keys.')
    } finally {
      setGeneratingSequence(false)
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    showToast('success', `Copied "${code}" to clipboard`)
  }

  function getBannerTypeInfo(type: string) {
    return BANNER_TYPES.find((t) => t.value === type) || BANNER_TYPES[0]
  }

  function getModuleInfo(moduleId: string | null) {
    return MODULES.find((m) => m.value === (moduleId || '')) || MODULES[0]
  }

  function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function getStatusBadge(isActive: boolean, startsAt: string | null, expiresAt: string | null) {
    const now = new Date()
    if (!isActive) return { label: 'Inactive', color: 'bg-gray-500/20 text-gray-400' }
    if (startsAt && new Date(startsAt) > now) return { label: 'Scheduled', color: 'bg-yellow-500/20 text-yellow-400' }
    if (expiresAt && new Date(expiresAt) < now) return { label: 'Expired', color: 'bg-red-500/20 text-red-400' }
    return { label: 'Active', color: 'bg-green-500/20 text-green-400' }
  }

  /* ── Segment CRUD ── */
  async function saveSegment() {
    setSavingSegment(true)
    try {
      const payload = {
        name: segmentForm.name,
        description: segmentForm.description || null,
        rules: { conditions: segmentForm.conditions, match: segmentForm.match },
        isActive: segmentForm.isActive,
      }
      const method = editingSegment ? 'PUT' : 'POST'
      const body = editingSegment ? { id: editingSegment.id, ...payload } : payload
      const res = await fetch('/api/admin/marketing/segments', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save segment')
      showToast('success', editingSegment ? 'Segment updated' : 'Segment created')
      setSegmentModal(false)
      setEditingSegment(null)
      fetchSegments()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save segment')
    }
    setSavingSegment(false)
  }

  async function deleteSegment(id: string) {
    if (!confirm('Delete this segment?')) return
    try {
      await fetch(`/api/admin/marketing/segments?id=${id}`, { method: 'DELETE' })
      showToast('success', 'Segment deleted')
      fetchSegments()
    } catch {
      showToast('error', 'Failed to delete segment')
    }
  }

  async function previewSegment() {
    if (!editingSegment?.id) return
    setSegmentPreview({ count: 0, loading: true })
    try {
      const res = await fetch(`/api/admin/marketing/segments/${editingSegment.id}/preview`)
      const data = await res.json()
      setSegmentPreview({ count: data.count || 0, loading: false })
    } catch {
      setSegmentPreview({ count: 0, loading: false })
    }
  }

  function openSegmentCreate() {
    setEditingSegment(null)
    setSegmentForm({ name: '', description: '', match: 'all', conditions: [{ field: 'plan', operator: 'in', value: [] }], isActive: true })
    setSegmentPreview({ count: 0, loading: false })
    setSegmentModal(true)
  }

  function openSegmentEdit(seg: any) {
    setEditingSegment(seg)
    const rules = seg.rules || { conditions: [], match: 'all' }
    setSegmentForm({
      name: seg.name,
      description: seg.description || '',
      match: rules.match || 'all',
      conditions: rules.conditions?.length ? rules.conditions : [{ field: 'plan', operator: 'in', value: [] }],
      isActive: seg.isActive,
    })
    setSegmentPreview({ count: seg.cachedCount || 0, loading: false })
    setSegmentModal(true)
  }

  /* ── Referral Campaign CRUD ── */
  async function saveReferralCampaign() {
    setSavingReferralCampaign(true)
    try {
      const method = editingReferralCampaign ? 'PUT' : 'POST'
      const body = editingReferralCampaign
        ? { id: editingReferralCampaign.id, ...referralCampaignForm }
        : referralCampaignForm
      const res = await fetch('/api/admin/marketing/referral-campaigns', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save campaign')
      showToast('success', editingReferralCampaign ? 'Campaign updated' : 'Campaign created')
      setReferralCampaignModal(false)
      setEditingReferralCampaign(null)
      fetchReferralCampaigns()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save referral campaign')
    }
    setSavingReferralCampaign(false)
  }

  async function deleteReferralCampaign(id: string) {
    if (!confirm('Delete this referral campaign?')) return
    try {
      const res = await fetch(`/api/admin/marketing/referral-campaigns?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      showToast('success', 'Campaign deleted')
      fetchReferralCampaigns()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete campaign')
    }
  }

  function openReferralCampaignCreate() {
    setEditingReferralCampaign(null)
    setReferralCampaignForm({
      name: '', description: '', creditMultiplier: 2, bonusCredits: 0,
      cashMultiplier: 1, status: 'DRAFT', startsAt: '', endsAt: '', targetSegmentId: '',
    })
    setReferralCampaignModal(true)
  }

  function openReferralCampaignEdit(c: any) {
    setEditingReferralCampaign(c)
    setReferralCampaignForm({
      name: c.name,
      description: c.description || '',
      creditMultiplier: c.creditMultiplier,
      bonusCredits: c.bonusCredits,
      cashMultiplier: c.cashMultiplier,
      status: c.status,
      startsAt: c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 16) : '',
      endsAt: c.endsAt ? new Date(c.endsAt).toISOString().slice(0, 16) : '',
      targetSegmentId: c.targetSegmentId || '',
    })
    setReferralCampaignModal(true)
  }

  const SEGMENT_FIELDS = [
    { value: 'plan', label: 'Subscription Plan', operators: ['in', 'notIn'], type: 'multiselect', options: ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'] },
    { value: 'country', label: 'Country', operators: ['in', 'notIn'], type: 'text' },
    { value: 'referralTier', label: 'Referral Tier', operators: ['eq', 'in'], type: 'multiselect', options: ['FREE', 'AFFILIATE', 'PARTNER'] },
    { value: 'creditsBalance', label: 'Credits Balance', operators: ['gte', 'lte', 'gt', 'lt', 'eq'], type: 'number' },
    { value: 'totalReferrals', label: 'Total Referrals', operators: ['gte', 'lte', 'gt', 'lt', 'eq'], type: 'number' },
    { value: 'createdAt', label: 'Signed Up', operators: ['gte', 'lte', 'between'], type: 'date' },
    { value: 'lastLoginAt', label: 'Last Login', operators: ['gte', 'lte', 'between'], type: 'date' },
    { value: 'jobsUsed', label: 'Jobs Used', operators: ['gte', 'lte', 'gt', 'lt', 'eq'], type: 'number' },
  ]

  const OPERATOR_LABELS: Record<string, string> = {
    eq: 'equals', neq: 'not equals', in: 'is one of', notIn: 'is not one of',
    gt: 'greater than', gte: 'at least', lt: 'less than', lte: 'at most', between: 'between',
  }

  const BADGE_INFO: Record<string, { label: string; icon: any; color: string; desc: string }> = {
    FIRST_REFERRAL: { label: 'First Referral', icon: UserPlus, color: 'text-green-400', desc: '1 referral' },
    REFERRAL_5: { label: '5 Referrals', icon: Users, color: 'text-blue-400', desc: '5 referrals' },
    REFERRAL_25: { label: '25 Referrals', icon: Trophy, color: 'text-purple-400', desc: '25 referrals' },
    POWER_REFERRER_100: { label: 'Power Referrer', icon: Crown, color: 'text-yellow-400', desc: '100 referrals' },
    FIRST_REEL: { label: 'First Reel', icon: Film, color: 'text-cyan-400', desc: '1 completed reel' },
    REEL_MASTER_50: { label: 'Reel Master', icon: Award, color: 'text-pink-400', desc: '50 completed reels' },
    EARLY_ADOPTER: { label: 'Early Adopter', icon: Shield, color: 'text-orange-400', desc: 'Joined early' },
    STREAK_7D: { label: '7-Day Streak', icon: Flame, color: 'text-red-400', desc: '7 consecutive days' },
  }

  const REFERRAL_CAMPAIGN_STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-gray-500/20 text-gray-400',
    ACTIVE: 'bg-green-500/20 text-green-400',
    COMPLETED: 'bg-blue-500/20 text-blue-400',
    CANCELLED: 'bg-red-500/20 text-red-400',
  }

  /* ─── render ─── */
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl text-sm font-medium shadow-xl border ${
          toast.type === 'success'
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center border border-pink-500/10">
            <Megaphone className="h-5 w-5 text-pink-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Marketing & Promotions</h1>
            <p className="text-sm text-gray-500">Manage banners, announcements, and promo codes</p>
          </div>
        </div>
      </div>

      {/* Main layout: Sidebar + Content */}
      <div className="flex rounded-xl border border-white/[0.06] overflow-hidden min-h-[calc(100vh-12rem)]">

        {/* ── Left Sidebar Navigation ── */}
        <div className="w-60 flex-shrink-0 bg-white/[0.02] border-r border-white/[0.06] p-3">
          {MARKETING_NAV.map((group) => (
            <div key={group.group}>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 px-3 pt-4 pb-1.5">
                {group.group}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon
                const count = getNavCount(item.countKey)
                const isActive = activeTab === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => handleTabChange(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-brand-500/10 text-brand-400'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {count !== null && count > 0 && (
                      <span className="ml-auto text-xs bg-white/[0.06] px-1.5 py-0.5 rounded-md flex-shrink-0">
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* ── Right Content Area ── */}
        <div className="flex-1 p-6 overflow-auto">

      {/* ═══════════════ Banners Tab ═══════════════ */}
      {activeTab === 'banners' && (
        <div className="space-y-4">
          {/* Analytics Stats */}
          {(() => {
            const totalViews = banners.reduce((s, b) => s + b.viewCount, 0)
            const totalClicks = banners.reduce((s, b) => s + b.clickCount, 0)
            const overallCTR = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0.0'
            const activeCount = banners.filter(b => b.isActive).length
            return (
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-4 w-4 text-blue-400" />
                    <span className="text-[11px] text-gray-500 font-medium">Total Views</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{totalViews.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MousePointerClick className="h-4 w-4 text-green-400" />
                    <span className="text-[11px] text-gray-500 font-medium">Total Clicks</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{totalClicks.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-purple-400" />
                    <span className="text-[11px] text-gray-500 font-medium">Overall CTR</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{overallCTR}%</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="h-4 w-4 text-brand-400" />
                    <span className="text-[11px] text-gray-500 font-medium">Active Banners</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{activeCount}</p>
                </div>
              </div>
            )
          })()}

          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">
              Create banners and announcements shown to users on their dashboard
            </p>
            <button
              onClick={openBannerCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition"
            >
              <Plus className="h-4 w-4" /> New Banner
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input type="text" placeholder="Search banners..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20" />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="h-4 w-4" /></button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : filteredBanners.length === 0 && banners.length > 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No banners match &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : banners.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <Bell className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No banners yet</p>
              <p className="text-sm text-gray-500 mt-1">Create your first banner to engage users</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBanners.map((banner) => {
                const typeInfo = getBannerTypeInfo(banner.type)
                const moduleInfo = getModuleInfo(banner.targetModule)
                const status = getStatusBadge(banner.isActive, banner.startsAt, banner.expiresAt)
                const TypeIcon = typeInfo.icon
                return (
                  <div
                    key={banner.id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.03] transition"
                  >
                    <div className="flex items-start gap-4">
                      {/* Image or type icon */}
                      {banner.contentType === 'image' && banner.imageUrl ? (
                        <div className="h-16 w-24 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.04]">
                          <img src={banner.imageUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className={`h-10 w-10 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0 ${typeInfo.color}`}>
                          <TypeIcon className="h-5 w-5" />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-semibold text-white truncate">{banner.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.color}`}>
                            {status.label}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/[0.06] text-[10px] text-gray-400">
                            {banner.contentType === 'image' ? 'Image' : 'Text'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/[0.06] text-[10px] text-gray-400">
                            {banner.placement.replace(/_/g, ' ')}
                          </span>
                          {banner.targetModule && (
                            <span className="px-2 py-0.5 rounded bg-purple-500/10 text-[10px] text-purple-400 font-medium">
                              {moduleInfo.label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-1 mb-2">{banner.message}</p>
                        <div className="flex items-center gap-4 text-[11px] text-gray-500">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" /> {banner.viewCount} views
                          </span>
                          <span className="flex items-center gap-1">
                            <MousePointerClick className="h-3 w-3" /> {banner.clickCount} clicks
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> {banner.viewCount > 0 ? ((banner.clickCount / banner.viewCount) * 100).toFixed(1) : '0.0'}% CTR
                          </span>
                          {banner.targetPlans && banner.targetPlans.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3" /> {(banner.targetPlans as string[]).join(', ')}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Priority: {banner.priority}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => toggleBannerActive(banner)}
                          className="p-2 rounded-lg hover:bg-white/[0.06] transition"
                          title={banner.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {banner.isActive ? (
                            <Eye className="h-4 w-4 text-green-400" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                        <button
                          onClick={() => openBannerEdit(banner)}
                          className="p-2 rounded-lg hover:bg-white/[0.06] transition"
                        >
                          <Pencil className="h-4 w-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ type: 'banner', id: banner.id, name: banner.title })}
                          className="p-2 rounded-lg hover:bg-red-500/10 transition"
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Promos Tab ═══════════════ */}
      {activeTab === 'promos' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">
              Create promo codes for discounts and credit bonuses
            </p>
            <button
              onClick={openPromoCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition"
            >
              <Plus className="h-4 w-4" /> New Promo Code
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input type="text" placeholder="Search promo codes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20" />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="h-4 w-4" /></button>
            )}
          </div>

          {filteredPromos.length === 0 && promos.length > 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No promo codes match &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : promos.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <TicketPercent className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No promo codes yet</p>
              <p className="text-sm text-gray-500 mt-1">Create promo codes to attract and retain users</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredPromos.map((promo) => {
                const status = getStatusBadge(promo.isActive, promo.startsAt, promo.expiresAt)
                return (
                  <div
                    key={promo.id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.03] transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        <div
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-500/10 border border-brand-500/20 cursor-pointer hover:bg-brand-500/15 transition"
                          onClick={() => copyCode(promo.code)}
                          title="Click to copy"
                        >
                          <Tag className="h-4 w-4 text-brand-400" />
                          <span className="text-sm font-bold text-brand-400 font-mono tracking-wide">
                            {promo.code}
                          </span>
                          <Copy className="h-3 w-3 text-brand-400/50" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${
                            promo.discountType === 'PERCENTAGE' ? 'bg-brand-500/10 text-brand-400' :
                            promo.discountType === 'FIXED_AMOUNT' ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>
                            {promo.discountType === 'PERCENTAGE' && <><Percent className="h-3 w-3" />{promo.discountValue}% Off</>}
                            {promo.discountType === 'FIXED_AMOUNT' && <><DollarSign className="h-3 w-3" />${(promo.discountValue / 100).toFixed(2)} Off</>}
                            {promo.discountType === 'CREDIT_BONUS' && <><Coins className="h-3 w-3" />{promo.bonusCredits} Credits</>}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        {promo.description && (
                          <p className="text-xs text-gray-400 line-clamp-1 mb-1">{promo.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-[11px] text-gray-500">
                          <span>Used: {promo._count.redemptions}{promo.maxUses ? `/${promo.maxUses}` : ''}</span>
                          {promo.targetPlans && (promo.targetPlans as string[]).length > 0 && (
                            <span>Plans: {(promo.targetPlans as string[]).join(', ')}</span>
                          )}
                          {promo.expiresAt && (
                            <span>Expires: {formatDate(promo.expiresAt)}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => openPromoEdit(promo)}
                          className="p-2 rounded-lg hover:bg-white/[0.06] transition"
                        >
                          <Pencil className="h-4 w-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ type: 'promo', id: promo.id, name: promo.code })}
                          className="p-2 rounded-lg hover:bg-red-500/10 transition"
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Notifications Tab ═══════════════ */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">
              Send in-app notifications to your users
            </p>
            <button
              onClick={() => {
                setNotifForm({ title: '', message: '', type: 'INFO', linkUrl: '', targetType: 'all', targetPlans: [], targetCountries: '', targetUserId: '' })
                setNotifModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition"
            >
              <Send className="h-4 w-4" /> Send Notification
            </button>
          </div>

          {notifBatches.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <Send className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No notifications sent yet</p>
              <p className="text-sm text-gray-500 mt-1">Send your first notification to engage users</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifBatches.map((batch, i) => {
                const typeInfo = NOTIF_TYPES.find(t => t.value === batch.type) || NOTIF_TYPES[0]
                const TypeIcon = typeInfo.icon
                return (
                  <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.03] transition">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${typeInfo.color}`}>
                        <TypeIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-white truncate">{batch.title}</h3>
                          <span className="px-2 py-0.5 rounded bg-white/[0.06] text-[10px] text-gray-400">
                            {batch._count.id} recipients
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-1">{batch.message}</p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {new Date(batch._min.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Email Campaigns Tab ═══════════════ */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">
              Create and send email campaigns to your users
            </p>
            <button
              onClick={openCampaignCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition"
            >
              <Plus className="h-4 w-4" /> New Campaign
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input type="text" placeholder="Search campaigns..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20" />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="h-4 w-4" /></button>
            )}
          </div>

          {filteredCampaigns.length === 0 && campaigns.length > 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No campaigns match &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <Mail className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No email campaigns yet</p>
              <p className="text-sm text-gray-500 mt-1">Create your first campaign to reach users via email</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCampaigns.map((c) => (
                <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.03] transition">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-semibold text-white truncate">{c.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CAMPAIGN_STATUS_COLORS[c.status] || CAMPAIGN_STATUS_COLORS.DRAFT}`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-1 mb-2">Subject: {c.subject}</p>
                      <div className="flex items-center gap-4 text-[11px] text-gray-500">
                        {c.status !== 'DRAFT' && (
                          <>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" /> {c.sentCount}/{c.totalRecipients} sent
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" /> {c.openCount} opened
                              {c.sentCount > 0 && ` (${((c.openCount / c.sentCount) * 100).toFixed(1)}%)`}
                            </span>
                          </>
                        )}
                        {c.targetPlans && (
                          <span>Plans: {(c.targetPlans as string[]).join(', ')}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {c.status === 'DRAFT' && (
                        <>
                          <button
                            onClick={() => sendCampaign(c.id)}
                            disabled={sendingCampaign}
                            className="p-2 rounded-lg hover:bg-green-500/10 transition disabled:opacity-50"
                            title="Send Now"
                          >
                            <Play className="h-4 w-4 text-green-400" />
                          </button>
                          <button onClick={() => openCampaignEdit(c)} className="p-2 rounded-lg hover:bg-white/[0.06] transition">
                            <Pencil className="h-4 w-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ type: 'campaign', id: c.id, name: c.name })}
                            className="p-2 rounded-lg hover:bg-red-500/10 transition"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Notification Modal ═══════════════ */}
      {notifModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
            <div className="sticky top-0 bg-[#12121A] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-white">Send Notification</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateNotifIdea}
                  disabled={generatingNotif}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/20 text-purple-300 text-xs font-medium transition disabled:opacity-50"
                >
                  {generatingNotif ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" />
                  )}
                  {generatingNotif ? 'Generating...' : 'Generate Idea'}
                </button>
                <button onClick={() => setNotifModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06]">
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Title *</label>
                <input
                  value={notifForm.title}
                  onChange={(e) => setNotifForm({ ...notifForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                  placeholder="Notification title"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Message *</label>
                <textarea
                  value={notifForm.message}
                  onChange={(e) => setNotifForm({ ...notifForm, message: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50 resize-none"
                  placeholder="Notification message..."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-2 block">Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {NOTIF_TYPES.slice(0, 4).map((t) => {
                    const isSelected = notifForm.type === t.value
                    const Icon = t.icon
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setNotifForm({ ...notifForm, type: t.value })}
                        className={`flex flex-col items-center gap-1 py-2 px-2 rounded-xl border text-center transition ${
                          isSelected
                            ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                            : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:border-white/[0.12]'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[10px] font-medium">{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Link URL (optional)</label>
                <input
                  value={notifForm.linkUrl}
                  onChange={(e) => setNotifForm({ ...notifForm, linkUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                  placeholder="/billing or https://..."
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-2 block">Target Audience</label>
                <div className="space-y-2">
                  {[
                    { value: 'all', label: 'All Users' },
                    { value: 'plans', label: 'By Plan' },
                    { value: 'countries', label: 'By Country' },
                    { value: 'user', label: 'Individual User' },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="targetType"
                        checked={notifForm.targetType === opt.value}
                        onChange={() => setNotifForm({ ...notifForm, targetType: opt.value as any })}
                        className="text-brand-500 focus:ring-brand-500"
                      />
                      <span className="text-sm text-gray-300">{opt.label}</span>
                    </label>
                  ))}
                </div>

                {notifForm.targetType === 'plans' && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {PLANS.map((plan) => (
                      <button
                        key={plan} type="button"
                        onClick={() => {
                          const plans = notifForm.targetPlans.includes(plan)
                            ? notifForm.targetPlans.filter(p => p !== plan)
                            : [...notifForm.targetPlans, plan]
                          setNotifForm({ ...notifForm, targetPlans: plans })
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition border ${
                          notifForm.targetPlans.includes(plan)
                            ? 'bg-brand-500/15 border-brand-500/30 text-brand-400'
                            : 'bg-white/[0.03] border-white/[0.06] text-gray-400 hover:border-white/[0.1]'
                        }`}
                      >
                        {plan}
                      </button>
                    ))}
                  </div>
                )}

                {notifForm.targetType === 'countries' && (
                  <input
                    value={notifForm.targetCountries}
                    onChange={(e) => setNotifForm({ ...notifForm, targetCountries: e.target.value })}
                    className="w-full mt-3 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                    placeholder="US, IN, GB (comma-separated country codes)"
                  />
                )}

                {notifForm.targetType === 'user' && (
                  <input
                    value={notifForm.targetUserId}
                    onChange={(e) => setNotifForm({ ...notifForm, targetUserId: e.target.value })}
                    className="w-full mt-3 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                    placeholder="User ID"
                  />
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-[#12121A] border-t border-white/[0.06] px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setNotifModal(false)}
                className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition"
              >
                Cancel
              </button>
              <button
                onClick={sendNotification}
                disabled={sendingNotif || !notifForm.title || !notifForm.message}
                className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition disabled:opacity-50"
              >
                {sendingNotif ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Campaign Modal ═══════════════ */}
      {campaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
            <div className="sticky top-0 bg-[#12121A] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-white">
                {editingCampaign ? 'Edit Campaign' : 'Create Campaign'}
              </h2>
              <div className="flex items-center gap-2">
                {!editingCampaign && (
                  <button
                    onClick={handleGenerateCampaignIdea}
                    disabled={generatingCampaign}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/20 text-purple-300 text-xs font-medium transition disabled:opacity-50"
                  >
                    {generatingCampaign ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    {generatingCampaign ? 'Generating...' : 'Generate Idea'}
                  </button>
                )}
                <button onClick={() => setCampaignModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06]">
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Campaign Name *</label>
                <input
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                  placeholder="e.g., February Newsletter"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Email Subject *</label>
                <input
                  value={campaignForm.subject}
                  onChange={(e) => setCampaignForm({ ...campaignForm, subject: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                  placeholder="Subject line for the email"
                />
              </div>

              {/* Template picker */}
              {templates.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Use Template</label>
                  <select
                    onChange={(e) => {
                      const t = templates.find((t: any) => t.id === e.target.value)
                      if (t) {
                        setCampaignForm({ ...campaignForm, subject: t.subject, body: t.body })
                        fetch('/api/admin/marketing/templates', {
                          method: 'PUT', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: t.id, usageCount: (t.usageCount || 0) + 1 }),
                        }).catch(() => {})
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                    defaultValue=""
                  >
                    <option value="">-- Select a template --</option>
                    {templates.filter((t: any) => t.isActive).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Email Body * (HTML supported)</label>
                <textarea
                  value={campaignForm.body}
                  onChange={(e) => setCampaignForm({ ...campaignForm, body: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50 resize-none font-mono text-xs"
                  placeholder="<h1>Hello!</h1><p>Your email content here...</p>"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                  Target Plans <span className="text-gray-500">(empty = all plans)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PLANS.map((plan) => (
                    <button
                      key={plan} type="button"
                      onClick={() => {
                        const plans = campaignForm.targetPlans.includes(plan)
                          ? campaignForm.targetPlans.filter(p => p !== plan)
                          : [...campaignForm.targetPlans, plan]
                        setCampaignForm({ ...campaignForm, targetPlans: plans })
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition border ${
                        campaignForm.targetPlans.includes(plan)
                          ? 'bg-brand-500/15 border-brand-500/30 text-brand-400'
                          : 'bg-white/[0.03] border-white/[0.06] text-gray-400 hover:border-white/[0.1]'
                      }`}
                    >
                      {plan}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                  Target Countries <span className="text-gray-500">(empty = all countries)</span>
                </label>
                <input
                  value={campaignForm.targetCountries}
                  onChange={(e) => setCampaignForm({ ...campaignForm, targetCountries: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                  placeholder="US, IN, GB (comma-separated)"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Schedule (optional)</label>
                <input
                  type="datetime-local"
                  value={campaignForm.scheduledAt}
                  onChange={(e) => setCampaignForm({ ...campaignForm, scheduledAt: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-[#12121A] border-t border-white/[0.06] px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setCampaignModal(false)}
                className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition"
              >
                Cancel
              </button>
              <button
                onClick={saveCampaign}
                disabled={saving || !campaignForm.name || !campaignForm.subject || !campaignForm.body}
                className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingCampaign ? 'Update Campaign' : 'Save as Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Banner Modal ═══════════════ */}
      {bannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-[1100px] max-h-[90vh] overflow-hidden mx-4 flex flex-col">
            {/* Header */}
            <div className="bg-[#12121A] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-white">
                {editingBanner ? 'Edit Banner' : 'Create Banner'}
              </h2>
              <button onClick={() => setBannerModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06]">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* 2-column body */}
            <div className="flex flex-1 overflow-hidden">
              {/* ── LEFT: Form ── */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 border-r border-white/[0.06]">

                {/* Context + Content Type row */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
                    What is this banner about?
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {MODULES.map((mod) => {
                      const isSelected = bannerForm.targetModule === mod.value
                      const ModIcon = mod.icon
                      return (
                        <button
                          key={mod.value}
                          type="button"
                          onClick={() => setBannerForm({ ...bannerForm, targetModule: mod.value })}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition ${
                            isSelected
                              ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                              : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:border-white/[0.12] hover:text-gray-300'
                          }`}
                        >
                          <ModIcon className="h-5 w-5" />
                          <span className="text-[11px] font-medium leading-tight">{mod.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Content Type */}
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-2 block">Content Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBannerForm({ ...bannerForm, contentType: 'text' })}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
                        bannerForm.contentType === 'text'
                          ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                          : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:border-white/[0.12]'
                      }`}
                    >
                      <Type className="h-4 w-4" /> Text Banner
                    </button>
                    <button
                      type="button"
                      onClick={() => setBannerForm({ ...bannerForm, contentType: 'image' })}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
                        bannerForm.contentType === 'image'
                          ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                          : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:border-white/[0.12]'
                      }`}
                    >
                      <Image className="h-4 w-4" /> Image Banner
                    </button>
                  </div>
                </div>

                {/* Image Upload / AI Generate (only for image type) */}
                {bannerForm.contentType === 'image' && (
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Banner Image</label>
                    {bannerForm.imageUrl ? (
                      <div className="relative group w-full max-h-40 rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
                        <img
                          src={bannerForm.imageUrl}
                          alt="Banner"
                          className="w-full max-h-40 object-contain"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                          <button
                            onClick={() => imageInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-medium hover:bg-white/30 transition"
                          >
                            Replace
                          </button>
                          <button
                            onClick={handleGenerateImage}
                            disabled={generatingImage}
                            className="px-3 py-1.5 rounded-lg bg-purple-500/30 text-purple-200 text-xs font-medium hover:bg-purple-500/40 transition disabled:opacity-50"
                          >
                            {generatingImage ? 'Generating...' : 'AI Regenerate'}
                          </button>
                          <button
                            onClick={() => setBannerForm({ ...bannerForm, imageUrl: '' })}
                            className="px-3 py-1.5 rounded-lg bg-red-500/30 text-red-300 text-xs font-medium hover:bg-red-500/40 transition"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={uploadingImage || generatingImage}
                          className="w-full py-6 rounded-xl border-2 border-dashed border-white/[0.1] bg-white/[0.02] hover:border-brand-500/30 hover:bg-brand-500/5 transition flex flex-col items-center gap-2 text-gray-400"
                        >
                          {uploadingImage ? (
                            <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
                          ) : (
                            <Upload className="h-5 w-5" />
                          )}
                          <span className="text-xs">{uploadingImage ? 'Uploading...' : 'Click to upload banner image'}</span>
                          <span className="text-[10px] text-gray-500">PNG, JPEG, WebP, SVG — Max 2MB</span>
                        </button>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-px bg-white/[0.06]" />
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">or</span>
                          <div className="flex-1 h-px bg-white/[0.06]" />
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateImage}
                          disabled={generatingImage || uploadingImage}
                          className="w-full py-6 rounded-xl border-2 border-dashed border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40 hover:bg-purple-500/10 transition flex flex-col items-center gap-2 text-purple-300 disabled:opacity-50"
                        >
                          {generatingImage ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <ImagePlus className="h-5 w-5" />
                          )}
                          <span className="text-xs font-medium">{generatingImage ? 'AI is generating your image...' : 'Generate Image with AI'}</span>
                          <span className="text-[10px] text-purple-400/60">Uses title & context to create a banner image</span>
                        </button>
                      </div>
                    )}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>
                )}

                {/* Banner Type */}
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-2 block">Banner Type</label>
                  <div className="grid grid-cols-6 gap-2">
                    {BANNER_TYPES.map((t) => {
                      const isSelected = bannerForm.type === t.value
                      const Icon = t.icon
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setBannerForm({ ...bannerForm, type: t.value })}
                          className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-center transition ${
                            isSelected
                              ? `${t.bg} border ${t.color}`
                              : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:border-white/[0.12]'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-[10px] font-medium">{t.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* AI Generate Text Section */}
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-purple-400" />
                      <span className="text-xs font-semibold text-purple-300">AI Auto-Generate</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoGenerate}
                      disabled={generating}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-medium transition disabled:opacity-50"
                    >
                      {generating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {generating ? 'Generating...' : 'Generate Idea'}
                    </button>
                  </div>
                  <input
                    value={bannerForm.goal}
                    onChange={(e) => setBannerForm({ ...bannerForm, goal: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-purple-500/50 placeholder-gray-500"
                    placeholder="Optional: describe the goal (e.g., 'announce 50% off sale')"
                  />
                  <p className="text-[11px] text-purple-400/60 mt-2">
                    AI will generate title, message, and CTA based on selected context
                  </p>
                </div>

                {/* Title + Regenerate */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-gray-400">Title *</label>
                    {bannerForm.title && (
                      <button
                        type="button"
                        onClick={handleAutoGenerate}
                        disabled={generating}
                        className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 transition"
                      >
                        <RefreshCw className={`h-3 w-3 ${generating ? 'animate-spin' : ''}`} />
                        Regenerate
                      </button>
                    )}
                  </div>
                  <input
                    value={bannerForm.title}
                    onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                    placeholder="e.g., New Feature: Cartoon Studio is here!"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Message *</label>
                  <textarea
                    value={bannerForm.message}
                    onChange={(e) => setBannerForm({ ...bannerForm, message: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50 resize-none"
                    placeholder="Banner message text..."
                  />
                </div>

                {/* Link */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Link URL</label>
                    <input
                      value={bannerForm.linkUrl}
                      onChange={(e) => setBannerForm({ ...bannerForm, linkUrl: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                      placeholder="/billing or https://..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Link Text</label>
                    <input
                      value={bannerForm.linkText}
                      onChange={(e) => setBannerForm({ ...bannerForm, linkText: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                      placeholder="Learn More"
                    />
                  </div>
                </div>

                {/* Colors (only for text banners) */}
                {bannerForm.contentType === 'text' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Background Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={bannerForm.bgColor || '#6366f1'}
                          onChange={(e) => setBannerForm({ ...bannerForm, bgColor: e.target.value })}
                          className="h-9 w-9 rounded-lg cursor-pointer border border-white/[0.08]"
                        />
                        <input
                          value={bannerForm.bgColor}
                          onChange={(e) => setBannerForm({ ...bannerForm, bgColor: e.target.value })}
                          className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                          placeholder="#6366f1"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Text Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={bannerForm.textColor || '#ffffff'}
                          onChange={(e) => setBannerForm({ ...bannerForm, textColor: e.target.value })}
                          className="h-9 w-9 rounded-lg cursor-pointer border border-white/[0.08]"
                        />
                        <input
                          value={bannerForm.textColor}
                          onChange={(e) => setBannerForm({ ...bannerForm, textColor: e.target.value })}
                          className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                          placeholder="#ffffff"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── RIGHT: Preview & Settings ── */}
              <div className="w-[400px] flex-shrink-0 overflow-y-auto bg-white/[0.01] flex flex-col">
                <div className="p-5 space-y-5 flex-1">

                  {/* Live Preview */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Eye className="h-3.5 w-3.5" />
                      Live Preview
                    </h3>
                    {bannerForm.contentType === 'image' && bannerForm.imageUrl ? (
                      <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
                        <div className="relative">
                          <img src={bannerForm.imageUrl} alt="Banner preview" className="w-full max-h-44 object-cover" />
                          {bannerForm.dismissible && (
                            <div className="absolute top-2 right-2 p-1 rounded-lg bg-black/40">
                              <X className="h-3.5 w-3.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="font-semibold text-sm text-white">{bannerForm.title || 'Banner Title'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{bannerForm.message || 'Banner message...'}</p>
                          {bannerForm.linkText && (
                            <span className="inline-block mt-2 text-xs font-medium text-brand-400 underline underline-offset-2">{bannerForm.linkText}</span>
                          )}
                        </div>
                      </div>
                    ) : bannerForm.contentType === 'image' && !bannerForm.imageUrl ? (
                      <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
                        <div className="h-28 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                          <Image className="h-8 w-8 text-gray-600" />
                        </div>
                        <div className="p-3">
                          <p className="font-semibold text-sm text-white">{bannerForm.title || 'Banner Title'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{bannerForm.message || 'Banner message...'}</p>
                          {bannerForm.linkText && (
                            <span className="inline-block mt-2 text-xs font-medium text-brand-400 underline underline-offset-2">{bannerForm.linkText}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className="rounded-xl p-4 border"
                        style={{
                          backgroundColor: bannerForm.bgColor ? bannerForm.bgColor + '18' : '#6366f118',
                          borderColor: bannerForm.bgColor ? bannerForm.bgColor + '40' : '#6366f130',
                          color: bannerForm.textColor || '#e5e7eb',
                        }}
                      >
                        <div className="flex items-start gap-3">
                          {(() => {
                            const t = getBannerTypeInfo(bannerForm.type)
                            const Icon = t.icon
                            return <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          })()}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{bannerForm.title || 'Banner Title'}</p>
                            <p className="text-xs opacity-80 mt-0.5">{bannerForm.message || 'Banner message...'}</p>
                            {bannerForm.linkText && (
                              <span className="inline-block mt-2 text-xs font-medium underline underline-offset-2">{bannerForm.linkText}</span>
                            )}
                          </div>
                          {bannerForm.dismissible && (
                            <div className="p-1 rounded-lg flex-shrink-0">
                              <X className="h-3.5 w-3.5 text-gray-400" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Placement — visual selector */}
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-2 block">Placement</label>
                    <div className="grid grid-cols-2 gap-2">
                      {PLACEMENTS.map((p) => {
                        const isSelected = bannerForm.placement === p.value
                        const PlIcon = p.icon
                        return (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setBannerForm({ ...bannerForm, placement: p.value })}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition ${
                              isSelected
                                ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                                : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:border-white/[0.12] hover:text-gray-300'
                            }`}
                          >
                            <PlIcon className="h-4 w-4 flex-shrink-0" />
                            <div className="min-w-0">
                              <span className="text-[11px] font-medium block leading-tight">{p.label}</span>
                              <span className="text-[10px] opacity-60 block leading-tight">{p.description}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Target Plans */}
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                      Target Plans <span className="text-gray-500">(empty = all)</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {PLANS.map((plan) => (
                        <button
                          key={plan}
                          type="button"
                          onClick={() => {
                            const plans = bannerForm.targetPlans.includes(plan)
                              ? bannerForm.targetPlans.filter((p) => p !== plan)
                              : [...bannerForm.targetPlans, plan]
                            setBannerForm({ ...bannerForm, targetPlans: plans })
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition border ${
                            bannerForm.targetPlans.includes(plan)
                              ? 'bg-brand-500/15 border-brand-500/30 text-brand-400'
                              : 'bg-white/[0.03] border-white/[0.06] text-gray-400 hover:border-white/[0.1]'
                          }`}
                        >
                          {plan}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority + Toggles row */}
                  <div className="flex items-end gap-4">
                    <div className="w-20">
                      <label className="text-xs font-medium text-gray-400 mb-1.5 block">Priority</label>
                      <input
                        type="number"
                        value={bannerForm.priority}
                        onChange={(e) => setBannerForm({ ...bannerForm, priority: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                        min={0}
                        max={100}
                      />
                    </div>
                    <div className="flex items-center gap-4 pb-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bannerForm.isActive}
                          onChange={(e) => setBannerForm({ ...bannerForm, isActive: e.target.checked })}
                          className="rounded border-white/20 bg-white/[0.04] text-brand-500 focus:ring-brand-500"
                        />
                        <span className="text-xs text-gray-300">Active</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bannerForm.dismissible}
                          onChange={(e) => setBannerForm({ ...bannerForm, dismissible: e.target.checked })}
                          className="rounded border-white/20 bg-white/[0.04] text-brand-500 focus:ring-brand-500"
                        />
                        <span className="text-xs text-gray-300">Dismissible</span>
                      </label>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 block">Schedule</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Starts At</label>
                        <input
                          type="datetime-local"
                          value={bannerForm.startsAt}
                          onChange={(e) => setBannerForm({ ...bannerForm, startsAt: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-brand-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Expires At</label>
                        <input
                          type="datetime-local"
                          value={bannerForm.expiresAt}
                          onChange={(e) => setBannerForm({ ...bannerForm, expiresAt: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-brand-500/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Trigger Settings — only for FULL_PAGE_MODAL */}
                  {bannerForm.placement === 'FULL_PAGE_MODAL' && (
                    <div className="space-y-3">
                      <label className="text-xs font-medium text-gray-400 block">Popup Trigger</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {TRIGGER_TYPES.map((t) => {
                          const isSelected = bannerForm.triggerType === t.value
                          const TIcon = t.icon
                          return (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => setBannerForm({ ...bannerForm, triggerType: t.value })}
                              className={`flex flex-col items-center gap-1 py-2 px-1.5 rounded-lg border text-center transition ${
                                isSelected
                                  ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                                  : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:border-white/[0.12]'
                              }`}
                            >
                              <TIcon className={`h-3.5 w-3.5 ${isSelected ? t.color : ''}`} />
                              <span className="text-[9px] font-medium leading-tight">{t.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      {bannerForm.triggerType === 'DELAY' && (
                        <div>
                          <label className="text-[10px] text-gray-500 mb-1 block">Delay (seconds)</label>
                          <input
                            type="number"
                            value={bannerForm.triggerDelay ?? ''}
                            onChange={(e) => setBannerForm({ ...bannerForm, triggerDelay: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-brand-500/50"
                            min={1} max={300} placeholder="5"
                          />
                        </div>
                      )}

                      {bannerForm.triggerType === 'SCROLL' && (
                        <div>
                          <label className="text-[10px] text-gray-500 mb-1 block">Scroll Percentage (%)</label>
                          <input
                            type="number"
                            value={bannerForm.triggerScrollPercent ?? ''}
                            onChange={(e) => setBannerForm({ ...bannerForm, triggerScrollPercent: e.target.value ? parseInt(e.target.value) : null })}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-brand-500/50"
                            min={0} max={100} placeholder="50"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">Show Frequency</label>
                        <select
                          value={bannerForm.showFrequency}
                          onChange={(e) => setBannerForm({ ...bannerForm, showFrequency: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-brand-500/50"
                        >
                          {SHOW_FREQUENCIES.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-500 mb-1 block">
                          Max Impressions <span className="text-gray-600">(blank = unlimited)</span>
                        </label>
                        <input
                          type="number"
                          value={bannerForm.maxImpressions ?? ''}
                          onChange={(e) => setBannerForm({ ...bannerForm, maxImpressions: e.target.value ? parseInt(e.target.value) : null })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-brand-500/50"
                          min={1} placeholder="Unlimited"
                        />
                      </div>
                    </div>
                  )}

                  {/* Status indicator */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                    <div className={`h-2 w-2 rounded-full ${bannerForm.isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                    <span className="text-xs text-gray-400">
                      {bannerForm.isActive ? 'Will be active immediately' : 'Saved as inactive draft'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[#12121A] border-t border-white/[0.06] px-6 py-4 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setBannerModal(false)}
                className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition"
              >
                Cancel
              </button>
              <button
                onClick={saveBanner}
                disabled={saving || !bannerForm.title || !bannerForm.message}
                className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingBanner ? 'Update Banner' : 'Create Banner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Promo Modal ═══════════════ */}
      {promoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
            <div className="sticky top-0 bg-[#12121A] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-white">
                {editingPromo ? 'Edit Promo Code' : 'Create Promo Code'}
              </h2>
              <div className="flex items-center gap-2">
                {!editingPromo && (
                  <button
                    onClick={handleGeneratePromoIdea}
                    disabled={generatingPromo}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/20 text-purple-300 text-xs font-medium transition disabled:opacity-50"
                  >
                    {generatingPromo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    {generatingPromo ? 'Generating...' : 'Generate Idea'}
                  </button>
                )}
                <button onClick={() => setPromoModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06]">
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Promo Code *</label>
                <input
                  value={promoForm.code}
                  onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white font-mono focus:outline-none focus:border-brand-500/50"
                  placeholder="e.g., WELCOME50"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Description</label>
                <input
                  value={promoForm.description}
                  onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                  placeholder="50% off for new users"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-2 block">Discount Type</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {DISCOUNT_TYPES.map((t) => {
                    const isSelected = promoForm.discountType === t.value
                    const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string; ring: string }> = {
                      brand: { bg: 'bg-brand-500/10', border: 'border-brand-500/40', text: 'text-brand-400', iconBg: 'bg-brand-500/20', ring: 'ring-brand-500/20' },
                      emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-400', iconBg: 'bg-emerald-500/20', ring: 'ring-emerald-500/20' },
                      amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/40', text: 'text-amber-400', iconBg: 'bg-amber-500/20', ring: 'ring-amber-500/20' },
                    }
                    const c = colorMap[t.color]
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setPromoForm({ ...promoForm, discountType: t.value })}
                        className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                          isSelected
                            ? `${c.bg} ${c.border} ${c.text} ring-1 ${c.ring}`
                            : 'bg-white/[0.02] border-white/[0.08] text-gray-400 hover:bg-white/[0.04] hover:border-white/[0.12]'
                        }`}
                      >
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isSelected ? c.iconBg : 'bg-white/[0.06]'}`}>
                          <t.icon className="h-4 w-4" />
                        </div>
                        <span className="text-[11px] font-semibold">{t.label}</span>
                        <span className={`text-[10px] ${isSelected ? 'opacity-70' : 'text-gray-500'}`}>{t.desc}</span>
                        {isSelected && (
                          <div className={`absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full ${
                            t.color === 'brand' ? 'bg-brand-400' : t.color === 'emerald' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                  {promoForm.discountType === 'PERCENTAGE' ? 'Discount Percentage (%)' :
                   promoForm.discountType === 'FIXED_AMOUNT' ? 'Discount Amount (cents)' : 'Bonus Credits to Award'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={promoForm.discountType === 'CREDIT_BONUS' ? promoForm.bonusCredits : promoForm.discountValue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0
                      if (promoForm.discountType === 'CREDIT_BONUS') {
                        setPromoForm({ ...promoForm, bonusCredits: val })
                      } else {
                        setPromoForm({ ...promoForm, discountValue: val })
                      }
                    }}
                    className="w-full px-3 py-2 pl-9 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                    min={0}
                    placeholder={promoForm.discountType === 'PERCENTAGE' ? 'e.g., 25' : promoForm.discountType === 'FIXED_AMOUNT' ? 'e.g., 500' : 'e.g., 10'}
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {promoForm.discountType === 'PERCENTAGE' && <Percent className="h-3.5 w-3.5" />}
                    {promoForm.discountType === 'FIXED_AMOUNT' && <DollarSign className="h-3.5 w-3.5" />}
                    {promoForm.discountType === 'CREDIT_BONUS' && <Coins className="h-3.5 w-3.5" />}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                  Max Uses <span className="text-gray-500">(blank = unlimited)</span>
                </label>
                <input
                  type="number"
                  value={promoForm.maxUses ?? ''}
                  onChange={(e) => setPromoForm({ ...promoForm, maxUses: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                  min={1}
                  placeholder="Unlimited"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                  Target Plans <span className="text-gray-500">(empty = all plans)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLANS.map((plan) => (
                    <button
                      key={plan}
                      type="button"
                      onClick={() => {
                        const plans = promoForm.targetPlans.includes(plan)
                          ? promoForm.targetPlans.filter((p) => p !== plan)
                          : [...promoForm.targetPlans, plan]
                        setPromoForm({ ...promoForm, targetPlans: plans })
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                        promoForm.targetPlans.includes(plan)
                          ? 'bg-brand-500/15 border-brand-500/30 text-brand-400'
                          : 'bg-white/[0.03] border-white/[0.06] text-gray-400 hover:border-white/[0.1]'
                      }`}
                    >
                      {plan}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Starts At</label>
                  <input
                    type="datetime-local"
                    value={promoForm.startsAt}
                    onChange={(e) => setPromoForm({ ...promoForm, startsAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1.5 block">Expires At</label>
                  <input
                    type="datetime-local"
                    value={promoForm.expiresAt}
                    onChange={(e) => setPromoForm({ ...promoForm, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoForm.isActive}
                  onChange={(e) => setPromoForm({ ...promoForm, isActive: e.target.checked })}
                  className="rounded border-white/20 bg-white/[0.04] text-brand-500 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-300">Active</span>
              </label>
            </div>

            <div className="sticky bottom-0 bg-[#12121A] border-t border-white/[0.06] px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setPromoModal(false)}
                className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition"
              >
                Cancel
              </button>
              <button
                onClick={savePromo}
                disabled={saving || !promoForm.code}
                className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingPromo ? 'Update Promo' : 'Create Promo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ A/B Tests Tab ═══════════════ */}
      {activeTab === 'experiments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">
              Run A/B tests to compare two banners and find the best performer
            </p>
            <button
              onClick={() => {
                setExperimentForm({ name: '', bannerAId: '', bannerBId: '', splitPercent: 50 })
                setExperimentModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition"
            >
              <Plus className="h-4 w-4" /> New Experiment
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input type="text" placeholder="Search experiments..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20" />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="h-4 w-4" /></button>
            )}
          </div>

          {filteredExperiments.length === 0 && experiments.length > 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No experiments match &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : experiments.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <FlaskConical className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No experiments yet</p>
              <p className="text-sm text-gray-500 mt-1">Create an A/B test to compare banner performance</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredExperiments.map((exp) => {
                const ctrA = exp.bannerA && exp.bannerA.viewCount > 0
                  ? ((exp.bannerA.clickCount / exp.bannerA.viewCount) * 100).toFixed(1)
                  : '0.0'
                const ctrB = exp.bannerB && exp.bannerB.viewCount > 0
                  ? ((exp.bannerB.clickCount / exp.bannerB.viewCount) * 100).toFixed(1)
                  : '0.0'
                return (
                  <div key={exp.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <FlaskConical className="h-4.5 w-4.5 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">{exp.name}</h3>
                          <p className="text-[11px] text-gray-500">
                            Split: {exp.splitPercent}% / {100 - exp.splitPercent}%
                            {' · '}Started {new Date(exp.startedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${EXPERIMENT_STATUS_COLORS[exp.status] || 'bg-gray-500/20 text-gray-400'}`}>
                          {exp.status}
                        </span>
                        {exp.status === 'RUNNING' && (
                          <button
                            onClick={() => stopExperiment(exp.id)}
                            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-yellow-400 transition"
                            title="Stop experiment"
                          >
                            <Pause className="h-4 w-4" />
                          </button>
                        )}
                        {exp.status !== 'RUNNING' && (
                          <button
                            onClick={() => deleteExperiment(exp.id)}
                            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-red-400 transition"
                            title="Delete experiment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Side-by-side banner comparison */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Banner A */}
                      <div className={`rounded-xl border p-4 ${
                        exp.winnerBannerId === exp.bannerAId
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-white/[0.06] bg-white/[0.02]'
                      }`}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">A</span>
                          <span className="text-xs font-medium text-white truncate">{exp.bannerA?.title || 'Unknown'}</span>
                          {exp.winnerBannerId === exp.bannerAId && (
                            <Trophy className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500">Views</span>
                            <span className="text-white font-medium">{(exp.bannerA?.viewCount || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500">Clicks</span>
                            <span className="text-white font-medium">{(exp.bannerA?.clickCount || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500">CTR</span>
                            <span className="text-brand-400 font-semibold">{ctrA}%</span>
                          </div>
                        </div>
                        {exp.status === 'RUNNING' && !exp.winnerBannerId && (
                          <button
                            onClick={() => declareWinner(exp.id, exp.bannerAId)}
                            className="mt-3 w-full py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] font-medium hover:bg-green-500/20 transition"
                          >
                            <Trophy className="h-3 w-3 inline mr-1" />
                            Declare Winner
                          </button>
                        )}
                      </div>

                      {/* Banner B */}
                      <div className={`rounded-xl border p-4 ${
                        exp.winnerBannerId === exp.bannerBId
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-white/[0.06] bg-white/[0.02]'
                      }`}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">B</span>
                          <span className="text-xs font-medium text-white truncate">{exp.bannerB?.title || 'Unknown'}</span>
                          {exp.winnerBannerId === exp.bannerBId && (
                            <Trophy className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500">Views</span>
                            <span className="text-white font-medium">{(exp.bannerB?.viewCount || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500">Clicks</span>
                            <span className="text-white font-medium">{(exp.bannerB?.clickCount || 0).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500">CTR</span>
                            <span className="text-brand-400 font-semibold">{ctrB}%</span>
                          </div>
                        </div>
                        {exp.status === 'RUNNING' && !exp.winnerBannerId && (
                          <button
                            onClick={() => declareWinner(exp.id, exp.bannerBId)}
                            className="mt-3 w-full py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] font-medium hover:bg-green-500/20 transition"
                          >
                            <Trophy className="h-3 w-3 inline mr-1" />
                            Declare Winner
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Experiment Modal ═══════════════ */}
      {experimentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto mx-4">
            <div className="sticky top-0 bg-[#12121A] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-white">New A/B Experiment</h2>
              <button onClick={() => setExperimentModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06]">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Experiment Name *</label>
                <input
                  value={experimentForm.name}
                  onChange={(e) => setExperimentForm({ ...experimentForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                  placeholder="e.g., Homepage Banner Test"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Banner A (Control) *</label>
                <select
                  value={experimentForm.bannerAId}
                  onChange={(e) => setExperimentForm({ ...experimentForm, bannerAId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                >
                  <option value="">Select banner...</option>
                  {banners.filter(b => b.id !== experimentForm.bannerBId).map((b) => (
                    <option key={b.id} value={b.id}>{b.title} ({b.placement})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Banner B (Variant) *</label>
                <select
                  value={experimentForm.bannerBId}
                  onChange={(e) => setExperimentForm({ ...experimentForm, bannerBId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                >
                  <option value="">Select banner...</option>
                  {banners.filter(b => b.id !== experimentForm.bannerAId).map((b) => (
                    <option key={b.id} value={b.id}>{b.title} ({b.placement})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">
                  Traffic Split: {experimentForm.splitPercent}% A / {100 - experimentForm.splitPercent}% B
                </label>
                <input
                  type="range"
                  value={experimentForm.splitPercent}
                  onChange={(e) => setExperimentForm({ ...experimentForm, splitPercent: parseInt(e.target.value) })}
                  className="w-full accent-brand-500"
                  min={10} max={90} step={5}
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                  <span>10% A</span>
                  <span>50/50</span>
                  <span>90% A</span>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <Split className="h-4 w-4 text-blue-400" />
                <span className="text-[11px] text-blue-300">
                  Users are assigned deterministically — each user always sees the same variant
                </span>
              </div>
            </div>

            <div className="border-t border-white/[0.06] px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setExperimentModal(false)}
                className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition"
              >
                Cancel
              </button>
              <button
                onClick={saveExperiment}
                disabled={savingExperiment || !experimentForm.name || !experimentForm.bannerAId || !experimentForm.bannerBId}
                className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition disabled:opacity-50"
              >
                {savingExperiment ? 'Creating...' : 'Start Experiment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Sequences Tab ═══════════════ */}
      {activeTab === 'sequences' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-400">
              Automated email drip sequences triggered by user actions
            </p>
            <button
              onClick={() => {
                setEditingSequence(null)
                setSequenceForm({ name: '', trigger: 'SIGNUP', isActive: true })
                setSequenceModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition"
            >
              <Plus className="h-4 w-4" /> New Sequence
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input type="text" placeholder="Search sequences..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20" />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="h-4 w-4" /></button>
            )}
          </div>

          {filteredSequences.length === 0 && sequences.length > 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No sequences match &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : sequences.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <Split className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No sequences yet</p>
              <p className="text-sm text-gray-500 mt-1">Create automated email drip campaigns</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSequences.map((seq) => {
                const triggerInfo = SEQUENCE_TRIGGERS.find(t => t.value === seq.trigger)
                const TriggerIcon = triggerInfo?.icon || Mail
                return (
                  <div key={seq.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.03] transition">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0 ${triggerInfo?.color || 'text-gray-400'}`}>
                        <TriggerIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-semibold text-white">{seq.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${seq.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                            {seq.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                          <span className="flex items-center gap-1">
                            <TriggerIcon className="h-3 w-3" />
                            {triggerInfo?.label || seq.trigger}
                          </span>
                          <span>{seq._count.steps} steps</span>
                          <span>{seq._count.enrollments} enrolled</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => openStepsEditor(seq)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-brand-400 transition"
                          title="Edit steps"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingSequence(seq)
                            setSequenceForm({ name: seq.name, trigger: seq.trigger, isActive: seq.isActive })
                            setSequenceModal(true)
                          }}
                          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleSequenceActive(seq)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-yellow-400 transition"
                          title={seq.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {seq.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => deleteSequence(seq.id)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-red-400 transition"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Sequence Modal ═══════════════ */}
      {sequenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto mx-4">
            <div className="sticky top-0 bg-[#12121A] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-white">
                {editingSequence ? 'Edit Sequence' : 'Create Sequence'}
              </h2>
              <div className="flex items-center gap-2">
                {!editingSequence && (
                  <button
                    onClick={handleGenerateSequenceIdea}
                    disabled={generatingSequence}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/20 text-purple-300 text-xs font-medium transition disabled:opacity-50"
                  >
                    {generatingSequence ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    {generatingSequence ? 'Generating...' : 'AI Idea'}
                  </button>
                )}
                <button onClick={() => setSequenceModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06]">
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Sequence Name *</label>
                <input
                  value={sequenceForm.name}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-brand-500/50"
                  placeholder="e.g., Welcome Onboarding"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 mb-2 block">Trigger Event</label>
                <div className="grid grid-cols-2 gap-2">
                  {SEQUENCE_TRIGGERS.map((t) => {
                    const isSelected = sequenceForm.trigger === t.value
                    const TIcon = t.icon
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setSequenceForm({ ...sequenceForm, trigger: t.value })}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                            : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:border-white/[0.12] hover:text-gray-300'
                        }`}
                      >
                        <TIcon className={`h-4 w-4 flex-shrink-0 ${isSelected ? t.color : ''}`} />
                        <div className="min-w-0">
                          <span className="text-[11px] font-medium block leading-tight">{t.label}</span>
                          <span className="text-[10px] opacity-60 block leading-tight">{t.desc}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sequenceForm.isActive}
                  onChange={(e) => setSequenceForm({ ...sequenceForm, isActive: e.target.checked })}
                  className="rounded border-white/20 bg-white/[0.04] text-brand-500 focus:ring-brand-500"
                />
                <span className="text-xs text-gray-300">Active (enroll users when triggered)</span>
              </label>
            </div>

            <div className="border-t border-white/[0.06] px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setSequenceModal(false)}
                className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition"
              >
                Cancel
              </button>
              <button
                onClick={saveSequence}
                disabled={savingSequence || !sequenceForm.name}
                className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition disabled:opacity-50"
              >
                {savingSequence ? 'Saving...' : editingSequence ? 'Update' : 'Create Sequence'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Steps Editor Modal ═══════════════ */}
      {stepsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden mx-4 flex flex-col">
            <div className="bg-[#12121A] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">Email Steps</h2>
                <p className="text-xs text-gray-500">{stepsModal.sequenceName}</p>
              </div>
              <button onClick={() => setStepsModal(null)} className="p-1.5 rounded-lg hover:bg-white/[0.06]">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Existing steps */}
              {steps.length > 0 && (
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <div key={step.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400">
                            Step {i + 1}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {step.delayDays === 0 ? 'Immediately' : `After ${step.delayDays} day${step.delayDays !== 1 ? 's' : ''}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingStep(step)
                              setStepForm({ stepOrder: step.stepOrder, delayDays: step.delayDays, subject: step.subject, body: step.body })
                            }}
                            className="p-1 rounded hover:bg-white/[0.06] text-gray-500 hover:text-white transition"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteStep(step.id)}
                            className="p-1 rounded hover:bg-white/[0.06] text-gray-500 hover:text-red-400 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-white">{step.subject}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{step.body.replace(/<[^>]+>/g, '').slice(0, 120)}...</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add/Edit step form */}
              <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 space-y-3">
                <h3 className="text-xs font-semibold text-brand-300">
                  {editingStep ? 'Edit Step' : 'Add Step'}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">Delay (days after enrollment)</label>
                    <input
                      type="number"
                      value={stepForm.delayDays}
                      onChange={(e) => setStepForm({ ...stepForm, delayDays: parseInt(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-brand-500/50"
                      min={0} placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">Step Order</label>
                    <input
                      type="number"
                      value={stepForm.stepOrder}
                      onChange={(e) => setStepForm({ ...stepForm, stepOrder: parseInt(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-brand-500/50"
                      min={0}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">Subject *</label>
                  <input
                    value={stepForm.subject}
                    onChange={(e) => setStepForm({ ...stepForm, subject: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-brand-500/50"
                    placeholder="Email subject line"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">Body (HTML) *</label>
                  <textarea
                    value={stepForm.body}
                    onChange={(e) => setStepForm({ ...stepForm, body: e.target.value })}
                    rows={4}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-brand-500/50 resize-none font-mono"
                    placeholder="<h1>Welcome!</h1><p>...</p>"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  {editingStep && (
                    <button
                      onClick={() => {
                        setEditingStep(null)
                        setStepForm({ stepOrder: steps.length, delayDays: 0, subject: '', body: '' })
                      }}
                      className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-gray-400 hover:bg-white/[0.04] transition"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={saveStep}
                    disabled={savingStep || !stepForm.subject || !stepForm.body}
                    className="px-4 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium transition disabled:opacity-50"
                  >
                    {savingStep ? 'Saving...' : editingStep ? 'Update Step' : 'Add Step'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Segments Tab ═══════════════ */}
      {activeTab === 'segments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">User Segments</h2>
              <p className="text-sm text-gray-400">Create reusable audience segments for targeting</p>
            </div>
            <button onClick={openSegmentCreate} className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              <Plus className="h-4 w-4" />
              Create Segment
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input type="text" placeholder="Search segments..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20" />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="h-4 w-4" /></button>
            )}
          </div>

          {filteredSegments.length === 0 && segments.length > 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No segments match &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : segments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Target className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No segments yet. Create your first audience segment.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredSegments.map((seg: any) => (
                <div key={seg.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                        <Target className="h-5 w-5 text-brand-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{seg.name}</h3>
                        <p className="text-xs text-gray-400">
                          {(seg.rules?.conditions?.length || 0)} rule{(seg.rules?.conditions?.length || 0) !== 1 ? 's' : ''} &middot; Match {seg.matchType?.toLowerCase() || 'all'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-2">
                        <div className="text-sm font-semibold text-white">{seg.cachedCount?.toLocaleString() || 0}</div>
                        <div className="text-xs text-gray-400">users</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${seg.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {seg.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button onClick={() => openSegmentEdit(seg)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteSegment(seg.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {seg.description && <p className="text-xs text-gray-500 mt-2">{seg.description}</p>}
                  {seg.rules?.conditions && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {seg.rules.conditions.map((c: any, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-white/[0.04] rounded text-xs text-gray-300">
                          {c.field} {OPERATOR_LABELS[c.operator] || c.operator} {Array.isArray(c.value) ? c.value.join(', ') : String(c.value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Segment Modal ═══════════════ */}
      {segmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSegmentModal(false)} />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{editingSegment ? 'Edit Segment' : 'Create Segment'}</h2>
              <button onClick={() => setSegmentModal(false)} className="p-1 rounded-lg hover:bg-white/[0.06] text-gray-400"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Segment Name</label>
                <input value={segmentForm.name} onChange={(e) => setSegmentForm({ ...segmentForm, name: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" placeholder="e.g. Pro Users in US" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Description (optional)</label>
                <input value={segmentForm.description} onChange={(e) => setSegmentForm({ ...segmentForm, description: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" placeholder="What this segment targets" />
              </div>

              <div>
                <div className="flex items-center gap-3 mb-3">
                  <label className="text-xs font-medium text-gray-400">Match</label>
                  <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
                    <button onClick={() => setSegmentForm({ ...segmentForm, match: 'all' })}
                      className={`px-3 py-1 rounded text-xs font-medium transition ${segmentForm.match === 'all' ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-white'}`}>
                      ALL conditions
                    </button>
                    <button onClick={() => setSegmentForm({ ...segmentForm, match: 'any' })}
                      className={`px-3 py-1 rounded text-xs font-medium transition ${segmentForm.match === 'any' ? 'bg-brand-500/20 text-brand-400' : 'text-gray-400 hover:text-white'}`}>
                      ANY condition
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {segmentForm.conditions.map((cond, idx) => {
                    const fieldConfig = SEGMENT_FIELDS.find(f => f.value === cond.field) || SEGMENT_FIELDS[0]
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded-lg p-2">
                        <select value={cond.field} onChange={(e) => {
                          const newConds = [...segmentForm.conditions]
                          const newField = SEGMENT_FIELDS.find(f => f.value === e.target.value)
                          newConds[idx] = { field: e.target.value, operator: newField?.operators[0] || 'eq', value: newField?.type === 'multiselect' ? [] : '' }
                          setSegmentForm({ ...segmentForm, conditions: newConds })
                        }} className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white min-w-[130px]">
                          {SEGMENT_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                        <select value={cond.operator} onChange={(e) => {
                          const newConds = [...segmentForm.conditions]
                          newConds[idx] = { ...newConds[idx], operator: e.target.value }
                          setSegmentForm({ ...segmentForm, conditions: newConds })
                        }} className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white min-w-[100px]">
                          {fieldConfig.operators.map(op => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
                        </select>
                        {fieldConfig.type === 'multiselect' && fieldConfig.options ? (
                          <div className="flex flex-wrap gap-1 flex-1">
                            {fieldConfig.options.map(opt => (
                              <button key={opt} onClick={() => {
                                const newConds = [...segmentForm.conditions]
                                const val = Array.isArray(newConds[idx].value) ? newConds[idx].value : []
                                newConds[idx] = { ...newConds[idx], value: val.includes(opt) ? val.filter((v: string) => v !== opt) : [...val, opt] }
                                setSegmentForm({ ...segmentForm, conditions: newConds })
                              }}
                              className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                                Array.isArray(cond.value) && cond.value.includes(opt) ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'bg-white/[0.04] text-gray-400 border border-white/[0.08] hover:text-white'
                              }`}>{opt}</button>
                            ))}
                          </div>
                        ) : fieldConfig.type === 'number' ? (
                          <input type="number" value={cond.value || ''} onChange={(e) => {
                            const newConds = [...segmentForm.conditions]
                            newConds[idx] = { ...newConds[idx], value: Number(e.target.value) }
                            setSegmentForm({ ...segmentForm, conditions: newConds })
                          }} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white" placeholder="Value" />
                        ) : fieldConfig.type === 'date' ? (
                          <input type="date" value={cond.value || ''} onChange={(e) => {
                            const newConds = [...segmentForm.conditions]
                            newConds[idx] = { ...newConds[idx], value: e.target.value }
                            setSegmentForm({ ...segmentForm, conditions: newConds })
                          }} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white" />
                        ) : (
                          <input value={cond.value || ''} onChange={(e) => {
                            const newConds = [...segmentForm.conditions]
                            newConds[idx] = { ...newConds[idx], value: e.target.value.includes(',') ? e.target.value.split(',').map(s => s.trim()) : e.target.value }
                            setSegmentForm({ ...segmentForm, conditions: newConds })
                          }} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white" placeholder="Comma-separated values" />
                        )}
                        {segmentForm.conditions.length > 1 && (
                          <button onClick={() => {
                            const newConds = segmentForm.conditions.filter((_, i) => i !== idx)
                            setSegmentForm({ ...segmentForm, conditions: newConds })
                          }} className="p-1 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    )
                  })}
                  <button onClick={() => setSegmentForm({ ...segmentForm, conditions: [...segmentForm.conditions, { field: 'plan', operator: 'in', value: [] }] })}
                    className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-1">
                    <Plus className="h-3 w-3" /> Add Condition
                  </button>
                </div>
              </div>

              {editingSegment && (
                <div className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.06]">
                  <button onClick={previewSegment} disabled={segmentPreview.loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.08] rounded-lg text-xs text-white font-medium transition">
                    {segmentPreview.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                    Preview
                  </button>
                  <span className="text-sm text-gray-300">
                    <span className="font-semibold text-white">{segmentPreview.count.toLocaleString()}</span> matching users
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input type="checkbox" checked={segmentForm.isActive} onChange={(e) => setSegmentForm({ ...segmentForm, isActive: e.target.checked })}
                  className="rounded bg-white/[0.04] border-white/[0.08]" />
                <label className="text-sm text-gray-300">Active</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/[0.06]">
              <button onClick={() => setSegmentModal(false)} className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition">Cancel</button>
              <button onClick={saveSegment} disabled={savingSegment || !segmentForm.name}
                className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition disabled:opacity-50">
                {savingSegment ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (editingSegment ? 'Update Segment' : 'Create Segment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Analytics Tab ═══════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Marketing Analytics</h2>
              <p className="text-sm text-gray-400">Overview of all marketing performance metrics</p>
            </div>
            <div className="flex items-center gap-3">
              <input type="date" value={analyticsDateRange.from} onChange={(e) => setAnalyticsDateRange({ ...analyticsDateRange, from: e.target.value })}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white" />
              <span className="text-gray-400 text-sm">to</span>
              <input type="date" value={analyticsDateRange.to} onChange={(e) => setAnalyticsDateRange({ ...analyticsDateRange, to: e.target.value })}
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white" />
              <button onClick={fetchAnalytics} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.08] rounded-lg text-sm text-white font-medium transition">
                <RefreshCw className={`h-3.5 w-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <a href={`/api/admin/marketing/analytics?format=csv&dateFrom=${analyticsDateRange.from}&dateTo=${analyticsDateRange.to}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 rounded-lg text-sm text-white font-medium transition">
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
            </div>
          </div>

          {analyticsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
            </div>
          ) : analyticsData ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: 'Banner Views', value: analyticsData.summary?.totalBannerViews?.toLocaleString() || '0', sub: `${analyticsData.summary?.bannerCTR || 0}% CTR`, icon: Eye, color: 'text-blue-400' },
                  { label: 'Emails Sent', value: analyticsData.summary?.totalEmailsSent?.toLocaleString() || '0', sub: `${analyticsData.summary?.openRate || 0}% open rate`, icon: Mail, color: 'text-green-400' },
                  { label: 'Promo Redemptions', value: analyticsData.summary?.totalPromoRedemptions?.toLocaleString() || '0', sub: `${analyticsData.promos?.length || 0} codes`, icon: TicketPercent, color: 'text-purple-400' },
                  { label: 'Referrals', value: analyticsData.summary?.totalReferrals?.toLocaleString() || '0', sub: `${analyticsData.summary?.referralCounts?.COMPLETED || 0} converted`, icon: Users, color: 'text-orange-400' },
                  { label: 'Seq. Enrollments', value: analyticsData.summary?.sequenceEnrollments?.toLocaleString() || '0', sub: `${analyticsData.sequences?.length || 0} sequences`, icon: Split, color: 'text-cyan-400' },
                ].map((card, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <card.icon className={`h-4 w-4 ${card.color}`} />
                      <span className="text-xs text-gray-400">{card.label}</span>
                    </div>
                    <div className="text-xl font-bold text-white">{card.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{card.sub}</div>
                  </div>
                ))}
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Top Banners */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Top Banners by Views</h3>
                  <div className="space-y-2">
                    {(analyticsData.banners || []).slice(0, 8).map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between">
                        <span className="text-xs text-gray-300 truncate max-w-[200px]">{b.title}</span>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-400">{b.viewCount} views</span>
                          <span className="text-gray-400">{b.clickCount} clicks</span>
                          <span className="text-brand-400 font-medium">{b.ctr}%</span>
                        </div>
                      </div>
                    ))}
                    {(!analyticsData.banners || analyticsData.banners.length === 0) && (
                      <p className="text-xs text-gray-500">No banner data for this period</p>
                    )}
                  </div>
                </div>

                {/* Campaign Status */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Campaigns by Status</h3>
                  <div className="space-y-2">
                    {Object.entries(analyticsData.campaignsByStatus || {}).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className="text-xs text-gray-300">{status}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 bg-brand-500/30 rounded-full" style={{ width: `${Math.max(20, Number(count) * 20)}px` }} />
                          <span className="text-xs text-white font-medium">{String(count)}</span>
                        </div>
                      </div>
                    ))}
                    {Object.keys(analyticsData.campaignsByStatus || {}).length === 0 && (
                      <p className="text-xs text-gray-500">No campaigns in this period</p>
                    )}
                  </div>
                </div>

                {/* Top Promos */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Top Promo Codes</h3>
                  <div className="space-y-2">
                    {(analyticsData.promos || []).slice(0, 8).map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between">
                        <span className="text-xs text-gray-300 font-mono">{p.code}</span>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-400">{p.discountType === 'PERCENTAGE' ? `${p.discountValue}%` : `$${p.discountValue}`}</span>
                          <span className="text-brand-400 font-medium">{p.timesRedeemed} used</span>
                        </div>
                      </div>
                    ))}
                    {(!analyticsData.promos || analyticsData.promos.length === 0) && (
                      <p className="text-xs text-gray-500">No promo data for this period</p>
                    )}
                  </div>
                </div>

                {/* Referral Funnel */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Referral Funnel</h3>
                  <div className="space-y-2">
                    {['PENDING', 'COMPLETED', 'PAID', 'CANCELLED'].map((status) => {
                      const count = analyticsData.referralFunnel?.[status] || 0
                      const total = analyticsData.summary?.totalReferrals || 1
                      const pct = ((count / total) * 100).toFixed(1)
                      const colors: Record<string, string> = { PENDING: 'bg-yellow-500/40', COMPLETED: 'bg-green-500/40', PAID: 'bg-blue-500/40', CANCELLED: 'bg-red-500/40' }
                      return (
                        <div key={status} className="flex items-center justify-between">
                          <span className="text-xs text-gray-300">{status}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${colors[status] || 'bg-brand-500/40'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-white font-medium w-8 text-right">{count}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* User Growth */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 col-span-2">
                  <h3 className="text-sm font-semibold text-white mb-3">User Growth (Daily Signups)</h3>
                  {(analyticsData.userGrowth || []).length > 0 ? (
                    <div className="flex items-end gap-1 h-32">
                      {(() => {
                        const maxCount = Math.max(...(analyticsData.userGrowth || []).map((d: any) => d.count), 1)
                        return (analyticsData.userGrowth || []).map((d: any, i: number) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div className="absolute -top-6 bg-gray-800 px-1.5 py-0.5 rounded text-[10px] text-white hidden group-hover:block whitespace-nowrap z-10">
                              {d.date}: {d.count} users
                            </div>
                            <div className="w-full bg-brand-500/40 rounded-t" style={{ height: `${Math.max(2, (d.count / maxCount) * 100)}%` }} />
                          </div>
                        ))
                      })()}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No signups in this period</p>
                  )}
                </div>

                {/* Sequence Stats */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 col-span-2">
                  <h3 className="text-sm font-semibold text-white mb-3">Email Sequences</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {(analyticsData.sequences || []).map((s: any) => (
                      <div key={s.id} className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                            {s.trigger}
                          </span>
                        </div>
                        <h4 className="text-xs font-medium text-white">{s.name}</h4>
                        <div className="text-[10px] text-gray-400 mt-1">{s.stepCount} steps &middot; {s.enrollmentCount} enrolled</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Click Refresh to load analytics data</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Referral Campaigns Tab ═══════════════ */}
      {activeTab === 'referral-campaigns' && (
        <div className="space-y-6">
          {/* Referral Campaigns Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Referral Campaigns</h2>
                <p className="text-sm text-gray-400">Time-limited referral bonus events with multipliers</p>
              </div>
              <button onClick={openReferralCampaignCreate} className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                <Plus className="h-4 w-4" />
                Create Campaign
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <input type="text" placeholder="Search referral campaigns..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20" />
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="h-4 w-4" /></button>
              )}
            </div>

            {filteredReferralCampaigns.length === 0 && referralCampaigns.length > 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No referral campaigns match &ldquo;{searchQuery}&rdquo;</p>
              </div>
            ) : referralCampaigns.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Gift className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No referral campaigns yet. Create one to boost referrals.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredReferralCampaigns.map((c: any) => (
                  <div key={c.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                          <Zap className="h-5 w-5 text-orange-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">{c.name}</h3>
                          <p className="text-xs text-gray-400">
                            {c.creditMultiplier}x credits {c.bonusCredits > 0 ? `+ ${c.bonusCredits} bonus` : ''} &middot;
                            {new Date(c.startsAt).toLocaleDateString()} - {new Date(c.endsAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right mr-2">
                          <div className="text-sm font-semibold text-white">{c.totalReferrals}</div>
                          <div className="text-xs text-gray-400">referrals</div>
                        </div>
                        <div className="text-right mr-2">
                          <div className="text-sm font-semibold text-white">{c.totalCreditsAwarded}</div>
                          <div className="text-xs text-gray-400">credits</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${REFERRAL_CAMPAIGN_STATUS_COLORS[c.status] || 'bg-gray-500/20 text-gray-400'}`}>
                          {c.status}
                        </span>
                        <button onClick={() => openReferralCampaignEdit(c)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteReferralCampaign(c.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {c.description && <p className="text-xs text-gray-500 mt-2">{c.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Badges Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Achievement Badges</h2>
              <p className="text-sm text-gray-400">Gamification badges awarded automatically to users</p>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {Object.entries(BADGE_INFO).map(([badge, info]) => {
                const count = badgeCounts.find((b: any) => b.badge === badge)?._count?.id || badgeCounts.find((b: any) => b.badge === badge)?.count || 0
                const Icon = info.icon
                return (
                  <div key={badge} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                    <div className="h-10 w-10 mx-auto rounded-full bg-white/[0.04] flex items-center justify-center mb-2">
                      <Icon className={`h-5 w-5 ${info.color}`} />
                    </div>
                    <h4 className="text-xs font-semibold text-white">{info.label}</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">{info.desc}</p>
                    <div className="text-lg font-bold text-white mt-2">{count}</div>
                    <div className="text-[10px] text-gray-500">users earned</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Email Templates Tab ═══════════════ */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Email Templates</h2>
              <p className="text-sm text-gray-400">Reusable email HTML templates for campaigns and sequences</p>
            </div>
            <button onClick={openTemplateCreate} className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              <Plus className="h-4 w-4" />
              Create Template
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input type="text" placeholder="Search templates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20" />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="h-4 w-4" /></button>
            )}
          </div>

          {filteredTemplates.length === 0 && templates.length > 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No templates match &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No templates yet. Create one to speed up email creation.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredTemplates.map((t: any) => (
                <div key={t.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{t.name}</h3>
                        <p className="text-xs text-gray-400">
                          {t.subject} &middot; {((t.variables as string[]) || []).length} variables
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-brand-500/20 text-brand-400">{t.category}</span>
                      <span className="text-xs text-gray-400">{t.usageCount} uses</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button onClick={() => openTemplateEdit(t)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteTemplate(t.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Marketing Calendar Tab ═══════════════ */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-semibold text-white">
                {(() => {
                  const [y, m] = calendarMonth.split('-').map(Number)
                  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                })()}
              </h2>
              <button onClick={() => navigateMonth(1)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <button
              onClick={() => { setCalendarEventForm({ title: '', description: '', date: '', endDate: '', color: '#6B7280' }); setCalendarEventModal(true) }}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <Plus className="h-4 w-4" />
              Add Event
            </button>
          </div>

          {/* Event type legend */}
          <div className="flex flex-wrap gap-3">
            {[
              { type: 'CAMPAIGN', color: 'bg-blue-500', label: 'Campaigns' },
              { type: 'BANNER', color: 'bg-purple-500', label: 'Banners' },
              { type: 'PROMO', color: 'bg-green-500', label: 'Promos' },
              { type: 'SEQUENCE', color: 'bg-orange-500', label: 'Sequences' },
              { type: 'REFERRAL_CAMPAIGN', color: 'bg-pink-500', label: 'Referral' },
              { type: 'EXPERIMENT', color: 'bg-yellow-500', label: 'Experiments' },
              { type: 'CUSTOM', color: 'bg-gray-500', label: 'Custom' },
            ].map((l) => (
              <div key={l.type} className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className={`h-2.5 w-2.5 rounded-full ${l.color}`} />
                {l.label}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-7 border-b border-white/[0.06]">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="px-2 py-2 text-center text-xs font-medium text-gray-500">{day}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7">
              {(() => {
                const [y, m] = calendarMonth.split('-').map(Number)
                const firstDay = new Date(y, m - 1, 1)
                const lastDay = new Date(y, m, 0)
                const startPad = (firstDay.getDay() + 6) % 7 // Monday=0
                const totalDays = lastDay.getDate()
                const cells = []

                for (let i = 0; i < startPad; i++) {
                  cells.push(<div key={`pad-${i}`} className="min-h-[80px] border-b border-r border-white/[0.04] bg-white/[0.01]" />)
                }

                for (let d = 1; d <= totalDays; d++) {
                  const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                  const dayEvents = calendarEvents.filter((e: any) => {
                    const eDate = e.date.split('T')[0]
                    const eEnd = e.endDate ? e.endDate.split('T')[0] : eDate
                    return dateStr >= eDate && dateStr <= eEnd
                  })
                  const isToday = dateStr === new Date().toISOString().split('T')[0]

                  cells.push(
                    <div key={d} className={`min-h-[80px] border-b border-r border-white/[0.04] p-1 ${isToday ? 'bg-brand-500/5' : ''}`}>
                      <div className={`text-xs font-medium mb-1 px-1 ${isToday ? 'text-brand-400' : 'text-gray-500'}`}>{d}</div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((e: any) => (
                          <div
                            key={e.id}
                            className="text-[10px] truncate rounded px-1 py-0.5 cursor-default"
                            style={{ backgroundColor: `${e.color}22`, color: e.color }}
                            title={`${e.title}\n${e.type}`}
                          >
                            {e.title.length > 18 ? e.title.slice(0, 18) + '...' : e.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[9px] text-gray-500 px-1">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  )
                }

                const remainder = (startPad + totalDays) % 7
                if (remainder > 0) {
                  for (let i = 0; i < 7 - remainder; i++) {
                    cells.push(<div key={`end-${i}`} className="min-h-[80px] border-b border-r border-white/[0.04] bg-white/[0.01]" />)
                  }
                }

                return cells
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ UTM Links Tab ═══════════════ */}
      {activeTab === 'utm-links' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">UTM Links</h2>
              <p className="text-sm text-gray-400">Trackable short links with UTM parameters for campaign attribution</p>
            </div>
            <button onClick={openUtmCreate} className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              <Plus className="h-4 w-4" />
              Create UTM Link
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input type="text" placeholder="Search UTM links..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-500/30 focus:ring-1 focus:ring-brand-500/20" />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="h-4 w-4" /></button>
            )}
          </div>

          {filteredUtmLinks.length === 0 && utmLinks.length > 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No UTM links match &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : utmLinks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Link2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No UTM links yet. Create one to track campaign performance.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredUtmLinks.map((link: any) => (
                <div key={link.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                        <Link2 className="h-5 w-5 text-cyan-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{link.destinationUrl}</p>
                          <button
                            onClick={() => copyUtmShortLink(link.shortCode)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.06] text-xs text-gray-300 hover:text-white transition flex-shrink-0"
                          >
                            {copiedLink === link.shortCode ? <CheckCircle className="h-3 w-3 text-green-400" /> : <Clipboard className="h-3 w-3" />}
                            /r/{link.shortCode}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400">{link.utmSource}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400">{link.utmMedium}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400">{link.utmCampaign}</span>
                          {link.utmTerm && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/20 text-orange-400">{link.utmTerm}</span>}
                          {link.utmContent && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-pink-500/20 text-pink-400">{link.utmContent}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-2">
                        <div className="text-sm font-semibold text-white">{link.totalClicks}</div>
                        <div className="text-xs text-gray-400">clicks</div>
                      </div>
                      <button onClick={() => fetchUtmStats(link)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition" title="View Stats">
                        <BarChart3 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => openUtmEdit(link)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white transition">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteUtmLink(link.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ Template Modal ═══════════════ */}
      {templateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setTemplateModal(false)} />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{editingTemplate ? 'Edit Template' : 'Create Template'}</h2>
              <button onClick={() => setTemplateModal(false)} className="p-1 rounded-lg hover:bg-white/[0.06] text-gray-400"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
                  <input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" placeholder="e.g. Welcome Email" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
                  <select value={templateForm.category} onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white">
                    {['WELCOME', 'PROMOTIONAL', 'NEWSLETTER', 'TRANSACTIONAL', 'NOTIFICATION', 'CUSTOM'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Subject Line</label>
                  <input value={templateForm.subject} onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" placeholder="e.g. Welcome to {{appName}}, {{userName}}!" />
                </div>
              </div>

              {/* AI Generate */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                <label className="block text-xs font-medium text-gray-400 mb-1">Generate with AI</label>
                <div className="flex gap-2">
                  <input value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)}
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white"
                    placeholder="Describe the email template you need..." />
                  <button onClick={generateTemplateAI} disabled={generatingTemplate || !templateDescription.trim()}
                    className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition disabled:opacity-50 flex items-center gap-2">
                    {generatingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Generate
                  </button>
                </div>
              </div>

              {/* Split view: editor + preview */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">HTML Body</label>
                  <textarea
                    value={templateForm.body}
                    onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                    className="w-full h-[400px] bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white font-mono resize-none"
                    placeholder="Paste or write HTML email content here..."
                  />
                  {/* Detected variables */}
                  {templateForm.body && (() => {
                    const vars = [...new Set((templateForm.body.match(/\{\{(\w+)\}\}/g) || []).map((m: string) => m.replace(/\{\{|\}\}/g, '')))]
                    return vars.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="text-[10px] text-gray-500">Variables:</span>
                        {vars.map((v) => (
                          <span key={v} className="px-1.5 py-0.5 rounded text-[10px] bg-brand-500/20 text-brand-400">{`{{${v}}}`}</span>
                        ))}
                      </div>
                    ) : null
                  })()}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Live Preview</label>
                  <div className="h-[400px] border border-white/[0.08] rounded-lg overflow-hidden bg-white">
                    {templateForm.body ? (
                      <iframe
                        srcDoc={templateForm.body.replace(/\{\{(\w+)\}\}/g, (_, name) => {
                          const samples: Record<string, string> = { userName: 'John Doe', email: 'john@example.com', appUrl: 'https://reelforge.ai', appName: 'ReelForge AI', unsubscribeUrl: '#' }
                          return samples[name] || `[${name}]`
                        })}
                        className="w-full h-full"
                        title="Preview"
                        sandbox="allow-same-origin"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        Preview will appear here
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={templateForm.isActive} onChange={(e) => setTemplateForm({ ...templateForm, isActive: e.target.checked })} className="accent-brand-500" />
                <span className="text-sm text-gray-300">Active</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/[0.06]">
              <button onClick={() => setTemplateModal(false)} className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition">Cancel</button>
              <button onClick={saveTemplate} disabled={savingTemplate || !templateForm.name || !templateForm.subject || !templateForm.body}
                className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition disabled:opacity-50">
                {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (editingTemplate ? 'Update Template' : 'Create Template')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Calendar Event Modal ═══════════════ */}
      {calendarEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCalendarEventModal(false)} />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Add Calendar Event</h2>
              <button onClick={() => setCalendarEventModal(false)} className="p-1 rounded-lg hover:bg-white/[0.06] text-gray-400"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                <input value={calendarEventForm.title} onChange={(e) => setCalendarEventForm({ ...calendarEventForm, title: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" placeholder="Event title" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                <textarea value={calendarEventForm.description} onChange={(e) => setCalendarEventForm({ ...calendarEventForm, description: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white h-20 resize-none" placeholder="Optional description" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Start Date</label>
                  <input type="datetime-local" value={calendarEventForm.date} onChange={(e) => setCalendarEventForm({ ...calendarEventForm, date: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">End Date (optional)</label>
                  <input type="datetime-local" value={calendarEventForm.endDate} onChange={(e) => setCalendarEventForm({ ...calendarEventForm, endDate: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Color</label>
                <div className="flex gap-2">
                  {['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#EF4444', '#6B7280'].map((c) => (
                    <button key={c} onClick={() => setCalendarEventForm({ ...calendarEventForm, color: c })}
                      className={`h-8 w-8 rounded-full border-2 transition ${calendarEventForm.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/[0.06]">
              <button onClick={() => setCalendarEventModal(false)} className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition">Cancel</button>
              <button onClick={saveCalendarEvent} disabled={savingCalendarEvent || !calendarEventForm.title || !calendarEventForm.date}
                className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition disabled:opacity-50">
                {savingCalendarEvent ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ UTM Link Modal ═══════════════ */}
      {utmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUtmModal(false)} />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{editingUtmLink ? 'Edit UTM Link' : 'Create UTM Link'}</h2>
              <button onClick={() => setUtmModal(false)} className="p-1 rounded-lg hover:bg-white/[0.06] text-gray-400"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Destination URL</label>
                <input value={utmForm.destinationUrl} onChange={(e) => setUtmForm({ ...utmForm, destinationUrl: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" placeholder="https://reelforge.ai/pricing" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Source *</label>
                  <input value={utmForm.utmSource} onChange={(e) => setUtmForm({ ...utmForm, utmSource: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" placeholder="e.g. facebook" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Medium *</label>
                  <input value={utmForm.utmMedium} onChange={(e) => setUtmForm({ ...utmForm, utmMedium: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" placeholder="e.g. cpc" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Campaign *</label>
                  <input value={utmForm.utmCampaign} onChange={(e) => setUtmForm({ ...utmForm, utmCampaign: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" placeholder="e.g. spring_sale" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Term (optional)</label>
                  <input value={utmForm.utmTerm} onChange={(e) => setUtmForm({ ...utmForm, utmTerm: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" placeholder="e.g. running+shoes" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Content (optional)</label>
                  <input value={utmForm.utmContent} onChange={(e) => setUtmForm({ ...utmForm, utmContent: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" placeholder="e.g. banner_ad" />
                </div>
              </div>

              {editingUtmLink && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                  <label className="block text-xs font-medium text-gray-400 mb-1">Short Link</label>
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-cyan-400">{window.location.origin}/api/r/{editingUtmLink.shortCode}</code>
                    <button onClick={() => copyUtmShortLink(editingUtmLink.shortCode)} className="p-1 rounded hover:bg-white/[0.06]">
                      {copiedLink === editingUtmLink.shortCode ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Clipboard className="h-4 w-4 text-gray-400" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/[0.06]">
              <button onClick={() => setUtmModal(false)} className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition">Cancel</button>
              <button onClick={saveUtmLink} disabled={savingUtmLink || !utmForm.destinationUrl || !utmForm.utmSource || !utmForm.utmMedium || !utmForm.utmCampaign}
                className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition disabled:opacity-50">
                {savingUtmLink ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (editingUtmLink ? 'Update Link' : 'Create Link')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ UTM Stats Modal ═══════════════ */}
      {utmStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUtmStatsModal(null)} />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Link Stats</h2>
                <p className="text-xs text-gray-400 truncate max-w-md">{utmStatsModal.destinationUrl}</p>
              </div>
              <button onClick={() => setUtmStatsModal(null)} className="p-1 rounded-lg hover:bg-white/[0.06] text-gray-400"><X className="h-5 w-5" /></button>
            </div>

            {!utmStats ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-white">{utmStats.totalClicks}</div>
                    <div className="text-xs text-gray-400">Total Clicks</div>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-white">{utmStats.uniqueVisitors}</div>
                    <div className="text-xs text-gray-400">Unique Visitors</div>
                  </div>
                </div>

                {/* Daily clicks */}
                {utmStats.dailyClicks?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">Daily Clicks (Last 30 Days)</h3>
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                      <div className="flex items-end gap-1 h-32">
                        {(() => {
                          const max = Math.max(...utmStats.dailyClicks.map((d: any) => d.count), 1)
                          return utmStats.dailyClicks.map((d: any, i: number) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${d.date}: ${d.count} clicks`}>
                              <div className="w-full bg-cyan-500/60 rounded-t" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }} />
                            </div>
                          ))
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Top referrers */}
                {utmStats.topReferrers?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">Top Referrers</h3>
                    <div className="space-y-1">
                      {utmStats.topReferrers.map((r: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs px-3 py-1.5 bg-white/[0.03] rounded">
                          <span className="text-gray-300 truncate max-w-xs">{r.referer}</span>
                          <span className="text-white font-medium">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top countries */}
                {utmStats.topCountries?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2">Top Countries</h3>
                    <div className="flex flex-wrap gap-2">
                      {utmStats.topCountries.map((c: any, i: number) => (
                        <span key={i} className="px-2 py-1 rounded bg-white/[0.06] text-xs text-gray-300">
                          {c.country} <span className="text-white font-medium">{c.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ Referral Campaign Modal ═══════════════ */}
      {referralCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReferralCampaignModal(false)} />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{editingReferralCampaign ? 'Edit Referral Campaign' : 'Create Referral Campaign'}</h2>
              <button onClick={() => setReferralCampaignModal(false)} className="p-1 rounded-lg hover:bg-white/[0.06] text-gray-400"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Campaign Name</label>
                <input value={referralCampaignForm.name} onChange={(e) => setReferralCampaignForm({ ...referralCampaignForm, name: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" placeholder="e.g. Double Credits Weekend" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                <input value={referralCampaignForm.description} onChange={(e) => setReferralCampaignForm({ ...referralCampaignForm, description: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" placeholder="Optional description" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Credit Multiplier ({referralCampaignForm.creditMultiplier}x)</label>
                  <input type="range" min="1" max="10" step="0.5" value={referralCampaignForm.creditMultiplier}
                    onChange={(e) => setReferralCampaignForm({ ...referralCampaignForm, creditMultiplier: Number(e.target.value) })}
                    className="w-full accent-brand-500" />
                  <div className="flex justify-between text-[10px] text-gray-500"><span>1x</span><span>10x</span></div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Bonus Credits</label>
                  <input type="number" min="0" value={referralCampaignForm.bonusCredits}
                    onChange={(e) => setReferralCampaignForm({ ...referralCampaignForm, bonusCredits: Number(e.target.value) })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Starts At</label>
                  <input type="datetime-local" value={referralCampaignForm.startsAt}
                    onChange={(e) => setReferralCampaignForm({ ...referralCampaignForm, startsAt: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Ends At</label>
                  <input type="datetime-local" value={referralCampaignForm.endsAt}
                    onChange={(e) => setReferralCampaignForm({ ...referralCampaignForm, endsAt: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                <select value={referralCampaignForm.status} onChange={(e) => setReferralCampaignForm({ ...referralCampaignForm, status: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white">
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Target Segment (optional)</label>
                <select value={referralCampaignForm.targetSegmentId} onChange={(e) => setReferralCampaignForm({ ...referralCampaignForm, targetSegmentId: e.target.value })}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white">
                  <option value="">All Users</option>
                  {segments.filter((s: any) => s.isActive).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.cachedCount} users)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/[0.06]">
              <button onClick={() => setReferralCampaignModal(false)} className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition">Cancel</button>
              <button onClick={saveReferralCampaign} disabled={savingReferralCampaign || !referralCampaignForm.name || !referralCampaignForm.startsAt || !referralCampaignForm.endsAt}
                className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition disabled:opacity-50">
                {savingReferralCampaign ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (editingReferralCampaign ? 'Update Campaign' : 'Create Campaign')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Delete Confirmation ═══════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#12121A] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Delete {deleteTarget.type === 'banner' ? 'Banner' : 'Promo Code'}</h3>
                <p className="text-xs text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-5">
              Are you sure you want to delete <span className="font-semibold text-white">"{deleteTarget.name}"</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

        </div>{/* end right content area */}
      </div>{/* end flex sidebar+content */}
    </div>
  )
}

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

/* ─────────────── page ─────────────── */
export default function AdminMarketingPage() {
  const [activeTab, setActiveTab] = useState<'banners' | 'promos' | 'notifications' | 'campaigns'>('banners')
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

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'banner' | 'promo' | 'campaign'; id: string; name: string } | null>(null)

  useEffect(() => {
    fetchBanners()
    fetchPromos()
    fetchNotifBatches()
    fetchCampaigns()
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

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
  }

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
      startsAt: '', expiresAt: '', dismissible: true, goal: '',
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

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] w-fit">
        <button
          onClick={() => setActiveTab('banners')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'banners'
              ? 'bg-brand-500/15 text-brand-400 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Bell className="h-4 w-4" />
          Banners & Announcements
          <span className="ml-1 text-xs bg-white/[0.06] px-1.5 py-0.5 rounded">{banners.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('promos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'promos'
              ? 'bg-brand-500/15 text-brand-400 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <TicketPercent className="h-4 w-4" />
          Promo Codes
          <span className="ml-1 text-xs bg-white/[0.06] px-1.5 py-0.5 rounded">{promos.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'notifications'
              ? 'bg-brand-500/15 text-brand-400 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Send className="h-4 w-4" />
          Notifications
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'campaigns'
              ? 'bg-brand-500/15 text-brand-400 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Mail className="h-4 w-4" />
          Email Campaigns
          <span className="ml-1 text-xs bg-white/[0.06] px-1.5 py-0.5 rounded">{campaigns.length}</span>
        </button>
      </div>

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

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : banners.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <Bell className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No banners yet</p>
              <p className="text-sm text-gray-500 mt-1">Create your first banner to engage users</p>
            </div>
          ) : (
            <div className="space-y-3">
              {banners.map((banner) => {
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

          {promos.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <TicketPercent className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No promo codes yet</p>
              <p className="text-sm text-gray-500 mt-1">Create promo codes to attract and retain users</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {promos.map((promo) => {
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

          {campaigns.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <Mail className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No email campaigns yet</p>
              <p className="text-sm text-gray-500 mt-1">Create your first campaign to reach users via email</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
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
              <button onClick={() => setNotifModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06]">
                <X className="h-5 w-5 text-gray-400" />
              </button>
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
              <button onClick={() => setCampaignModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06]">
                <X className="h-5 w-5 text-gray-400" />
              </button>
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
    </div>
  )
}

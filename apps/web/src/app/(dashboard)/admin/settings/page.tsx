'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Settings,
  Save,
  Loader2,
  Globe,
  Shield,
  CreditCard,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Upload,
  ImageIcon,
  Trash2,
  Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface AppSettings {
  [key: string]: string
}

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Logo upload state
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)

  // Auth guard
  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) {
      router.push('/login')
      return
    }
    if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
      router.push('/dashboard')
      toast.error('Super Admin access required')
    }
  }, [session, status, router])
  const [showNewPw, setShowNewPw] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings')
      const data = await res.json()
      setSettings(data.settings)
    } catch {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  function updateSetting(key: string, value: string) {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    setDirty(true)
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      toast.success('Settings saved')
      setDirty(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)

      const res = await fetch('/api/admin/settings/upload-logo', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      updateSetting('app_logo', data.url)
      toast.success('Logo uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  function handleRemoveLogo() {
    updateSetting('app_logo', '')
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required')
      return
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Password updated successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error(data.error || 'Failed to change password')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="text-center py-20 text-gray-400">
        Failed to load settings
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Settings className="h-6 w-6 text-brand-400" />
            App Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure global application settings
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>

      {/* ───────── Branding Section ───────── */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          Branding
        </h3>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Logo Upload */}
            <div className="flex-shrink-0">
              <label className="text-xs text-gray-400 font-medium mb-3 block">App Logo</label>
              <div className="flex items-start gap-4">
                <div className="h-24 w-24 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.03] flex items-center justify-center overflow-hidden relative group">
                  {settings.app_logo ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={settings.app_logo}
                        alt="App logo"
                        className="h-full w-full object-contain p-2"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <button
                          onClick={handleRemoveLogo}
                          className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-600" />
                  )}
                </div>
                <div className="pt-1">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                  </button>
                  <p className="text-[10px] text-gray-600 mt-2">PNG, JPEG, WebP, SVG. Max 2MB</p>
                </div>
              </div>
            </div>

            {/* Name & Tagline */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1.5 block">Application Name</label>
                <input
                  type="text"
                  value={settings.app_name || ''}
                  onChange={(e) => updateSetting('app_name', e.target.value)}
                  placeholder="ReelForge AI"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500 transition"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1.5 block">Tagline</label>
                <input
                  type="text"
                  value={settings.app_tagline || ''}
                  onChange={(e) => updateSetting('app_tagline', e.target.value)}
                  placeholder="AI-powered short video generation"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500 transition"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───────── Access & Limits Row ───────── */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
          <Shield className="h-3.5 w-3.5" />
          Access Control & Limits
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Toggle Cards */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
            {[
              { key: 'maintenance_mode', label: 'Maintenance Mode', desc: 'Disable access for non-admin users', color: 'text-red-400', dotColor: 'bg-red-400' },
              { key: 'signup_enabled', label: 'New Signups', desc: 'Allow new user registrations', color: 'text-green-400', dotColor: 'bg-green-400' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${settings[item.key] === 'true' ? item.dotColor : 'bg-gray-600'}`} />
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={settings[item.key] === 'true'}
                    onChange={(e) => updateSetting(item.key, e.target.checked ? 'true' : 'false')}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-brand-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
              </div>
            ))}
          </div>

          {/* Number Inputs */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1.5 block">Credits on Signup</label>
              <p className="text-[10px] text-gray-600 mb-1.5">Free credits given to new users</p>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                <input
                  type="number"
                  value={settings.default_credits_on_signup || ''}
                  onChange={(e) => updateSetting('default_credits_on_signup', e.target.value)}
                  placeholder="10"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500 transition"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1.5 block">Max Free Jobs / Day</label>
              <p className="text-[10px] text-gray-600 mb-1.5">Daily limit for free plan users</p>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-brand-400 flex-shrink-0" />
                <input
                  type="number"
                  value={settings.max_free_jobs_per_day || ''}
                  onChange={(e) => updateSetting('max_free_jobs_per_day', e.target.value)}
                  placeholder="3"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500 transition"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───────── Contact & Security Row ───────── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
          <Mail className="h-3.5 w-3.5" />
          Contact, Legal & Security
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Contact & Legal */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1.5 block">Support Email</label>
              <input
                type="email"
                value={settings.support_email || ''}
                onChange={(e) => updateSetting('support_email', e.target.value)}
                placeholder="support@reelforge.ai"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500 transition"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1.5 block">Terms of Service URL</label>
              <input
                type="url"
                value={settings.terms_url || ''}
                onChange={(e) => updateSetting('terms_url', e.target.value)}
                placeholder="https://reelforge.ai/terms"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500 transition"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1.5 block">Privacy Policy URL</label>
              <input
                type="url"
                value={settings.privacy_url || ''}
                onChange={(e) => updateSetting('privacy_url', e.target.value)}
                placeholder="https://reelforge.ai/privacy"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500 transition"
              />
            </div>
          </div>

          {/* Security — Change Password */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Lock className="h-4 w-4 text-orange-400" />
              <h4 className="text-sm font-semibold text-white">Change Password</h4>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 pr-10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showCurrentPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 pr-10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showNewPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-medium mb-1 block">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500 transition"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1 text-[10px] text-red-400">Passwords do not match</p>
                )}
              </div>

              <button
                onClick={handleChangePassword}
                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 border border-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20 transition disabled:opacity-40 mt-1"
              >
                {changingPassword ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

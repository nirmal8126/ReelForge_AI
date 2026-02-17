'use client'

import { useState, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import toast from 'react-hot-toast'

interface AppSettings {
  app_name: string
  app_tagline: string
  maintenance_mode: string
  signup_enabled: string
  default_credits_on_signup: string
  max_free_jobs_per_day: string
  support_email: string
  terms_url: string
  privacy_url: string
}

const SETTING_GROUPS = [
  {
    title: 'General',
    icon: Globe,
    iconColor: 'text-brand-400',
    fields: [
      { key: 'app_name', label: 'Application Name', type: 'text', placeholder: 'ReelForge AI' },
      { key: 'app_tagline', label: 'Tagline', type: 'text', placeholder: 'AI-powered short video generation' },
    ],
  },
  {
    title: 'Access Control',
    icon: Shield,
    iconColor: 'text-green-400',
    fields: [
      { key: 'maintenance_mode', label: 'Maintenance Mode', type: 'toggle', description: 'Disable access for non-admin users' },
      { key: 'signup_enabled', label: 'New Signups Enabled', type: 'toggle', description: 'Allow new user registrations' },
    ],
  },
  {
    title: 'Credits & Limits',
    icon: CreditCard,
    iconColor: 'text-yellow-400',
    fields: [
      { key: 'default_credits_on_signup', label: 'Credits on Signup', type: 'number', placeholder: '10', description: 'Free credits given to new users' },
      { key: 'max_free_jobs_per_day', label: 'Max Free Jobs / Day', type: 'number', placeholder: '3', description: 'Daily limit for free plan users' },
    ],
  },
  {
    title: 'Contact & Legal',
    icon: Mail,
    iconColor: 'text-blue-400',
    fields: [
      { key: 'support_email', label: 'Support Email', type: 'email', placeholder: 'support@reelforge.ai' },
      { key: 'terms_url', label: 'Terms of Service URL', type: 'url', placeholder: 'https://reelforge.ai/terms' },
      { key: 'privacy_url', label: 'Privacy Policy URL', type: 'url', placeholder: 'https://reelforge.ai/privacy' },
    ],
  },
]

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
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
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>

      {/* Settings Groups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {SETTING_GROUPS.map((group) => (
          <div
            key={group.title}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
          >
            <div className="flex items-center gap-2.5 mb-5">
              <group.icon className={`h-5 w-5 ${group.iconColor}`} />
              <h2 className="text-base font-semibold text-white">{group.title}</h2>
            </div>

            <div className="space-y-4">
              {group.fields.map((field) => (
                <div key={field.key}>
                  {field.type === 'toggle' ? (
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3.5">
                      <div>
                        <p className="text-sm font-medium text-white">{field.label}</p>
                        {field.description && (
                          <p className="text-[11px] text-gray-500 mt-0.5">{field.description}</p>
                        )}
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
                        <input
                          type="checkbox"
                          checked={settings[field.key as keyof AppSettings] === 'true'}
                          onChange={(e) =>
                            updateSetting(field.key, e.target.checked ? 'true' : 'false')
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-brand-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                      </label>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-gray-400 font-medium mb-1.5 block">
                        {field.label}
                      </label>
                      {field.description && (
                        <p className="text-[10px] text-gray-600 mb-1.5">{field.description}</p>
                      )}
                      <input
                        type={field.type}
                        value={settings[field.key as keyof AppSettings] || ''}
                        onChange={(e) => updateSetting(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Security — Change Password */}
      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 max-w-xl">
        <div className="flex items-center gap-2.5 mb-5">
          <Lock className="h-5 w-5 text-orange-400" />
          <h2 className="text-base font-semibold text-white">Security</h2>
        </div>

        <div className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="text-xs text-gray-400 font-medium mb-1.5 block">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="text-xs text-gray-400 font-medium mb-1.5 block">New Password</label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs text-gray-400 font-medium mb-1.5 block">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
            )}
          </div>

          <div className="pt-1">
            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
            >
              {changingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              {changingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

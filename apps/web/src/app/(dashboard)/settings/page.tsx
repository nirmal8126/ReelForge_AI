'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { User, Shield, Bell, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirmAction } from '@/lib/confirm'

// Profile schema
const profileSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be under 100 characters'),
})

type ProfileForm = z.infer<typeof profileSchema>

// Password schema
const passwordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(1, 'New password is required')
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be under 100 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmNewPassword: z
    .string()
    .min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmNewPassword'],
})

type PasswordForm = z.infer<typeof passwordSchema>

export default function SettingsPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Auth guard
  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) {
      router.push('/login')
    }
  }, [session, status, router])
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isDirty: profileDirty },
    reset: resetProfile,
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    mode: 'onTouched',
    defaultValues: { name: session?.user?.name || '' },
  })

  // Sync profile form when session loads
  useEffect(() => {
    if (session?.user?.name) {
      resetProfile({ name: session.user.name })
    }
  }, [session?.user?.name, resetProfile])

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPassword,
    watch: watchPassword,
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    mode: 'onTouched',
  })

  const newPasswordValue = watchPassword('newPassword', '')

  const handleDeactivateAccount = async () => {
    const confirmed = await confirmAction({
      title: 'Deactivate Account?',
      text: 'You will be logged out and won\'t be able to sign in until your account is reactivated by support.',
      confirmText: 'Deactivate',
      type: 'danger',
    })
    if (!confirmed) return

    setDeactivating(true)
    try {
      const res = await fetch('/api/auth/deactivate-account', { method: 'POST' })
      if (res.ok) {
        toast.success('Account deactivated. Redirecting...')
        await signOut({ redirect: false })
        window.location.href = '/login'
        return
      } else {
        toast.error('Failed to deactivate account')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setDeactivating(false)
    }
  }

  const onChangePassword = async (data: PasswordForm) => {
    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
      })
      const resData = await res.json()
      if (res.ok) {
        toast.success('Password changed successfully')
        setShowPasswordForm(false)
        resetPassword()
      } else {
        toast.error(resData.error || 'Failed to change password')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setChangingPassword(false)
    }
  }

  const onUpdateProfile = async (data: ProfileForm) => {
    setLoading(true)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name.trim() }),
      })
      if (res.ok) {
        toast.success('Profile updated!')
        await update()
      } else {
        toast.error('Failed to update profile')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8 pb-6 border-b border-white/[0.06]">
        <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-2">Manage your account preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Profile & Security */}
        <div className="space-y-6">
          {/* Profile */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <User className="h-5 w-5 text-brand-400" />
              <h2 className="text-lg font-semibold text-white">Profile</h2>
            </div>
            <form onSubmit={handleProfileSubmit(onUpdateProfile)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  {...registerProfile('name')}
                  className={`w-full rounded-lg bg-white/10 border px-4 py-2.5 text-white placeholder-gray-500 focus:ring-1 outline-none transition ${
                    profileErrors.name
                      ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500'
                      : 'border-white/10 focus:border-brand-500 focus:ring-brand-500'
                  }`}
                />
                {profileErrors.name && (
                  <p className="mt-1 text-xs text-red-400">{profileErrors.name.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={session?.user?.email || ''}
                  disabled
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Referral Code</label>
                <input
                  type="text"
                  value={session?.user?.referralCode || ''}
                  disabled
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-gray-400 font-mono cursor-not-allowed"
                />
              </div>
              <div className="flex justify-start pt-1">
                <button
                  type="submit"
                  disabled={loading || !profileDirty}
                  className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Security */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <Shield className="h-5 w-5 text-green-400" />
              <h2 className="text-lg font-semibold text-white">Security</h2>
            </div>
            <div className="space-y-4">
              {/* Password */}
              <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-white">Password</p>
                    <p className="text-xs text-gray-500 mt-0.5">Update your account password</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowPasswordForm(!showPasswordForm)
                      if (showPasswordForm) resetPassword()
                    }}
                    className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition"
                  >
                    {showPasswordForm ? 'Cancel' : 'Change'}
                  </button>
                </div>

                {showPasswordForm && (
                  <form onSubmit={handlePasswordSubmit(onChangePassword)} className="border-t border-white/10 p-4 space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Current Password</label>
                      <div className="relative">
                        <input
                          type={showCurrentPw ? 'text' : 'password'}
                          {...registerPassword('currentPassword')}
                          placeholder="Enter current password"
                          className={`w-full rounded-lg border bg-white/5 px-3 py-2 pr-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 transition ${
                            passwordErrors.currentPassword
                              ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500'
                              : 'border-white/10 focus:border-brand-500 focus:ring-brand-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPw(!showCurrentPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {passwordErrors.currentPassword && (
                        <p className="mt-1 text-xs text-red-400">{passwordErrors.currentPassword.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPw ? 'text' : 'password'}
                          {...registerPassword('newPassword')}
                          placeholder="Min 6 characters"
                          className={`w-full rounded-lg border bg-white/5 px-3 py-2 pr-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 transition ${
                            passwordErrors.newPassword
                              ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500'
                              : 'border-white/10 focus:border-brand-500 focus:ring-brand-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {passwordErrors.newPassword && (
                        <p className="mt-1 text-xs text-red-400">{passwordErrors.newPassword.message}</p>
                      )}
                      {newPasswordValue && !passwordErrors.newPassword && (
                        <div className="mt-1.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((i) => {
                                let score = 0
                                if (newPasswordValue.length >= 6) score++
                                if (newPasswordValue.length >= 10) score++
                                if (/[a-z]/.test(newPasswordValue) && /[A-Z]/.test(newPasswordValue)) score++
                                if (/[0-9]/.test(newPasswordValue)) score++
                                if (/[^a-zA-Z0-9]/.test(newPasswordValue)) score++
                                const color = score <= 1 ? 'bg-red-500' : score <= 2 ? 'bg-orange-500' : score <= 3 ? 'bg-yellow-500' : score <= 4 ? 'bg-green-500' : 'bg-emerald-500'
                                return (
                                  <div
                                    key={i}
                                    className={`flex-1 rounded-full transition-colors ${i <= score ? color : 'bg-white/10'}`}
                                  />
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        {...registerPassword('confirmNewPassword')}
                        placeholder="Re-enter new password"
                        className={`w-full rounded-lg border bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 transition ${
                          passwordErrors.confirmNewPassword
                            ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500'
                            : 'border-white/10 focus:border-brand-500 focus:ring-brand-500'
                        }`}
                      />
                      {passwordErrors.confirmNewPassword && (
                        <p className="mt-1 text-xs text-red-400">{passwordErrors.confirmNewPassword.message}</p>
                      )}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={changingPassword}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
                      >
                        {changingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {changingPassword ? 'Updating...' : 'Update Password'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Connected Accounts */}
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-sm font-medium text-white">Connected Accounts</p>
                  <p className="text-xs text-gray-500 mt-0.5">Google OAuth connected</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Notifications & Danger Zone */}
        <div className="space-y-6">
          {/* Notifications */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <Bell className="h-5 w-5 text-yellow-400" />
              <h2 className="text-lg font-semibold text-white">Notifications</h2>
            </div>
            <div className="space-y-1">
              {[
                { label: 'Reel generation complete', desc: 'Get notified when your reel is ready', defaultOn: true },
                { label: 'Usage alerts', desc: 'Alert at 80% and 100% quota usage', defaultOn: true },
                { label: 'New referral signups', desc: 'When someone signs up with your code', defaultOn: true },
                { label: 'Marketing emails', desc: 'Tips, features, and product updates', defaultOn: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg p-3 hover:bg-white/5 transition">
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
                    <input type="checkbox" defaultChecked={item.defaultOn} className="sr-only peer" />
                    <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-brand-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <Trash2 className="h-5 w-5 text-red-400" />
              <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Deactivating your account will log you out and prevent you from signing in. Your data will be preserved and can be restored by contacting support.
            </p>
            <button
              onClick={handleDeactivateAccount}
              disabled={deactivating}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition disabled:opacity-50"
            >
              {deactivating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deactivating ? 'Deactivating...' : 'Deactivate Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

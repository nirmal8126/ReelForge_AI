'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { User, Shield, Bell, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { data: session, update } = useSession()
  const [name, setName] = useState(session?.user?.name || '')
  const [loading, setLoading] = useState(false)

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
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
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account preferences</p>
      </div>

      {/* Profile Section */}
      <div className="rounded-xl border border-white/10 bg-white/5 mb-6">
        <div className="flex items-center gap-3 p-6 border-b border-white/10">
          <User className="h-5 w-5 text-brand-400" />
          <h2 className="text-lg font-semibold text-white">Profile</h2>
        </div>
        <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            />
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
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-white/10 bg-white/5 mb-6">
        <div className="flex items-center gap-3 p-6 border-b border-white/10">
          <Bell className="h-5 w-5 text-yellow-400" />
          <h2 className="text-lg font-semibold text-white">Notifications</h2>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: 'Reel generation complete', desc: 'Get notified when your reel is ready', defaultOn: true },
            { label: 'Usage alerts', desc: 'Alert at 80% and 100% quota usage', defaultOn: true },
            { label: 'New referral signups', desc: 'When someone signs up with your code', defaultOn: true },
            { label: 'Marketing emails', desc: 'Tips, features, and product updates', defaultOn: false },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked={item.defaultOn} className="sr-only peer" />
                <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-brand-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="rounded-xl border border-white/10 bg-white/5 mb-6">
        <div className="flex items-center gap-3 p-6 border-b border-white/10">
          <Shield className="h-5 w-5 text-green-400" />
          <h2 className="text-lg font-semibold text-white">Security</h2>
        </div>
        <div className="p-6 space-y-4">
          <button className="rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition">
            Change Password
          </button>
          <div>
            <p className="text-sm text-gray-300">Connected Accounts</p>
            <p className="text-xs text-gray-400 mt-1">Google OAuth connected</p>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/5">
        <div className="flex items-center gap-3 p-6 border-b border-red-500/20">
          <Trash2 className="h-5 w-5 text-red-400" />
          <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-400 mb-4">
            Once you delete your account, there is no going back. All your data, reels, and subscription will be permanently removed.
          </p>
          <button className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  )
}

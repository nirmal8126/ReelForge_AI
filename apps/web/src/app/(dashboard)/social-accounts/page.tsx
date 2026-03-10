'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Share2,
  Loader2,
  Youtube,
  Facebook,
  Instagram,
  ExternalLink,
  Trash2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface SocialAccount {
  id: string
  platform: string
  accountId: string
  accountName: string
  accountAvatar: string | null
  tokenExpiry: string | null
  scopes: string | null
  createdAt: string
}

interface PlatformConfig {
  id: string
  platformKey: string
  platformName: string
  status: 'ENABLED' | 'DISABLED' | 'COMING_SOON'
}

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  youtube: Youtube,
  facebook: Facebook,
  instagram: Instagram,
}

// Map Platform enum values to display names
const PLATFORM_DISPLAY: Record<string, { name: string; icon: React.ComponentType<{ className?: string }> }> = {
  YOUTUBE: { name: 'YouTube', icon: Youtube },
  FACEBOOK: { name: 'Facebook', icon: Facebook },
  INSTAGRAM: { name: 'Instagram', icon: Instagram },
}

export default function SocialAccountsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [platformConfigs, setPlatformConfigs] = useState<PlatformConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!session?.user) {
      router.push('/login')
      return
    }
    fetchData()
  }, [session, sessionStatus, router])

  // Show success/error toast from OAuth callback
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected) {
      toast.success(`${connected.charAt(0).toUpperCase() + connected.slice(1)} account connected successfully!`)
      // Clean up URL
      router.replace('/social-accounts')
    }
    if (error) {
      const messages: Record<string, string> = {
        missing_params: 'OAuth callback failed — missing parameters',
        invalid_state: 'Invalid state parameter — please try again',
        expired_state: 'OAuth session expired — please try again',
        unsupported_platform: 'Unsupported platform',
        not_configured: 'This platform is not configured yet',
        token_exchange_failed: 'Failed to exchange token — please try again',
        no_instagram_business: 'No Instagram Business account found. Make sure your Instagram is linked to a Facebook Page.',
        callback_failed: 'Something went wrong — please try again',
      }
      toast.error(messages[error] || 'Connection failed')
      router.replace('/social-accounts')
    }
  }, [searchParams, router])

  async function fetchData() {
    try {
      const res = await fetch('/api/social-accounts')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setAccounts(data.accounts)
      setPlatformConfigs(data.platformConfigs)
    } catch {
      toast.error('Failed to load social accounts')
    } finally {
      setLoading(false)
    }
  }

  async function disconnectAccount(accountId: string) {
    setDisconnecting(accountId)
    try {
      const res = await fetch(`/api/social-accounts?id=${accountId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to disconnect')
      setAccounts((prev) => prev.filter((a) => a.id !== accountId))
      toast.success('Account disconnected')
    } catch {
      toast.error('Failed to disconnect account')
    } finally {
      setDisconnecting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-brand-400 animate-spin" />
      </div>
    )
  }

  // Only show platforms that are not DISABLED
  const visiblePlatforms = platformConfigs.filter((p) => p.status !== 'DISABLED')

  // Group connected accounts by platform
  const accountsByPlatform = accounts.reduce<Record<string, SocialAccount[]>>((acc, account) => {
    if (!acc[account.platform]) acc[account.platform] = []
    acc[account.platform].push(account)
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
            <Share2 className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Social Accounts</h1>
            <p className="text-sm text-gray-500 mt-0.5">Connect your social media accounts to publish content directly</p>
          </div>
        </div>
      </div>

      {/* Connected Accounts */}
      {accounts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Connected Accounts</h2>
          <div className="space-y-3">
            {accounts.map((account) => {
              const display = PLATFORM_DISPLAY[account.platform]
              const Icon = display?.icon || Share2
              const isDisconnecting = disconnecting === account.id
              const isExpired = account.tokenExpiry && new Date(account.tokenExpiry) < new Date()
              const expiresSoon = !isExpired && account.tokenExpiry &&
                new Date(account.tokenExpiry).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 // 3 days

              return (
                <div
                  key={account.id}
                  className={`rounded-xl border p-4 flex items-center gap-4 ${
                    isExpired
                      ? 'border-red-500/30 bg-red-500/[0.03]'
                      : expiresSoon
                        ? 'border-yellow-500/20 bg-yellow-500/[0.02]'
                        : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  {/* Avatar / Icon */}
                  <div className="flex-shrink-0 relative">
                    {account.accountAvatar ? (
                      <img
                        src={account.accountAvatar}
                        alt={account.accountName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-brand-500/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-brand-400" />
                      </div>
                    )}
                    {/* Status dot */}
                    <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0a0a0f] ${
                      isExpired ? 'bg-red-500' : expiresSoon ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">{account.accountName}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{display?.name || account.platform}</span>
                      {isExpired ? (
                        <span className="text-xs text-orange-400 flex items-center gap-1">
                          <RefreshCw className="h-3 w-3 animate-spin" /> Auto-refreshing
                        </span>
                      ) : expiresSoon ? (
                        <span className="text-xs text-yellow-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Renewing soon
                        </span>
                      ) : (
                        <span className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Connected
                        </span>
                      )}
                    </div>
                    {account.tokenExpiry && (
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        {isExpired
                          ? 'Token will be refreshed automatically'
                          : `Renews: ${new Date(account.tokenExpiry).toLocaleDateString()}`}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Reconnect button — fallback if auto-refresh fails */}
                    {isExpired && (
                      <a
                        href={`/api/social-accounts/connect/${account.platform.toLowerCase()}`}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-md border border-white/10 hover:bg-white/[0.06] transition"
                        title="Use this if auto-refresh fails"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reconnect
                      </a>
                    )}
                    {/* Disconnect */}
                    <button
                      onClick={() => disconnectAccount(account.id)}
                      disabled={isDisconnecting}
                      className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-md border border-red-500/20 hover:bg-red-500/10 transition"
                    >
                      {isDisconnecting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Disconnect
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Available Platforms */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          {accounts.length > 0 ? 'Connect More Platforms' : 'Available Platforms'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visiblePlatforms.map((platform) => {
            const Icon = PLATFORM_ICONS[platform.platformKey] || Share2
            const isComingSoon = platform.status === 'COMING_SOON'

            // Check if already connected (by matching platform enum)
            const platformEnum = platform.platformKey.toUpperCase()
            const connectedAccounts = accountsByPlatform[platformEnum] || []
            const hasConnected = connectedAccounts.length > 0

            return (
              <div
                key={platform.platformKey}
                className={`rounded-xl border p-4 transition ${
                  isComingSoon
                    ? 'border-white/[0.04] bg-white/[0.01] opacity-50'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4.5 w-4.5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{platform.platformName}</h3>
                    {hasConnected && (
                      <p className="text-xs text-green-400">{connectedAccounts.length} connected</p>
                    )}
                  </div>
                </div>

                {isComingSoon ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md border border-yellow-500/20 bg-yellow-500/10 text-yellow-400">
                    Coming Soon
                  </span>
                ) : (
                  <a
                    href={`/api/social-accounts/connect/${platform.platformKey}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-500 transition"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {hasConnected ? 'Connect Another' : 'Connect'}
                  </a>
                )}
              </div>
            )
          })}
        </div>

        {visiblePlatforms.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Share2 className="h-8 w-8 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No social platforms are available yet.</p>
            <p className="text-xs text-gray-600 mt-1">Contact your admin to enable platforms.</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400 font-medium">How it works:</span>{' '}
          Connect your social media accounts to publish your generated content directly to YouTube, Facebook, and Instagram.
          You can connect multiple accounts and choose which ones to publish to for each job.
          Your tokens are stored securely, refreshed automatically before they expire, and can be disconnected at any time.
        </p>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Copy, Check, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function ReferralActions({ referralLink, referralCode }: { referralLink: string; referralCode: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    toast.success('Link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async (platform: string) => {
    const text = `I've been using ReelForge AI to create amazing video reels. Try it free with my referral link!`
    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + referralLink)}`,
    }

    if (urls[platform]) {
      window.open(urls[platform], '_blank', 'width=600,height=400')
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={referralLink}
          readOnly
          className="flex-1 rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-sm text-white"
        />
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400 mr-2">Share:</span>
        <button
          onClick={() => handleShare('twitter')}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition"
        >
          Twitter/X
        </button>
        <button
          onClick={() => handleShare('facebook')}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition"
        >
          Facebook
        </button>
        <button
          onClick={() => handleShare('whatsapp')}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition"
        >
          WhatsApp
        </button>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Your referral code: <span className="font-mono text-brand-400">{referralCode}</span>
      </p>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Copy, Check, Twitter, Facebook, MessageCircle, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function ReferralActions({ referralLink, referralCode }: { referralLink: string; referralCode: string }) {
  const [copied, setCopied] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    toast.success('Link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(referralCode)
    setCodeCopied(true)
    toast.success('Code copied to clipboard!')
    setTimeout(() => setCodeCopied(false), 2000)
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
    <div className="space-y-5">
      {/* Referral Link */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Your Referral Link</label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 overflow-hidden">
            <Link2 className="h-4 w-4 text-gray-500 flex-shrink-0 mr-2.5" />
            <span className="text-sm text-gray-300 truncate">{referralLink}</span>
          </div>
          <button
            onClick={handleCopyLink}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition flex-shrink-0 ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-brand-600 text-white hover:bg-brand-500'
            }`}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Referral Code */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Referral Code</label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center rounded-lg bg-white/5 border border-white/10 px-4 py-2.5">
            <span className="text-sm font-mono text-brand-400 tracking-wider">{referralCode}</span>
          </div>
          <button
            onClick={handleCopyCode}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition flex-shrink-0 ${
              codeCopied
                ? 'bg-green-600 text-white'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {codeCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Share Buttons */}
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2.5 uppercase tracking-wider">Share Via</label>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleShare('twitter')}
            className="flex items-center gap-2 rounded-lg bg-[#1DA1F2]/10 border border-[#1DA1F2]/20 px-4 py-2.5 text-sm font-medium text-[#1DA1F2] hover:bg-[#1DA1F2]/20 transition"
          >
            <Twitter className="h-4 w-4" />
            Twitter/X
          </button>
          <button
            onClick={() => handleShare('facebook')}
            className="flex items-center gap-2 rounded-lg bg-[#4267B2]/10 border border-[#4267B2]/20 px-4 py-2.5 text-sm font-medium text-[#4267B2] hover:bg-[#4267B2]/20 transition"
          >
            <Facebook className="h-4 w-4" />
            Facebook
          </button>
          <button
            onClick={() => handleShare('whatsapp')}
            className="flex items-center gap-2 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20 px-4 py-2.5 text-sm font-medium text-[#25D366] hover:bg-[#25D366]/20 transition"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}

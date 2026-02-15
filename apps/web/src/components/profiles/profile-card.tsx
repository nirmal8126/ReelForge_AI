'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Tv } from 'lucide-react'
import { EditProfileDialog } from './edit-profile-dialog'

interface ProfileCardProps {
  profile: {
    id: string
    name: string
    platform: string
    niche: string
    tone: string
    primaryColor: string
    isDefault: boolean
    consistencyScore: number
    _count: {
      reelJobs: number
    }
  }
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  return (
    <>
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition group">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: profile.primaryColor + '20' }}
            >
              <Tv className="h-5 w-5" style={{ color: profile.primaryColor }} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{profile.name}</h3>
              <p className="text-xs text-gray-400 capitalize">
                {profile.platform.toLowerCase()} &middot; {profile.niche}
              </p>
            </div>
          </div>
          {profile.isDefault && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400">
              Default
            </span>
          )}
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Tone</span>
            <span className="text-white capitalize">{profile.tone.toLowerCase()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Brand Color</span>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded" style={{ backgroundColor: profile.primaryColor }} />
              <span className="text-white">{profile.primaryColor}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Reels Created</span>
            <span className="text-white">{profile._count.reelJobs}</span>
          </div>
        </div>

        {/* Consistency Score */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400">Consistency Score</span>
            <span className="text-brand-400">{profile.consistencyScore}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10">
            <div
              className="h-1.5 rounded-full bg-brand-500"
              style={{ width: `${profile.consistencyScore}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/reels/new?profile=${profile.id}`}
            className="flex-1 text-center rounded-lg bg-brand-600 py-2 text-xs font-medium text-white hover:bg-brand-500 transition"
          >
            Create Reel
          </Link>
          <button
            onClick={() => setEditDialogOpen(true)}
            className="flex-1 text-center rounded-lg bg-white/10 py-2 text-xs font-medium text-white hover:bg-white/20 transition"
          >
            Edit Profile
          </button>
        </div>
      </div>

      <EditProfileDialog
        profileId={profile.id}
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
      />
    </>
  )
}

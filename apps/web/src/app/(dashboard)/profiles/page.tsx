import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Tv, BarChart3, Film } from 'lucide-react'
import { CreateProfileDialog } from '@/components/profiles/create-profile-dialog'

export default async function ProfilesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const profiles = await prisma.channelProfile.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { reelJobs: true } },
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Channel Profiles</h1>
          <p className="text-gray-400 mt-1">Manage your brand consistency across channels</p>
        </div>
        <CreateProfileDialog />
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-16 text-center">
          <Tv className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No channel profiles yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Channel profiles help you maintain consistent branding, tone, and visual style across all your reels.
          </p>
          <CreateProfileDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition group"
            >
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
                    <p className="text-xs text-gray-400 capitalize">{profile.platform.toLowerCase()} &middot; {profile.niche}</p>
                  </div>
                </div>
                {profile.isDefault && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400">Default</span>
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
                <Link
                  href={`/profiles/${profile.id}`}
                  className="flex-1 text-center rounded-lg bg-white/10 py-2 text-xs font-medium text-white hover:bg-white/20 transition"
                >
                  Edit Profile
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import { Tv } from 'lucide-react'
import { CreateProfileDialog } from '@/components/profiles/create-profile-dialog'
import { ProfileCard } from '@/components/profiles/profile-card'

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
      <div className="flex items-center justify-between mb-6 pb-5 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Channel Profiles</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your brand consistency across channels</p>
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
            <ProfileCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </div>
  )
}

import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlusCircle, Clapperboard, Users, Film } from 'lucide-react'
import { AdminUserBadge } from '@/components/admin-user-badge'
import { AdminDeleteButton } from '@/components/admin-delete-button'

export default async function CartoonStudioPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'ADMIN'

  const series = await prisma.cartoonSeries.findMany({
    where: isAdmin ? {} : { userId: session.user.id },
    include: {
      _count: { select: { characters: true, episodes: true } },
      characters: { take: 4, select: { name: true, color: true } },
      user: isAdmin ? { select: { id: true, name: true, email: true } } : false,
    },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/[0.06]">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{isAdmin ? 'All Cartoon Series' : 'Cartoon Studio'}</h1>
          <p className="text-sm text-gray-500 mt-2">
            Create animated cartoon series with recurring characters
          </p>
        </div>
        {!isAdmin && (
          <Link
            href="/cartoon-studio/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition shadow-lg shadow-brand-600/20"
          >
            <PlusCircle className="h-4 w-4" />
            New Series
          </Link>
        )}
      </div>

      {series.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
            <Clapperboard className="h-8 w-8 text-brand-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No series yet</h2>
          <p className="text-gray-400 text-sm max-w-md mb-6">
            Create your first cartoon series with unique characters and start generating episodes.
          </p>
          {!isAdmin && (
            <Link
              href="/cartoon-studio/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              <PlusCircle className="h-4 w-4" />
              Create Your First Series
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {series.map((s: typeof series[number]) => (
            <Link
              key={s.id}
              href={`/cartoon-studio/${s.id}`}
              className="group rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 hover:border-brand-500/50 transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
                  <Clapperboard className="h-5 w-5 text-brand-400" />
                </div>
                {s.artStyle && (
                  <span className="text-[10px] font-medium text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                    {s.artStyle}
                  </span>
                )}
              </div>

              <h3 className="text-white font-semibold mb-1 group-hover:text-brand-400 transition truncate">
                {s.name}
              </h3>
              {s.description && (
                <p className="text-gray-500 text-xs mb-3 line-clamp-2">{s.description}</p>
              )}

              {/* Character avatars */}
              {s.characters.length > 0 && (
                <div className="flex items-center gap-1 mb-3">
                  {s.characters.map((c, i) => (
                    <div
                      key={i}
                      className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: c.color || '#6366F1' }}
                      title={c.name}
                    >
                      {c.name[0].toUpperCase()}
                    </div>
                  ))}
                  {s._count.characters > 4 && (
                    <span className="text-[10px] text-gray-500 ml-1">
                      +{s._count.characters - 4}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {s._count.characters} characters
                </span>
                <span className="flex items-center gap-1">
                  <Film className="h-3 w-3" />
                  {s._count.episodes} episodes
                </span>
              </div>

              {isAdmin && s.user && (
                <AdminUserBadge
                  name={s.user.name || ''}
                  email={s.user.email || ''}
                />
              )}
              {isAdmin && (
                <div className="mt-2">
                  <AdminDeleteButton jobType="cartoonSeries" jobId={s.id} />
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

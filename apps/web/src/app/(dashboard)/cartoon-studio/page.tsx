import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlusCircle, Clapperboard, Users, Film, Clock, Globe, Palette, Monitor } from 'lucide-react'
import { AdminUserBadge } from '@/components/admin-user-badge'
import { AdminDeleteButton } from '@/components/admin-delete-button'
import { Pagination } from '@/components/pagination'

const LANGUAGE_LABELS: Record<string, string> = {
  hi: 'Hindi', en: 'English', es: 'Spanish', fr: 'French', de: 'German',
  ja: 'Japanese', ko: 'Korean', pt: 'Portuguese', zh: 'Chinese', ar: 'Arabic',
  bn: 'Bengali', ta: 'Tamil', te: 'Telugu', mr: 'Marathi', gu: 'Gujarati',
  kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi', ur: 'Urdu',
}

interface CartoonStudioPageProps {
  searchParams: { page?: string }
}

export default async function CartoonStudioPage({ searchParams }: CartoonStudioPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'ADMIN'
  const page = Math.max(1, parseInt(searchParams.page || '1', 10))
  const limit = 12
  const where = isAdmin ? {} : { userId: session.user.id }

  const [series, total] = await Promise.all([
    prisma.cartoonSeries.findMany({
      where,
      include: {
        _count: { select: { characters: true, episodes: true } },
        characters: { take: 4, select: { name: true, color: true } },
        user: isAdmin ? { select: { id: true, name: true, email: true } } : false,
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.cartoonSeries.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  function timeAgo(date: Date) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(date))
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-5 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{isAdmin ? 'All Cartoon Series' : 'Cartoon Studio'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} series created
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

      {/* Series Grid */}
      {series.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-16 text-center">
          <Clapperboard className="h-16 w-16 text-gray-600 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-white mb-2">No series yet</h3>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Create your first cartoon series with unique characters and start generating episodes.
          </p>
          {!isAdmin && (
            <Link
              href="/cartoon-studio/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white hover:bg-brand-500 transition"
            >
              <PlusCircle className="h-5 w-5" />
              Create Your First Series
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {series.map((s: typeof series[number]) => (
              <Link
                key={s.id}
                href={`/cartoon-studio/${s.id}`}
                className="group rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden hover:border-brand-500/40 hover:bg-white/[0.06] transition-all"
              >
                {/* Visual area */}
                <div className="relative aspect-[16/10] overflow-hidden">
                  {s.bannerUrl ? (
                    <img
                      src={s.bannerUrl}
                      alt={s.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand-600/30 to-purple-500/20 flex items-center justify-center">
                      <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                        <Clapperboard className="h-6 w-6 text-white/70" />
                      </div>
                    </div>
                  )}

                  {/* Logo overlay */}
                  {s.logoUrl && (
                    <img
                      src={s.logoUrl}
                      alt=""
                      className="absolute bottom-2 left-2 h-8 w-8 rounded-lg border-2 border-black/30 object-cover shadow-lg"
                    />
                  )}

                  {/* Top-left: art style badge */}
                  {s.artStyle && (
                    <div className="absolute top-1.5 left-1.5 rounded-md bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[11px] font-medium text-white flex items-center gap-1">
                      <Palette className="h-3 w-3" />
                      {s.artStyle}
                    </div>
                  )}

                  {/* Top-right: language badge */}
                  <div className="absolute top-1.5 right-1.5 rounded-md bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[11px] font-medium text-white flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {LANGUAGE_LABELS[s.language] || s.language}
                  </div>

                  {/* Bottom overlay: character avatars + counts */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                    <div className="flex items-center justify-between">
                      {/* Character avatars */}
                      <div className="flex items-center -space-x-1.5">
                        {s.characters.map((c, i) => (
                          <div
                            key={i}
                            className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-black/40"
                            style={{ backgroundColor: c.color || '#6366F1' }}
                            title={c.name}
                          >
                            {c.name[0].toUpperCase()}
                          </div>
                        ))}
                        {s._count.characters > 4 && (
                          <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium text-gray-300 bg-gray-700 border-2 border-black/40">
                            +{s._count.characters - 4}
                          </div>
                        )}
                      </div>
                      {/* Episode + aspect ratio badges */}
                      <div className="flex items-center gap-2 text-[11px] text-gray-300">
                        <span className="flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5">
                          <Film className="h-3 w-3" />
                          {s._count.episodes}
                        </span>
                        <span className="flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5">
                          <Monitor className="h-3 w-3" />
                          {s.aspectRatio}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-3.5">
                  <h3 className="text-sm font-semibold text-white truncate group-hover:text-brand-300 transition">
                    {s.name}
                  </h3>
                  {s.description && (
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{s.description}</p>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.05]">
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <Users className="h-3 w-3" />
                      {s._count.characters} chars
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <Clock className="h-3 w-3" />
                      {timeAgo(s.updatedAt)}
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
                </div>
              </Link>
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            basePath="/cartoon-studio"
          />
        </>
      )}
    </div>
  )
}

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  /** Items per page (for accurate range display) */
  perPage?: number
  /** Base path e.g. "/reels" */
  basePath: string
  /** Extra query params to preserve e.g. { status: "completed" } */
  searchParams?: Record<string, string>
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  perPage,
  basePath,
  searchParams = {},
}: PaginationProps) {
  if (totalPages <= 1) return null

  function buildHref(page: number): string {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value)
    }
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  // Build visible page numbers: first, last, and ±1 around current
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
  )

  const itemsPerPage = perPage || Math.ceil(totalItems / totalPages)
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="flex items-center justify-between mt-8 pt-5 border-t border-white/[0.06]">
      {/* Left: item range */}
      <p className="text-sm text-gray-500">
        <span className="text-gray-400 font-medium">{startItem}–{endItem}</span> of{' '}
        <span className="text-gray-400 font-medium">{totalItems}</span>
      </p>

      {/* Center: page numbers */}
      <div className="flex items-center gap-1">
        {/* Previous */}
        {currentPage > 1 ? (
          <Link
            href={buildHref(currentPage - 1)}
            className="flex items-center justify-center h-9 w-9 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className="flex items-center justify-center h-9 w-9 rounded-lg border border-white/[0.05] bg-white/[0.02] text-gray-700 cursor-not-allowed">
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}

        {/* Page numbers */}
        {pages.map((p, idx) => {
          const showEllipsis = idx > 0 && p - pages[idx - 1] > 1
          return (
            <span key={p} className="flex items-center">
              {showEllipsis && (
                <span className="flex items-center justify-center h-9 w-6 text-gray-600 text-sm">
                  ...
                </span>
              )}
              <Link
                href={buildHref(p)}
                className={`min-w-[36px] h-9 flex items-center justify-center rounded-lg text-sm font-medium transition ${
                  p === currentPage
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {p}
              </Link>
            </span>
          )
        })}

        {/* Next */}
        {currentPage < totalPages ? (
          <Link
            href={buildHref(currentPage + 1)}
            className="flex items-center justify-center h-9 w-9 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="flex items-center justify-center h-9 w-9 rounded-lg border border-white/[0.05] bg-white/[0.02] text-gray-700 cursor-not-allowed">
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>

      {/* Right: page X of Y */}
      <p className="text-sm text-gray-500">
        Page <span className="text-gray-400 font-medium">{currentPage}</span> of{' '}
        <span className="text-gray-400 font-medium">{totalPages}</span>
      </p>
    </div>
  )
}

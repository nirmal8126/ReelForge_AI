'use client'

import { useState, useCallback } from 'react'
import { X, Search, Loader2, Play } from 'lucide-react'
import type { StockSearchResult } from './types'

interface StockSearchModalProps {
  jobId: string
  initialQuery: string
  onSelect: (previewUrl: string) => void
  onClose: () => void
}

export function StockSearchModal({ jobId, initialQuery, onSelect, onClose }: StockSearchModalProps) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<StockSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setIsSearching(true)
    setHasSearched(true)

    try {
      const res = await fetch(`/api/long-form/${jobId}/stock-search?query=${encodeURIComponent(query)}`)
      if (!res.ok) {
        setResults([])
        return
      }
      const data = await res.json()
      setResults(data.results || [])
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [jobId, query])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[80vh] bg-gray-900 rounded-2xl border border-white/10 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Find Stock Footage</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-white/10">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearch()
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for stock footage..."
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-40"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </button>
          </form>
        </div>

        {/* Results Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-brand-400 animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => onSelect(result.previewUrl)}
                  onMouseEnter={() => setHoveredId(result.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="relative rounded-lg overflow-hidden border border-white/10 hover:border-brand-500 transition-all group aspect-video bg-gray-800"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.thumbnail}
                    alt="Stock footage"
                    className="w-full h-full object-cover"
                  />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="h-8 w-8 text-white" />
                  </div>

                  {/* Duration badge */}
                  <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                    {result.duration}s
                  </span>
                </button>
              ))}
            </div>
          ) : hasSearched ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Search className="h-8 w-8 mb-2" />
              <p className="text-sm">No results found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Search className="h-8 w-8 mb-2" />
              <p className="text-sm">Search for stock footage to use in your video</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 text-center">
          <p className="text-[10px] text-gray-600">
            Powered by Pexels — free stock footage for commercial use
          </p>
        </div>
      </div>
    </div>
  )
}

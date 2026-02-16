'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Option {
  value: string
  label: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  searchPlaceholder?: string
  className?: string
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch('') }}
        className={cn(
          'w-full flex items-center justify-between rounded-lg border bg-white/5 px-4 py-2.5 text-sm transition',
          open
            ? 'border-brand-500 ring-1 ring-brand-500/20'
            : 'border-white/10 hover:border-white/20',
        )}
      >
        <span className={selected ? 'text-white' : 'text-gray-500'}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1.5">
          {selected && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
                setOpen(false)
              }}
              className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={cn('h-4 w-4 text-gray-500 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-lg border border-white/10 bg-gray-900 shadow-xl shadow-black/40 overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
            <Search className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
            />
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-gray-500">
                No results found
              </div>
            ) : (
              filtered.map((option) => {
                const isSelected = option.value === value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition',
                      isSelected
                        ? 'bg-brand-500/10 text-brand-400'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <span className="flex-1 truncate">{option.label}</span>
                    {isSelected && <Check className="h-4 w-4 text-brand-400 flex-shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts'
import { ArrowUpRight, ArrowDownRight, RefreshCw, Loader2 } from 'lucide-react'

/* ─── Shared tooltip style ─── */

const tooltipStyle = {
  contentStyle: {
    background: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#fff',
  },
  itemStyle: { color: '#9ca3af' },
  labelStyle: { color: '#fff', fontWeight: 600, marginBottom: 4 },
}

/* ─── Revenue vs Cost Chart ─── */

export function RevenueVsCostChart({
  data,
}: {
  data: { date: string; revenue: number; cost: number }[]
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[280px] text-sm text-gray-600">
        No data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F97316" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#6B7280' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#6B7280' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v}`}
        />
        <Tooltip
          contentStyle={tooltipStyle.contentStyle}
          itemStyle={tooltipStyle.itemStyle}
          labelStyle={tooltipStyle.labelStyle}
          formatter={(value: number) => [`$${value.toFixed(2)}`, undefined]}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#10B981"
          strokeWidth={2}
          fill="url(#revenueGrad)"
        />
        <Area
          type="monotone"
          dataKey="cost"
          name="Est. Cost"
          stroke="#F97316"
          strokeWidth={2}
          fill="url(#costGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ─── Cost Breakdown by Module ─── */

export function CostBreakdownChart({
  data,
}: {
  data: { module: string; cost: number; count: number; color: string }[]
}) {
  if (data.length === 0 || data.every((d) => d.cost === 0)) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-gray-600">
        No completed jobs yet
      </div>
    )
  }

  const maxCost = Math.max(...data.map((d) => d.cost), 1)

  return (
    <div className="space-y-3 mt-2">
      {data.map((item) => (
        <div key={item.module}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-300">{item.module}</span>
            <span className="text-xs text-gray-500">
              ${(item.cost / 100).toFixed(2)} &middot; {item.count.toLocaleString()} jobs
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.06]">
            <div
              className="h-2.5 rounded-full transition-all"
              style={{
                width: `${Math.max((item.cost / maxCost) * 100, 2)}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Growth Indicator Card ─── */

export function GrowthIndicator({
  label,
  value,
  suffix = '%',
  positive,
  neutral,
}: {
  label: string
  value: number
  suffix?: string
  positive: boolean
  neutral?: boolean
}) {
  const color = neutral
    ? 'text-gray-400'
    : positive
      ? 'text-emerald-400'
      : 'text-red-400'
  const bgColor = neutral
    ? 'bg-gray-500/10 border-gray-500/20'
    : positive
      ? 'bg-emerald-500/10 border-emerald-500/20'
      : 'bg-red-500/10 border-red-500/20'

  return (
    <div className={`rounded-xl border ${bgColor} p-5`}>
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        {!neutral && (
          positive ? (
            <ArrowUpRight className="h-5 w-5 text-emerald-400" />
          ) : (
            <ArrowDownRight className="h-5 w-5 text-red-400" />
          )
        )}
        <span className={`text-2xl font-bold ${color}`}>
          {positive && !neutral ? '+' : ''}{value}{suffix}
        </span>
      </div>
    </div>
  )
}

/* ─── Service Status Panel ─── */

interface ServiceInfo {
  key: string
  name: string
  category: string
  isConfigured: boolean
}

export function ServiceStatusPanel({
  services,
}: {
  services: ServiceInfo[]
}) {
  const [checking, setChecking] = useState(false)
  const [statuses, setStatuses] = useState(services)

  async function refreshStatus() {
    setChecking(true)
    try {
      const res = await fetch('/api/admin/financials', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setStatuses((prev) =>
          prev.map((svc) => {
            const updated = data.services.find((s: ServiceInfo) => s.key === svc.key)
            return updated ? { ...svc, isConfigured: updated.isConfigured } : svc
          })
        )
      }
    } catch {
      // ignore
    } finally {
      setChecking(false)
    }
  }

  // Group by category
  const grouped: Record<string, ServiceInfo[]> = {}
  for (const svc of statuses) {
    if (!grouped[svc.category]) grouped[svc.category] = []
    grouped[svc.category].push(svc)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Third-Party Services</h3>
        <button
          onClick={refreshStatus}
          disabled={checking}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition disabled:opacity-50"
        >
          {checking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, svcs]) => (
          <div key={category}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">
              {category}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {svcs.map((svc) => (
                <div
                  key={svc.key}
                  className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <span
                    className={`h-2 w-2 rounded-full flex-shrink-0 ${
                      svc.isConfigured ? 'bg-emerald-400' : 'bg-gray-600'
                    }`}
                  />
                  <span className="text-sm text-white flex-1">{svc.name}</span>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      svc.isConfigured
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-gray-500/10 text-gray-500'
                    }`}
                  >
                    {svc.isConfigured ? 'Active' : 'Not configured'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

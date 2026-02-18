'use client'

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

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

/* ─── User Charts ─── */

// Module breakdown donut
const MODULE_COLORS: Record<string, string> = {
  Reels: '#6366F1',
  Quotes: '#06B6D4',
  Challenges: '#F97316',
  Gameplay: '#EC4899',
  'Long-Form': '#818CF8',
  Cartoon: '#10B981',
}

export function ModuleBreakdownChart({
  data,
}: {
  data: { name: string; value: number }[]
}) {
  const filtered = data.filter((d) => d.value > 0)

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-gray-600">
        No content created yet
      </div>
    )
  }

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width="50%" height={200}>
        <PieChart>
          <Pie
            data={filtered}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {filtered.map((entry) => (
              <Cell key={entry.name} fill={MODULE_COLORS[entry.name] || '#6B7280'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle.contentStyle}
            itemStyle={tooltipStyle.itemStyle}
            labelStyle={tooltipStyle.labelStyle}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-2">
        {filtered.map((item) => (
          <div key={item.name} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: MODULE_COLORS[item.name] || '#6B7280' }}
            />
            <span className="text-xs text-gray-400 flex-1">{item.name}</span>
            <span className="text-xs font-semibold text-white">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// User creation timeline (area chart)
export function CreationTimelineChart({
  data,
}: {
  data: { date: string; count: number }[]
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-gray-600">
        No data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="userAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={tooltipStyle.contentStyle}
          itemStyle={tooltipStyle.itemStyle}
          labelStyle={tooltipStyle.labelStyle}
        />
        <Area
          type="monotone"
          dataKey="count"
          name="Jobs"
          stroke="#6366F1"
          strokeWidth={2}
          fill="url(#userAreaGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ─── Admin Charts ─── */

// User signups over time (area chart)
export function SignupsChart({
  data,
}: {
  data: { date: string; count: number }[]
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-gray-600">
        No data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
        </defs>
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
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={tooltipStyle.contentStyle}
          itemStyle={tooltipStyle.itemStyle}
          labelStyle={tooltipStyle.labelStyle}
        />
        <Area
          type="monotone"
          dataKey="count"
          name="Signups"
          stroke="#3B82F6"
          strokeWidth={2}
          fill="url(#signupGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Jobs per day bar chart (stacked by module)
const MODULE_BAR_COLORS = [
  '#6366F1', // reels
  '#06B6D4', // quotes
  '#F97316', // challenges
  '#EC4899', // gameplay
  '#818CF8', // longform
  '#10B981', // cartoon
]

export function JobsPerDayChart({
  data,
}: {
  data: { date: string; reels: number; quotes: number; challenges: number; gameplay: number; longform: number; cartoon: number }[]
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-gray-600">
        No data yet
      </div>
    )
  }

  const modules = ['reels', 'quotes', 'challenges', 'gameplay', 'longform', 'cartoon']

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
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
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={tooltipStyle.contentStyle}
          itemStyle={tooltipStyle.itemStyle}
          labelStyle={tooltipStyle.labelStyle}
        />
        {modules.map((mod, i) => (
          <Bar
            key={mod}
            dataKey={mod}
            name={mod.charAt(0).toUpperCase() + mod.slice(1)}
            stackId="jobs"
            fill={MODULE_BAR_COLORS[i]}
            radius={i === modules.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// Revenue by plan horizontal bar
export function RevenuePlanChart({
  data,
}: {
  data: { plan: string; revenue: number; subscribers: number; color: string }[]
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-gray-600">
        No subscribers yet
      </div>
    )
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1)

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.plan}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-300">{item.plan}</span>
            <span className="text-xs text-gray-500">
              ${item.revenue}/mo &middot; {item.subscribers} sub{item.subscribers !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06]">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${(item.revenue / maxRevenue) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

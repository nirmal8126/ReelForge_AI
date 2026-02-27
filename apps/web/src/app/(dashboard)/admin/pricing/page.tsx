'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Globe,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  Star,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  Search,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface PlanPrice {
  id?: string
  plan: string
  priceAmount: number
  stripePriceId: string | null
}

interface CreditPrice {
  id?: string
  credits: number
  priceAmount: number
  label: string
}

interface PricingRegion {
  id: string
  name: string
  currency: string
  currencySymbol: string
  countries: string[]
  isDefault: boolean
  planPrices: PlanPrice[]
  creditPrices: CreditPrice[]
}

const PLANS = ['FREE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const
const DEFAULT_CREDIT_PACKAGES = [
  { credits: 10, label: '10 Credits' },
  { credits: 50, label: '50 Credits' },
  { credits: 100, label: '100 Credits' },
]

const CURRENCIES = [
  { code: 'usd', symbol: '$', name: 'US Dollar' },
  { code: 'eur', symbol: '€', name: 'Euro' },
  { code: 'gbp', symbol: '£', name: 'British Pound' },
  { code: 'inr', symbol: '₹', name: 'Indian Rupee' },
  { code: 'jpy', symbol: '¥', name: 'Japanese Yen' },
  { code: 'cny', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'krw', symbol: '₩', name: 'South Korean Won' },
  { code: 'brl', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'cad', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'aud', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'mxn', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'sgd', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'hkd', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'sek', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'nok', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'dkk', symbol: 'kr', name: 'Danish Krone' },
  { code: 'chf', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'pln', symbol: 'zł', name: 'Polish Zloty' },
  { code: 'czk', symbol: 'Kč', name: 'Czech Koruna' },
  { code: 'try', symbol: '₺', name: 'Turkish Lira' },
  { code: 'zar', symbol: 'R', name: 'South African Rand' },
  { code: 'aed', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'sar', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'myr', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'thb', symbol: '฿', name: 'Thai Baht' },
  { code: 'idr', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'php', symbol: '₱', name: 'Philippine Peso' },
  { code: 'vnd', symbol: '₫', name: 'Vietnamese Dong' },
  { code: 'pkr', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'bdt', symbol: '৳', name: 'Bangladeshi Taka' },
  { code: 'lkr', symbol: 'Rs', name: 'Sri Lankan Rupee' },
  { code: 'ngn', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'egp', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'kes', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'ghc', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'cop', symbol: 'COL$', name: 'Colombian Peso' },
  { code: 'ars', symbol: 'AR$', name: 'Argentine Peso' },
  { code: 'clp', symbol: 'CL$', name: 'Chilean Peso' },
  { code: 'pen', symbol: 'S/.', name: 'Peruvian Sol' },
  { code: 'nzd', symbol: 'NZ$', name: 'New Zealand Dollar' },
]

const COUNTRY_LIST = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'EE', name: 'Estonia' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MO', name: 'Macau' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'MT', name: 'Malta' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PA', name: 'Panama' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
]

/* ── Searchable single-select dropdown ── */
function CurrencyDropdown({
  value,
  onChange,
}: {
  value: string
  onChange: (code: string, symbol: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = CURRENCIES.filter(
    (c) =>
      c.code.includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.symbol.includes(search)
  )

  const selected = CURRENCIES.find((c) => c.code === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
      >
        <span className={selected ? 'text-white' : 'text-gray-600'}>
          {selected ? `${selected.code.toUpperCase()} (${selected.symbol}) — ${selected.name}` : 'Select currency'}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-gray-800 shadow-xl max-h-56 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
            <Search className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search currency..."
              autoFocus
              className="w-full bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
            />
          </div>
          <div className="overflow-y-auto max-h-44">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-500">No currencies found</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onChange(c.code, c.symbol)
                    setSearch('')
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/10 transition ${
                    c.code === value ? 'bg-brand-500/10 text-brand-400' : 'text-gray-300'
                  }`}
                >
                  <span className="font-medium">{c.code.toUpperCase()}</span>
                  <span className="ml-1.5 text-gray-500">({c.symbol})</span>
                  <span className="ml-1.5 text-gray-500">— {c.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Multi-select country dropdown with search + tags ── */
function CountryMultiSelect({
  value,
  onChange,
}: {
  value: string[]
  onChange: (codes: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = COUNTRY_LIST.filter(
    (c) =>
      !value.includes(c.code) &&
      (c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase()))
  )

  function addCountry(code: string) {
    onChange([...value, code])
    setSearch('')
  }

  function removeCountry(code: string) {
    onChange(value.filter((c) => c !== code))
  }

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(true)}
        className="w-full min-h-[38px] flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 cursor-text focus-within:border-brand-500"
      >
        {value.map((code) => {
          const country = COUNTRY_LIST.find((c) => c.code === code)
          return (
            <span
              key={code}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20"
            >
              {code}
              {country && <span className="text-gray-500 font-normal">({country.name})</span>}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeCountry(code)
                }}
                className="ml-0.5 text-gray-500 hover:text-white transition"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )
        })}
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={value.length === 0 ? 'Search & select countries...' : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none py-0.5"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-gray-800 shadow-xl max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">
              {search ? 'No countries found' : 'All countries selected'}
            </p>
          ) : (
            filtered.slice(0, 50).map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => addCountry(c.code)}
                className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10 transition"
              >
                <span className="font-medium">{c.code}</span>
                <span className="ml-2 text-gray-500">{c.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminPricingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [regions, setRegions] = useState<PricingRegion[]>([])
  const [loading, setLoading] = useState(true)

  // Auth guard
  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user) {
      router.push('/login')
      return
    }
    if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
      router.push('/dashboard')
    }
  }, [session, status, router])

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editRegion, setEditRegion] = useState<PricingRegion | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete modal
  const [deleteRegion, setDeleteRegion] = useState<PricingRegion | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formCurrency, setFormCurrency] = useState('')
  const [formSymbol, setFormSymbol] = useState('')
  const [formCountries, setFormCountries] = useState<string[]>([])
  const [formIsDefault, setFormIsDefault] = useState(false)
  const [formPlanPrices, setFormPlanPrices] = useState<{ plan: string; priceAmount: string; stripePriceId: string }[]>([])
  const [formCreditPrices, setFormCreditPrices] = useState<{ credits: number; priceAmount: string; label: string }[]>([])

  const fetchRegions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pricing')
      const data = await res.json()
      setRegions(data.regions || [])
    } catch {
      toast.error('Failed to load pricing regions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRegions()
  }, [fetchRegions])

  function openCreateModal() {
    setEditRegion(null)
    setFormName('')
    setFormCurrency('usd')
    setFormSymbol('$')
    setFormCountries([])
    setFormIsDefault(false)
    setFormPlanPrices(PLANS.map((p) => ({ plan: p, priceAmount: '0', stripePriceId: '' })))
    setFormCreditPrices(DEFAULT_CREDIT_PACKAGES.map((c) => ({ credits: c.credits, priceAmount: '0', label: c.label })))
    setShowModal(true)
  }

  function openEditModal(region: PricingRegion) {
    setEditRegion(region)
    setFormName(region.name)
    setFormCurrency(region.currency)
    setFormSymbol(region.currencySymbol)
    setFormCountries(region.countries || [])
    setFormIsDefault(region.isDefault)
    setFormPlanPrices(
      PLANS.map((plan) => {
        const existing = region.planPrices.find((p) => p.plan === plan)
        return {
          plan,
          priceAmount: existing ? String(existing.priceAmount) : '0',
          stripePriceId: existing?.stripePriceId || '',
        }
      })
    )
    setFormCreditPrices(
      DEFAULT_CREDIT_PACKAGES.map((pkg) => {
        const existing = region.creditPrices.find((c) => c.credits === pkg.credits)
        return {
          credits: pkg.credits,
          priceAmount: existing ? String(existing.priceAmount) : '0',
          label: existing?.label || pkg.label,
        }
      })
    )
    setShowModal(true)
  }

  async function handleSave() {
    if (!formName.trim() || !formCurrency.trim() || !formSymbol.trim()) {
      toast.error('Name, currency, and symbol are required')
      return
    }

    setSaving(true)
    try {
      const countries = formCountries.map((c) => c.toUpperCase())

      const planPrices = formPlanPrices.map((p) => ({
        plan: p.plan,
        priceAmount: parseInt(p.priceAmount) || 0,
        stripePriceId: p.stripePriceId || null,
      }))

      const creditPrices = formCreditPrices.map((c) => ({
        credits: c.credits,
        priceAmount: parseInt(c.priceAmount) || 0,
        label: c.label,
      }))

      const payload = {
        ...(editRegion && { id: editRegion.id }),
        name: formName.trim(),
        currency: formCurrency.trim(),
        currencySymbol: formSymbol.trim(),
        countries,
        isDefault: formIsDefault,
        planPrices,
        creditPrices,
      }

      const res = await fetch('/api/admin/pricing', {
        method: editRegion ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      toast.success(editRegion ? 'Region updated' : 'Region created')
      setShowModal(false)
      fetchRegions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteRegion) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/pricing?id=${deleteRegion.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      toast.success('Region deleted')
      setDeleteRegion(null)
      fetchRegions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  function formatPrice(amount: number, symbol: string) {
    return `${symbol}${(amount / 100).toFixed(2)}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-5 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Globe className="h-6 w-6 text-brand-400" />
            Pricing Regions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage country/currency-specific pricing for plans and credits
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition"
        >
          <Plus className="h-4 w-4" />
          Add Region
        </button>
      </div>

      {/* Module Credit Cost Reference */}
      <div className="rounded-xl border border-yellow-500/10 bg-yellow-500/[0.03] p-5 mb-6">
        <h3 className="text-sm font-semibold text-yellow-400 mb-3">Credit Cost Reference — set credit prices to stay profitable</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { name: 'Reels', range: '1-3 cr', detail: 'By duration' },
            { name: 'Quotes', range: '1 cr', detail: 'Flat' },
            { name: 'Challenges', range: '1-3 cr', detail: 'Q count + voice' },
            { name: 'Gameplay', range: '1-3 cr', detail: 'By duration' },
            { name: 'Long-Form', range: '3-12 cr', detail: 'By duration' },
            { name: 'Cartoon', range: '5 cr', detail: 'Per episode' },
          ].map((m) => (
            <div key={m.name} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-center">
              <p className="text-[10px] text-gray-500 font-medium">{m.name}</p>
              <p className="text-sm font-bold text-yellow-400">{m.range}</p>
              <p className="text-[10px] text-gray-600">{m.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-600 mt-2.5">
          Each job uses 1 quota slot. Over quota, credits are charged per module above. Price credits so each credit covers your API cost (~$0.10-1.00 per credit depending on module).
        </p>
      </div>

      {/* Regions List */}
      {regions.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <Globe className="h-10 w-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No pricing regions configured</p>
          <p className="text-gray-600 text-xs mt-1">Click &quot;Add Region&quot; to create your first pricing region</p>
        </div>
      ) : (
        <div className="space-y-4">
          {regions.map((region) => (
            <div
              key={region.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
            >
              {/* Region Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-brand-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">{region.name}</h3>
                      {region.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                          <Star className="h-2.5 w-2.5" />
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {region.currency.toUpperCase()} ({region.currencySymbol}) &middot;{' '}
                      {(region.countries || []).length} countries
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(region)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  {!region.isDefault && (
                    <button
                      onClick={() => setDeleteRegion(region)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Countries */}
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Countries</p>
                <div className="flex flex-wrap gap-1.5">
                  {(region.countries || []).map((c: string) => (
                    <span key={c} className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5">
                      {c}
                    </span>
                  ))}
                  {(region.countries || []).length === 0 && (
                    <span className="text-[11px] text-gray-600">No countries assigned</span>
                  )}
                </div>
              </div>

              {/* Plan Prices */}
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Plan Prices</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {PLANS.map((plan) => {
                    const pp = region.planPrices.find((p) => p.plan === plan)
                    return (
                      <div key={plan} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                        <p className="text-[10px] text-gray-500 font-medium">{plan}</p>
                        <p className="text-sm font-semibold text-white">
                          {pp ? formatPrice(pp.priceAmount, region.currencySymbol) : '—'}
                        </p>
                        {pp?.stripePriceId && (
                          <p className="text-[9px] text-gray-600 truncate mt-0.5">{pp.stripePriceId}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Credit Prices */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1.5">Credit Packages</p>
                <div className="grid grid-cols-3 gap-2">
                  {region.creditPrices.map((cp) => (
                    <div key={cp.credits} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                      <p className="text-[10px] text-gray-500 font-medium">{cp.label}</p>
                      <p className="text-sm font-semibold text-white">
                        {formatPrice(cp.priceAmount, region.currencySymbol)}
                      </p>
                    </div>
                  ))}
                  {region.creditPrices.length === 0 && (
                    <p className="text-[11px] text-gray-600 col-span-3">No credit packages configured</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-gray-900 border border-white/10 rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-white/10 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
              <h3 className="text-lg font-semibold text-white">
                {editRegion ? 'Edit Region' : 'Create Region'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 font-medium mb-1.5 block">Region Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. INDIA"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium mb-1.5 block">Currency & Symbol</label>
                  <CurrencyDropdown
                    value={formCurrency}
                    onChange={(code, symbol) => {
                      setFormCurrency(code)
                      setFormSymbol(symbol)
                    }}
                  />
                </div>
              </div>

              {/* Countries */}
              <div>
                <label className="text-xs text-gray-400 font-medium mb-1.5 block">Countries</label>
                <CountryMultiSelect
                  value={formCountries}
                  onChange={setFormCountries}
                />
              </div>

              {/* Default toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded border-gray-600"
                />
                <span className="text-sm text-gray-400">Default region (fallback for unassigned countries)</span>
              </label>

              {/* Plan Prices */}
              <div>
                <p className="text-xs text-gray-400 font-medium mb-2">Plan Prices (in smallest currency unit — cents/paise)</p>
                <div className="space-y-2">
                  {formPlanPrices.map((pp, i) => (
                    <div key={pp.plan} className="grid grid-cols-[100px_1fr_1fr] gap-2 items-center">
                      <span className="text-xs font-medium text-gray-400">{pp.plan}</span>
                      <input
                        type="number"
                        value={pp.priceAmount}
                        onChange={(e) => {
                          const next = [...formPlanPrices]
                          next[i] = { ...next[i], priceAmount: e.target.value }
                          setFormPlanPrices(next)
                        }}
                        placeholder="Amount"
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500"
                      />
                      <input
                        type="text"
                        value={pp.stripePriceId}
                        onChange={(e) => {
                          const next = [...formPlanPrices]
                          next[i] = { ...next[i], stripePriceId: e.target.value }
                          setFormPlanPrices(next)
                        }}
                        placeholder="Stripe Price ID (optional)"
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Credit Prices */}
              <div>
                <p className="text-xs text-gray-400 font-medium mb-2">Credit Packages (in smallest currency unit)</p>
                <div className="space-y-2">
                  {formCreditPrices.map((cp, i) => (
                    <div key={cp.credits} className="grid grid-cols-[100px_1fr_1fr] gap-2 items-center">
                      <span className="text-xs font-medium text-gray-400">{cp.label}</span>
                      <input
                        type="number"
                        value={cp.priceAmount}
                        onChange={(e) => {
                          const next = [...formCreditPrices]
                          next[i] = { ...next[i], priceAmount: e.target.value }
                          setFormCreditPrices(next)
                        }}
                        placeholder="Amount"
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500"
                      />
                      <input
                        type="text"
                        value={cp.label}
                        onChange={(e) => {
                          const next = [...formCreditPrices]
                          next[i] = { ...next[i], label: e.target.value }
                          setFormCreditPrices(next)
                        }}
                        placeholder="Label"
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-900 border-t border-white/10 px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editRegion ? 'Save Changes' : 'Create Region'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteRegion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete {deleteRegion.name}</h3>
                <p className="text-xs text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              Are you sure you want to delete the <strong>{deleteRegion.name}</strong> pricing region?
              Countries assigned to this region will fall back to the default region.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteRegion(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition inline-flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { headers } from 'next/headers'

/**
 * Detect user's country from request.
 * Priority:
 *   1. DEV_COUNTRY_OVERRIDE env var (local testing)
 *   2. x-vercel-ip-country header (Vercel production)
 *   3. Fallback geo-IP API (api.country.is)
 *   4. "US" as final fallback
 */
export async function detectCountry(req?: Request): Promise<string> {
  // 1. Dev override
  if (process.env.DEV_COUNTRY_OVERRIDE) {
    return process.env.DEV_COUNTRY_OVERRIDE.toUpperCase()
  }

  // 2. Vercel header (cheapest — no API call)
  try {
    if (req) {
      const country = req.headers.get('x-vercel-ip-country')
      if (country && country.length === 2) return country.toUpperCase()
    } else {
      const hdrs = await headers()
      const country = hdrs.get('x-vercel-ip-country')
      if (country && country.length === 2) return country.toUpperCase()
    }
  } catch {
    // headers() may throw outside of request context
  }

  // 3. Free geo-IP fallback (dev / non-Vercel hosts)
  try {
    const res = await fetch('https://api.country.is', {
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const data = (await res.json()) as { country?: string }
      if (data.country && data.country.length === 2) {
        return data.country.toUpperCase()
      }
    }
  } catch {
    // Timeout or network error — fall through
  }

  // 4. Final fallback
  return 'US'
}

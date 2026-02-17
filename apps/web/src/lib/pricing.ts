import { prisma } from '@reelforge/db'
import { PLANS, CREDIT_PACKAGES } from '@/lib/constants'

export type PricingRegionWithPrices = Awaited<ReturnType<typeof getRegionForCountry>>

/**
 * Resolve the pricing region for a given country code.
 * Falls back to the default (GLOBAL) region.
 * Auto-seeds the GLOBAL region on first call if no regions exist.
 */
export async function getRegionForCountry(country: string | null | undefined) {
  const code = (country || 'US').toUpperCase()

  // Find region whose countries JSON array contains this code
  const regions = await prisma.pricingRegion.findMany({
    include: { planPrices: true, creditPrices: true },
  })

  // Auto-seed GLOBAL if empty
  if (regions.length === 0) {
    return seedGlobalRegion()
  }

  // Check each region's countries array for a match
  for (const region of regions) {
    const countries = region.countries as string[]
    if (Array.isArray(countries) && countries.includes(code)) {
      return region
    }
  }

  // Fallback: default region
  const defaultRegion = regions.find((r) => r.isDefault) || regions[0]
  return defaultRegion
}

/**
 * Format a price for display: e.g. "$19.00", "₹499.00"
 */
export function formatRegionPrice(amount: number, currencySymbol: string): string {
  const major = (amount / 100).toFixed(2)
  return `${currencySymbol}${major}`
}

/**
 * Seed the GLOBAL (USD) region with current hardcoded prices.
 * Called automatically when no pricing regions exist yet.
 */
async function seedGlobalRegion() {
  const region = await prisma.pricingRegion.create({
    data: {
      name: 'GLOBAL',
      currency: 'usd',
      currencySymbol: '$',
      countries: ['US', 'GB', 'CA', 'AU', 'EU'],
      isDefault: true,
      planPrices: {
        create: [
          { plan: 'FREE', priceAmount: 0 },
          { plan: 'STARTER', priceAmount: PLANS.STARTER.price, stripePriceId: PLANS.STARTER.stripePriceId || null },
          { plan: 'PRO', priceAmount: PLANS.PRO.price, stripePriceId: PLANS.PRO.stripePriceId || null },
          { plan: 'BUSINESS', priceAmount: PLANS.BUSINESS.price, stripePriceId: PLANS.BUSINESS.stripePriceId || null },
        ],
      },
      creditPrices: {
        create: CREDIT_PACKAGES.map((pkg) => ({
          credits: pkg.credits,
          priceAmount: pkg.price,
          label: pkg.label,
        })),
      },
    },
    include: { planPrices: true, creditPrices: true },
  })

  return region
}

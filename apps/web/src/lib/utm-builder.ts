import { createHash } from 'crypto'
import { nanoid } from 'nanoid'

interface UtmParams {
  utmSource: string
  utmMedium: string
  utmCampaign: string
  utmTerm?: string
  utmContent?: string
}

/**
 * Appends UTM query parameters to a destination URL.
 */
export function buildUtmUrl(baseUrl: string, params: UtmParams): string {
  const url = new URL(baseUrl)
  url.searchParams.set('utm_source', params.utmSource)
  url.searchParams.set('utm_medium', params.utmMedium)
  url.searchParams.set('utm_campaign', params.utmCampaign)
  if (params.utmTerm) url.searchParams.set('utm_term', params.utmTerm)
  if (params.utmContent) url.searchParams.set('utm_content', params.utmContent)
  return url.toString()
}

/**
 * Generates a short alphanumeric code for UTM links.
 */
export function generateShortCode(): string {
  return nanoid(8)
}

/**
 * SHA-256 hash of an IP address for privacy-safe click tracking.
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

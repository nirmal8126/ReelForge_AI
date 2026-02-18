import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 }
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!user || user.role !== 'ADMIN') {
    return { error: 'Forbidden — Super Admin access required', status: 403 }
  }
  return { userId: session.user.id }
}

const SERVICES = [
  { key: 'anthropic', name: 'Anthropic (Claude)', category: 'AI Models', envVar: 'ANTHROPIC_API_KEY' },
  { key: 'openai', name: 'OpenAI (GPT)', category: 'AI Models', envVar: 'OPENAI_API_KEY' },
  { key: 'gemini', name: 'Google Gemini', category: 'AI Models', envVar: 'GEMINI_API_KEY' },
  { key: 'runwayml', name: 'RunwayML', category: 'Video Generation', envVar: 'RUNWAYML_API_SECRET' },
  { key: 'elevenlabs', name: 'ElevenLabs', category: 'Audio', envVar: 'ELEVENLABS_API_KEY' },
  { key: 'pexels', name: 'Pexels', category: 'Stock Media', envVar: 'PEXELS_API_KEY' },
  { key: 'pixabay', name: 'Pixabay', category: 'Stock Media', envVar: 'PIXABAY_API_KEY' },
  { key: 'stripe', name: 'Stripe', category: 'Payments', envVar: 'STRIPE_SECRET_KEY' },
  { key: 'r2', name: 'Cloudflare R2', category: 'Storage', envVar: 'R2_ACCESS_KEY_ID' },
  { key: 'resend', name: 'Resend', category: 'Email', envVar: 'RESEND_API_KEY' },
  { key: 'redis', name: 'Redis (Upstash)', category: 'Cache / Queue', envVar: 'UPSTASH_REDIS_REST_URL' },
]

// POST /api/admin/financials — refresh service health checks
export async function POST() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const services = SERVICES.map((svc) => ({
    key: svc.key,
    name: svc.name,
    category: svc.category,
    isConfigured: !!process.env[svc.envVar],
  }))

  // Store in AppSetting for caching
  await prisma.appSetting.upsert({
    where: { key: 'service_health_cache' },
    create: { key: 'service_health_cache', value: JSON.stringify({ services, checkedAt: new Date().toISOString() }) },
    update: { value: JSON.stringify({ services, checkedAt: new Date().toISOString() }) },
  })

  return NextResponse.json({ services, checkedAt: new Date().toISOString() })
}

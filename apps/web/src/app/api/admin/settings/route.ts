import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

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

// Default settings with their types
const SETTING_DEFAULTS: Record<string, string> = {
  app_name: 'ReelForge AI',
  app_tagline: 'AI-powered short video generation',
  maintenance_mode: 'false',
  signup_enabled: 'true',
  default_credits_on_signup: '10',
  max_free_jobs_per_day: '3',
  support_email: 'support@reelforge.ai',
  terms_url: '',
  privacy_url: '',
}

// GET /api/admin/settings — list all app settings
export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  // Fetch existing settings
  const dbSettings = await prisma.appSetting.findMany()
  const settingsMap: Record<string, string> = {}

  // Start with defaults
  for (const [key, defaultValue] of Object.entries(SETTING_DEFAULTS)) {
    settingsMap[key] = defaultValue
  }

  // Override with DB values
  for (const s of dbSettings) {
    settingsMap[s.key] = s.value
  }

  return NextResponse.json({ settings: settingsMap })
}

// PUT /api/admin/settings — update app settings
const updateSchema = z.record(z.string(), z.string())

export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await req.json()
  const data = updateSchema.parse(body)

  // Upsert each setting
  for (const [key, value] of Object.entries(data)) {
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    })
  }

  return NextResponse.json({ success: true })
}

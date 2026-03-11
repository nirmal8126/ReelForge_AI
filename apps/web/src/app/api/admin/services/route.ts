import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import {
  type ServiceCategoryConfig,
  type ProviderConfig,
  DEFAULT_SERVICE_CONFIGS,
  SERVICE_CONFIG_KEY,
} from '@reelforge/db'
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

// ---------------------------------------------------------------------------
// GET /api/admin/services — get current service provider configuration
// ---------------------------------------------------------------------------

export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  // Load config from DB or use defaults
  let configs: ServiceCategoryConfig[] = DEFAULT_SERVICE_CONFIGS

  const setting = await prisma.appSetting.findUnique({
    where: { key: SERVICE_CONFIG_KEY },
  })

  if (setting?.value) {
    try {
      const parsed = JSON.parse(setting.value) as ServiceCategoryConfig[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        configs = parsed
      }
    } catch {
      // Invalid JSON — return defaults
    }
  }

  // Add hasApiKey flag for each provider (so UI shows key status without exposing keys)
  const configsWithKeyStatus = configs.map((cat) => ({
    ...cat,
    providers: cat.providers.map((p) => ({
      ...p,
      hasApiKey: !!process.env[p.envKey],
    })),
  }))

  return NextResponse.json({ configs: configsWithKeyStatus })
}

// ---------------------------------------------------------------------------
// PUT /api/admin/services — update service provider configuration
// ---------------------------------------------------------------------------

const providerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  priority: z.number().int().min(1),
  envKey: z.string().min(1),
  model: z.string().optional(),
  settings: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
})

const categorySchema = z.object({
  category: z.enum(['text', 'image', 'video', 'voice', 'stock', 'story']),
  label: z.string().min(1),
  description: z.string(),
  providers: z.array(providerSchema).min(1),
})

const updateSchema = z.object({
  configs: z.array(categorySchema).min(1),
})

export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await req.json()
  const data = updateSchema.parse(body)

  // Save to AppSetting as JSON
  await prisma.appSetting.upsert({
    where: { key: SERVICE_CONFIG_KEY },
    create: { key: SERVICE_CONFIG_KEY, value: JSON.stringify(data.configs) },
    update: { value: JSON.stringify(data.configs) },
  })

  return NextResponse.json({ success: true })
}

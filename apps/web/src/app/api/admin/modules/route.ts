import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Admin-only middleware check
// ---------------------------------------------------------------------------

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
// Default module configs (for seeding)
// ---------------------------------------------------------------------------

// Order matches sidebar navigation
const DEFAULT_MODULES = [
  { moduleId: 'quotes',         moduleName: 'Quotes',          isFree: false, creditCost: 1 },
  { moduleId: 'reels',          moduleName: 'My Reels',        isFree: false, creditCost: 1 },
  { moduleId: 'long_form',      moduleName: 'My Videos',       isFree: false, creditCost: 3 },
  { moduleId: 'cartoon_studio', moduleName: 'Cartoon Studio',  isFree: false, creditCost: 2 },
  { moduleId: 'challenges',     moduleName: 'Challenges',      isFree: false, creditCost: 1 },
  { moduleId: 'gameplay',       moduleName: '3D Gameplay',     isFree: false, creditCost: 2 },
]

const MODULE_ORDER = DEFAULT_MODULES.map((m) => m.moduleId)

// ---------------------------------------------------------------------------
// GET /api/admin/modules — list all module configs
// ---------------------------------------------------------------------------

export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  // Ensure all default modules exist
  for (const def of DEFAULT_MODULES) {
    await prisma.moduleConfig.upsert({
      where: { moduleId: def.moduleId },
      create: {
        moduleId: def.moduleId,
        moduleName: def.moduleName,
        isFree: def.isFree,
        creditCost: def.creditCost,
        isEnabled: true,
      },
      update: {},
    })
  }

  const modules = await prisma.moduleConfig.findMany()

  // Sort to match sidebar order
  modules.sort((a, b) => {
    const ai = MODULE_ORDER.indexOf(a.moduleId)
    const bi = MODULE_ORDER.indexOf(b.moduleId)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  return NextResponse.json({ modules })
}

// ---------------------------------------------------------------------------
// PUT /api/admin/modules — update a module config
// ---------------------------------------------------------------------------

const updateModuleSchema = z.object({
  moduleId: z.string().min(1),
  isFree: z.boolean().optional(),
  creditCost: z.number().int().min(0).max(100).optional(),
  isEnabled: z.boolean().optional(),
})

export async function PUT(req: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await req.json()
  const data = updateModuleSchema.parse(body)

  const existing = await prisma.moduleConfig.findUnique({
    where: { moduleId: data.moduleId },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Module not found' }, { status: 404 })
  }

  const updated = await prisma.moduleConfig.update({
    where: { moduleId: data.moduleId },
    data: {
      ...(data.isFree !== undefined && { isFree: data.isFree }),
      ...(data.creditCost !== undefined && { creditCost: data.creditCost }),
      ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
    },
  })

  return NextResponse.json({ module: updated })
}

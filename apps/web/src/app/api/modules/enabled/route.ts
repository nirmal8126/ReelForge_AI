import { NextResponse } from 'next/server'
import { getEnabledModules } from '@/lib/module-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const enabledModules = await getEnabledModules()
  return NextResponse.json({ enabledModules })
}

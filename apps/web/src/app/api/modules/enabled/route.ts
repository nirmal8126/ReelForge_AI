import { NextResponse } from 'next/server'
import { getEnabledModules } from '@/lib/module-config'

export async function GET() {
  const enabledModules = await getEnabledModules()
  return NextResponse.json({ enabledModules })
}

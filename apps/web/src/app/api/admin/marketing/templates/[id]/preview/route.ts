import { NextRequest, NextResponse } from 'next/server'
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
    return { error: 'Forbidden', status: 403 }
  }
  return { userId: session.user.id }
}

const SAMPLE_DATA: Record<string, string> = {
  userName: 'John Doe',
  email: 'john@example.com',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://reelforge.ai',
  appName: 'ReelForge AI',
  plan: 'PRO',
  credits: '100',
  referralCode: 'REF-ABCD12',
  referralLink: 'https://reelforge.ai/ref/REF-ABCD12',
  promoCode: 'SAVE20',
  discountValue: '20%',
  reelTitle: 'My Amazing Reel',
  reelUrl: 'https://reelforge.ai/reel/abc123',
  unsubscribeUrl: 'https://reelforge.ai/unsubscribe',
}

// GET /api/admin/marketing/templates/[id]/preview
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin()
  if ('error' in check) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { id } = await params

  const template = await prisma.emailTemplate.findUnique({ where: { id } })
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  // Replace variables with sample data
  let html = template.body
  const variables = (template.variables as string[]) || []
  for (const varName of variables) {
    const value = SAMPLE_DATA[varName] || `[${varName}]`
    html = html.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), value)
  }

  // Also replace any undetected variables
  html = html.replace(/\{\{(\w+)\}\}/g, (_, name) => SAMPLE_DATA[name] || `[${name}]`)

  let subject = template.subject
  subject = subject.replace(/\{\{(\w+)\}\}/g, (_, name) => SAMPLE_DATA[name] || `[${name}]`)

  return NextResponse.json({ html, subject, variables })
}

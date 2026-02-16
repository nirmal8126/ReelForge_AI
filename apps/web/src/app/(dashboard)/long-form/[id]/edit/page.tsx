import { auth } from '@/lib/auth'
import { prisma } from '@reelforge/db'
import { redirect } from 'next/navigation'
import { EditorShell } from './editor-shell'

interface EditPageProps {
  params: { id: string }
}

export default async function EditPage({ params }: EditPageProps) {
  const session = await auth()
  if (!session) redirect('/login')

  const job = await prisma.longFormJob.findUnique({
    where: { id: params.id },
    include: {
      segments: { orderBy: { segmentIndex: 'asc' } },
    },
  })

  if (!job || job.userId !== session.user.id) {
    redirect('/long-form')
  }

  // Only allow editing completed or recomposing jobs
  if (job.status !== 'COMPLETED' && job.status !== 'RECOMPOSING') {
    redirect(`/long-form/${job.id}`)
  }

  const editorJob = {
    id: job.id,
    title: job.title,
    status: job.status,
    aspectRatio: job.aspectRatio,
    outputUrl: job.outputUrl,
    script: job.script,
    voiceId: job.voiceId,
    language: job.language,
  }

  const editorSegments = job.segments.map((s) => ({
    ...s,
    assetUrl: s.assetUrl,
    transitionType: (s as any).transitionType ?? 'none',
    captionsEnabled: (s as any).captionsEnabled ?? true,
    titleOverlay: (s as any).titleOverlay ?? false,
    createdAt: s.createdAt.toISOString(),
  }))

  return <EditorShell initialJob={editorJob} initialSegments={editorSegments} />
}

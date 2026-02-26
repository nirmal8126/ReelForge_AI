'use client'

import { PublishDialog } from '@/components/publish/publish-dialog'

interface PublishQuoteButtonProps {
  jobId: string
  quoteText: string
  videoUrl?: string | null
  thumbnailUrl?: string | null
}

export function PublishQuoteButton({ jobId, quoteText, videoUrl, thumbnailUrl }: PublishQuoteButtonProps) {
  return (
    <PublishDialog
      jobType="quote"
      jobId={jobId}
      videoUrl={videoUrl || undefined}
      thumbnailUrl={thumbnailUrl}
      defaultTitle={quoteText.substring(0, 100)}
      textContent={quoteText}
      compact
    />
  )
}

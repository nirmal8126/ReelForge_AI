export interface EditorSegment {
  id: string
  longFormJobId: string
  segmentIndex: number
  title: string
  scriptText: string
  startTime: number
  endTime: number
  visualType: string
  assetUrl: string | null
  assetMetadata: unknown
  transitionType: string | null
  captionsEnabled: boolean
  titleOverlay: boolean
  status: string
  errorMessage: string | null
  createdAt: string
}

export interface EditorJob {
  id: string
  title: string
  status: string
  aspectRatio: string
  outputUrl: string | null
  script: string | null
  voiceId: string | null
  language: string
}

export interface StockSearchResult {
  id: number
  thumbnail: string
  previewUrl: string
  duration: number
  width: number
  height: number
}

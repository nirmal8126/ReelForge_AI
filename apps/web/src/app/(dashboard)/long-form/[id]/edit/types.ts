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
  textOverlay: TextOverlay | null
  status: string
  errorMessage: string | null
  createdAt: string
}

export interface TextOverlay {
  text: string
  position: 'top' | 'center' | 'bottom'
  fontSize: 'sm' | 'md' | 'lg' | 'xl'
  color: string
  bgColor: string
  style: 'solid' | 'outline' | 'shadow'
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
  bgMusicUrl: string | null
  bgMusicVolume: number
}

export interface StockSearchResult {
  id: number
  thumbnail: string
  previewUrl: string
  duration: number
  width: number
  height: number
}

export interface MusicTrack {
  id: string
  name: string
  genre: string
  duration: string
  url: string
}

// ---------------------------------------------------------------------------
// Service Provider Configuration — shared types & defaults
// Used by both apps/web (admin UI/API) and apps/worker (job processors)
// ---------------------------------------------------------------------------

export type ServiceCategory = 'text' | 'image' | 'video' | 'voice' | 'stock' | 'story'

export interface ProviderConfig {
  id: string           // unique identifier e.g. "anthropic", "runway", "elevenlabs"
  name: string         // display name e.g. "Anthropic Claude"
  enabled: boolean
  priority: number     // lower = higher priority (1 = first choice)
  envKey: string       // env var name for API key e.g. "ANTHROPIC_API_KEY"
  model?: string       // optional model override e.g. "claude-sonnet-4-5-20250929"
  settings?: Record<string, string | number | boolean>  // provider-specific settings
}

export interface ServiceCategoryConfig {
  category: ServiceCategory
  label: string
  description: string
  providers: ProviderConfig[]
}

// ---------------------------------------------------------------------------
// Default configurations (fallback when no DB config exists)
// ---------------------------------------------------------------------------

export const DEFAULT_SERVICE_CONFIGS: ServiceCategoryConfig[] = [
  {
    category: 'text',
    label: 'Text / Script Generation',
    description: 'AI models for generating video scripts, quotes, and text content',
    providers: [
      { id: 'gemini', name: 'Google Gemini', enabled: true, priority: 1, envKey: 'GEMINI_API_KEY', model: 'gemini-2.5-flash' },
      { id: 'anthropic', name: 'Anthropic Claude', enabled: true, priority: 2, envKey: 'ANTHROPIC_API_KEY', model: 'claude-sonnet-4-5-20250929' },
      { id: 'openai', name: 'OpenAI GPT-4', enabled: true, priority: 3, envKey: 'OPENAI_API_KEY', model: 'gpt-4o' },
    ],
  },
  {
    category: 'image',
    label: 'Image Generation',
    description: 'AI models for generating scene images, thumbnails, and visuals',
    providers: [
      { id: 'gemini', name: 'Gemini Flash Image', enabled: true, priority: 1, envKey: 'GEMINI_API_KEY', model: 'gemini-2.0-flash-exp' },
      { id: 'dalle', name: 'DALL-E 3', enabled: false, priority: 2, envKey: 'OPENAI_API_KEY', model: 'dall-e-3' },
    ],
  },
  {
    category: 'video',
    label: 'Video Generation',
    description: 'AI video generation and image-to-video services',
    providers: [
      { id: 'luma', name: 'Luma AI (Dream Machine)', enabled: true, priority: 1, envKey: 'LUMA_API_KEY', settings: { costPerSec: 0.07 } },
      { id: 'replicate', name: 'Replicate (Wan 2.1)', enabled: true, priority: 2, envKey: 'REPLICATE_API_KEY', model: 'wan2.1-t2v-14b', settings: { costPerSec: 0.04 } },
      { id: 'runway', name: 'RunwayML Gen 4.5', enabled: true, priority: 3, envKey: 'RUNWAY_API_KEY', model: 'gen4_turbo', settings: { planRestriction: 'premium', costPerSec: 0.50 } },
      { id: 'veo', name: 'Google Veo 3', enabled: true, priority: 4, envKey: 'GEMINI_API_KEY', model: 'veo-3.0-generate-preview', settings: { planRestriction: 'premium', costPerSec: 0.15 } },
      { id: 'ai_images', name: 'AI Images + Ken Burns', enabled: true, priority: 5, envKey: 'GEMINI_API_KEY', settings: { costPerImage: 0.01 } },
      { id: 'pexels', name: 'Pexels Stock Video', enabled: true, priority: 6, envKey: 'PEXELS_API_KEY', settings: { costPerSec: 0 } },
    ],
  },
  {
    category: 'voice',
    label: 'Voice / TTS',
    description: 'Text-to-speech services for voiceover generation',
    providers: [
      { id: 'elevenlabs', name: 'ElevenLabs', enabled: true, priority: 1, envKey: 'ELEVENLABS_API_KEY', model: 'eleven_multilingual_v2' },
      { id: 'google_tts', name: 'Google Cloud TTS', enabled: false, priority: 2, envKey: 'GOOGLE_TTS_API_KEY' },
    ],
  },
  {
    category: 'stock',
    label: 'Stock Footage',
    description: 'Stock video and image providers for fallback media',
    providers: [
      { id: 'pexels', name: 'Pexels', enabled: true, priority: 1, envKey: 'PEXELS_API_KEY' },
      { id: 'pixabay', name: 'Pixabay', enabled: true, priority: 2, envKey: 'PIXABAY_API_KEY' },
    ],
  },
  {
    category: 'story',
    label: 'Story Generation',
    description: 'AI models for generating cartoon/episode stories',
    providers: [
      { id: 'gemini', name: 'Google Gemini', enabled: true, priority: 1, envKey: 'GEMINI_API_KEY', model: 'gemini-2.5-flash' },
      { id: 'anthropic', name: 'Anthropic Claude', enabled: true, priority: 2, envKey: 'ANTHROPIC_API_KEY', model: 'claude-sonnet-4-5-20250929' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helper: get enabled providers sorted by priority for a given category
// ---------------------------------------------------------------------------

export function getEnabledProviders(config: ServiceCategoryConfig): ProviderConfig[] {
  return config.providers
    .filter((p) => p.enabled)
    .sort((a, b) => a.priority - b.priority)
}

// ---------------------------------------------------------------------------
// Helper: find a category config by name
// ---------------------------------------------------------------------------

export function findCategoryConfig(
  configs: ServiceCategoryConfig[],
  category: ServiceCategory,
): ServiceCategoryConfig | undefined {
  return configs.find((c) => c.category === category)
}

// AppSetting key used to store the full service config JSON
export const SERVICE_CONFIG_KEY = 'service_providers_config'

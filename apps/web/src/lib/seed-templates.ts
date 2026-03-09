// ---------------------------------------------------------------------------
// System templates — pre-built viral content recipes
// ---------------------------------------------------------------------------

export interface SeedTemplate {
  name: string
  description: string
  moduleType: string
  category: string
  tags: string[]
  promptTemplate: string
  defaultSettings: Record<string, unknown>
  themeConfig?: Record<string, unknown>
  isFeatured?: boolean
}

export const SEED_TEMPLATES: SeedTemplate[] = [
  // =========================================================================
  // REEL TEMPLATES
  // =========================================================================
  {
    name: 'Viral Story Hook',
    description: 'Start with a powerful hook, tell a compelling 60s story with emotional payoff. Proven viral format.',
    moduleType: 'REEL',
    category: 'motivation',
    tags: ['viral', 'story', 'hook', 'emotional'],
    isFeatured: true,
    promptTemplate: 'Create a 60-second viral reel with a strong hook in the first 3 seconds. Topic: {{topic}}. Structure: Hook → Tension → Story → Emotional Payoff → CTA. Use dramatic pauses and build-up. Make it impossible to scroll past.',
    defaultSettings: {
      durationSeconds: 60,
      aspectRatio: '9:16',
      style: 'cinematic',
      language: 'hi',
    },
    themeConfig: { visualStyle: 'cinematic', musicMood: 'dramatic', colorPalette: 'dark' },
  },
  {
    name: 'Did You Know? Facts',
    description: 'Quick 30s fact-based reel with surprising information. High save & share rate.',
    moduleType: 'REEL',
    category: 'education',
    tags: ['facts', 'educational', 'shareable', 'quick'],
    isFeatured: true,
    promptTemplate: 'Create a "Did You Know?" style 30-second reel about: {{topic}}. Start with "Most people don\'t know this..." or similar hook. Present 2-3 surprising facts. End with a mind-blowing conclusion. Keep it fast-paced and engaging.',
    defaultSettings: {
      durationSeconds: 30,
      aspectRatio: '9:16',
      style: 'modern',
      language: 'hi',
    },
    themeConfig: { visualStyle: 'modern', musicMood: 'upbeat', colorPalette: 'vibrant' },
  },
  {
    name: 'Top 5 Countdown',
    description: 'Countdown listicle format — keeps viewers watching till the end. Great retention.',
    moduleType: 'REEL',
    category: 'entertainment',
    tags: ['listicle', 'countdown', 'retention', 'trending'],
    promptTemplate: 'Create a "Top 5" countdown reel about: {{topic}}. Start with #5 (good) and build up to #1 (mind-blowing). Each item gets a quick explanation. Add "Wait for #1..." text overlay. 60 seconds.',
    defaultSettings: {
      durationSeconds: 60,
      aspectRatio: '9:16',
      style: 'energetic',
      language: 'hi',
    },
    themeConfig: { visualStyle: 'neon', musicMood: 'energetic', colorPalette: 'neon' },
  },
  {
    name: 'Morning Motivation',
    description: 'Powerful 30s motivational clip. Perfect for daily posting schedule.',
    moduleType: 'REEL',
    category: 'motivation',
    tags: ['motivation', 'daily', 'morning', 'mindset'],
    isFeatured: true,
    promptTemplate: 'Create an inspiring 30-second motivational reel about: {{topic}}. Use powerful language, short impactful sentences. Include a life-changing quote or lesson. Make the viewer feel unstoppable. End with "Share this with someone who needs it."',
    defaultSettings: {
      durationSeconds: 30,
      aspectRatio: '9:16',
      style: 'motivational',
      language: 'hi',
    },
    themeConfig: { visualStyle: 'cinematic', musicMood: 'inspiring', colorPalette: 'warm' },
  },
  {
    name: 'Quick Tip / Hack',
    description: '15s ultra-short tip or life hack. Perfect for YouTube Shorts.',
    moduleType: 'REEL',
    category: 'education',
    tags: ['tips', 'hack', 'short', 'youtube-shorts'],
    promptTemplate: 'Create a 15-second quick tip/hack reel about: {{topic}}. Get straight to the point. "Here\'s a trick most people miss..." → Explain the tip → "You\'re welcome." Keep it punchy and fast.',
    defaultSettings: {
      durationSeconds: 15,
      aspectRatio: '9:16',
      style: 'minimal',
      language: 'hi',
    },
    themeConfig: { visualStyle: 'minimal', musicMood: 'chill', colorPalette: 'clean' },
  },
  {
    name: 'Before vs After',
    description: 'Transformation-style reel showing contrast. High engagement format.',
    moduleType: 'REEL',
    category: 'lifestyle',
    tags: ['transformation', 'before-after', 'viral', 'contrast'],
    promptTemplate: 'Create a "Before vs After" reel about: {{topic}}. Show the struggle/problem first (relatable), then the transformation/solution. Use contrast to create impact. 30 seconds. Make the transformation feel dramatic.',
    defaultSettings: {
      durationSeconds: 30,
      aspectRatio: '9:16',
      style: 'dramatic',
      language: 'hi',
    },
    themeConfig: { visualStyle: 'cinematic', musicMood: 'dramatic', colorPalette: 'contrast' },
  },

  // =========================================================================
  // LONG-FORM TEMPLATES
  // =========================================================================
  {
    name: 'Deep Dive Documentary',
    description: '10-minute documentary-style video with facts, stories, and analysis.',
    moduleType: 'LONG_FORM',
    category: 'education',
    tags: ['documentary', 'deep-dive', 'analysis', 'youtube'],
    isFeatured: true,
    promptTemplate: 'Create a 10-minute documentary-style video about: {{topic}}. Structure: Intro hook (30s) → Background context → 3-4 key sections with stories/examples → Surprising facts → Conclusion with takeaway. Use a narrator tone like Kurzgesagt or Vox.',
    defaultSettings: {
      durationMinutes: 10,
      aspectRatio: '16:9',
      aiClipRatio: 0.3,
      useStockFootage: true,
      useStaticVisuals: true,
      style: 'documentary',
      language: 'hi',
    },
    themeConfig: { visualStyle: 'documentary', musicMood: 'ambient', colorPalette: 'neutral' },
  },
  {
    name: 'Tutorial / How-To',
    description: '15-minute step-by-step tutorial. Great for search traffic.',
    moduleType: 'LONG_FORM',
    category: 'education',
    tags: ['tutorial', 'how-to', 'step-by-step', 'searchable'],
    promptTemplate: 'Create a 15-minute tutorial video about: {{topic}}. Structure: What you\'ll learn (30s) → Prerequisites → Step-by-step guide (5-7 steps) → Common mistakes to avoid → Pro tips → Summary. Be clear and practical.',
    defaultSettings: {
      durationMinutes: 15,
      aspectRatio: '16:9',
      aiClipRatio: 0.2,
      useStockFootage: true,
      useStaticVisuals: true,
      style: 'educational',
      language: 'hi',
    },
    themeConfig: { visualStyle: 'clean', musicMood: 'chill', colorPalette: 'professional' },
  },
  {
    name: 'Top 10 Countdown',
    description: '10-minute listicle video. High watch time due to anticipation.',
    moduleType: 'LONG_FORM',
    category: 'entertainment',
    tags: ['listicle', 'top-10', 'countdown', 'watch-time'],
    isFeatured: true,
    promptTemplate: 'Create a "Top 10" countdown video about: {{topic}}. Start from #10 and build to #1. Each entry: brief intro → why it\'s on the list → interesting fact. Build anticipation for #1. Include "honorable mentions." 10 minutes.',
    defaultSettings: {
      durationMinutes: 10,
      aspectRatio: '16:9',
      aiClipRatio: 0.4,
      useStockFootage: true,
      useStaticVisuals: true,
      style: 'energetic',
      language: 'hi',
    },
    themeConfig: { visualStyle: 'dynamic', musicMood: 'energetic', colorPalette: 'bold' },
  },
  {
    name: 'Story Time',
    description: '5-minute compelling story narration. High emotional engagement.',
    moduleType: 'LONG_FORM',
    category: 'motivation',
    tags: ['story', 'narrative', 'emotional', 'compelling'],
    promptTemplate: 'Tell a compelling 5-minute story about: {{topic}}. Structure: Set the scene → Introduce conflict/challenge → Build tension → Climax → Resolution with lesson. Use vivid descriptions. Make the audience feel like they\'re there.',
    defaultSettings: {
      durationMinutes: 5,
      aspectRatio: '16:9',
      aiClipRatio: 0.3,
      useStockFootage: true,
      useStaticVisuals: true,
      style: 'cinematic',
      language: 'hi',
    },
    themeConfig: { visualStyle: 'cinematic', musicMood: 'dramatic', colorPalette: 'warm' },
  },

  // =========================================================================
  // CHALLENGE TEMPLATES
  // =========================================================================
  {
    name: 'Brain Teaser Blast',
    description: '5 hard riddles with 10s timer. High comment engagement.',
    moduleType: 'CHALLENGE',
    category: 'entertainment',
    tags: ['riddle', 'brain-teaser', 'engagement', 'comments'],
    isFeatured: true,
    promptTemplate: 'Create 5 challenging brain teaser riddles about: {{topic}}. Make them tricky but solvable. Include clever wordplay.',
    defaultSettings: {
      challengeType: 'riddle',
      category: 'brain-teasers',
      difficulty: 'hard',
      numQuestions: 5,
      timerSeconds: 10,
      templateStyle: 'neon',
      voiceEnabled: true,
      language: 'hi',
    },
    themeConfig: { visualStyle: 'neon', musicMood: 'suspense' },
  },
  {
    name: 'Quick GK Quiz',
    description: '3 easy general knowledge questions. Perfect for daily posting.',
    moduleType: 'CHALLENGE',
    category: 'education',
    tags: ['quiz', 'gk', 'daily', 'easy'],
    promptTemplate: 'Create 3 interesting general knowledge questions about: {{topic}}. Make them educational and surprising. Include fun facts in answers.',
    defaultSettings: {
      challengeType: 'gk_quiz',
      category: 'general-knowledge',
      difficulty: 'easy',
      numQuestions: 3,
      timerSeconds: 5,
      templateStyle: 'minimal',
      voiceEnabled: false,
      language: 'hi',
    },
    themeConfig: { visualStyle: 'minimal', musicMood: 'upbeat' },
  },
  {
    name: 'Emoji Challenge',
    description: 'Guess the movie/song from emojis. Ultra-viral format.',
    moduleType: 'CHALLENGE',
    category: 'entertainment',
    tags: ['emoji', 'guess', 'viral', 'fun'],
    isFeatured: true,
    promptTemplate: 'Create emoji guess challenges about: {{topic}}. Use creative emoji combinations that are challenging but guessable.',
    defaultSettings: {
      challengeType: 'emoji_guess',
      category: 'movies',
      difficulty: 'medium',
      numQuestions: 5,
      timerSeconds: 8,
      templateStyle: 'gameshow',
      voiceEnabled: true,
      language: 'hi',
    },
    themeConfig: { visualStyle: 'gameshow', musicMood: 'fun' },
  },
  {
    name: 'Would You Rather',
    description: 'Impossible choices that spark debate. Maximizes comments.',
    moduleType: 'CHALLENGE',
    category: 'entertainment',
    tags: ['would-you-rather', 'debate', 'comments', 'engagement'],
    promptTemplate: 'Create "Would You Rather" scenarios about: {{topic}}. Make both options equally tempting/difficult. Add a twist to each one.',
    defaultSettings: {
      challengeType: 'would_you_rather',
      category: 'lifestyle',
      difficulty: 'medium',
      numQuestions: 4,
      timerSeconds: 8,
      templateStyle: 'neon',
      voiceEnabled: false,
      language: 'hi',
    },
    themeConfig: { visualStyle: 'neon', musicMood: 'suspense' },
  },

  // =========================================================================
  // GAMEPLAY TEMPLATES
  // =========================================================================
  {
    name: 'Satisfying Runner',
    description: 'Relaxing endless runner with candy theme. Perfect for Reels/Shorts.',
    moduleType: 'GAMEPLAY',
    category: 'entertainment',
    tags: ['satisfying', 'relaxing', 'gameplay', 'shorts'],
    isFeatured: true,
    promptTemplate: '{{topic}}',
    defaultSettings: {
      template: 'ENDLESS_RUNNER',
      theme: 'candy',
      difficulty: 'easy',
      duration: 30,
      aspectRatio: '9:16',
      musicStyle: 'chill',
      showScore: true,
      gameTitle: 'Satisfying Run',
    },
    themeConfig: { visualStyle: 'candy', musicMood: 'chill', colorPalette: 'pastel' },
  },
  {
    name: 'Impossible Challenge',
    description: 'Insanely hard obstacle tower. "Can you beat this?" hook drives comments.',
    moduleType: 'GAMEPLAY',
    category: 'entertainment',
    tags: ['challenge', 'impossible', 'viral', 'comments'],
    promptTemplate: '{{topic}}',
    defaultSettings: {
      template: 'OBSTACLE_TOWER',
      theme: 'neon',
      difficulty: 'insane',
      duration: 45,
      aspectRatio: '9:16',
      musicStyle: 'intense',
      showScore: true,
      ctaText: 'Can YOU beat this? Comment your score!',
    },
    themeConfig: { visualStyle: 'neon', musicMood: 'intense', colorPalette: 'neon' },
  },
  {
    name: 'Maze Master',
    description: 'Hypnotic ball maze with retro theme. Oddly satisfying to watch.',
    moduleType: 'GAMEPLAY',
    category: 'entertainment',
    tags: ['maze', 'satisfying', 'hypnotic', 'retro'],
    promptTemplate: '{{topic}}',
    defaultSettings: {
      template: 'BALL_MAZE',
      theme: 'retro',
      difficulty: 'medium',
      duration: 30,
      aspectRatio: '9:16',
      musicStyle: 'chill',
      showScore: true,
    },
    themeConfig: { visualStyle: 'retro', musicMood: 'chill', colorPalette: 'retro' },
  },

  // =========================================================================
  // QUOTE TEMPLATES
  // =========================================================================
  {
    name: 'Morning Motivation Quote',
    description: 'Short, punchy motivational quote. Perfect for daily autopilot.',
    moduleType: 'QUOTE',
    category: 'motivation',
    tags: ['morning', 'motivation', 'daily', 'quote'],
    isFeatured: true,
    promptTemplate: 'Generate a powerful, original motivational quote about: {{topic}}. Make it short (1-2 sentences), impactful, and shareable. Think like a modern-day philosopher.',
    defaultSettings: {
      category: 'motivational',
      language: 'hi',
      quoteLength: 'short',
    },
    themeConfig: { visualStyle: 'minimal', fontStyle: 'bold-serif' },
  },
  {
    name: 'Business Wisdom',
    description: 'Entrepreneurship and business insights. Great for LinkedIn/Twitter.',
    moduleType: 'QUOTE',
    category: 'business',
    tags: ['business', 'entrepreneur', 'wisdom', 'linkedin'],
    promptTemplate: 'Generate a sharp business/entrepreneurship insight about: {{topic}}. Think Naval Ravikant or Warren Buffett style. Medium length, thought-provoking.',
    defaultSettings: {
      category: 'business',
      language: 'en',
      quoteLength: 'medium',
    },
    themeConfig: { visualStyle: 'clean', fontStyle: 'modern-sans' },
  },
  {
    name: 'Deep Life Lesson',
    description: 'Thought-provoking life philosophy quote. High save rate.',
    moduleType: 'QUOTE',
    category: 'philosophy',
    tags: ['deep', 'philosophy', 'life', 'saves'],
    promptTemplate: 'Generate a deep, thought-provoking life lesson about: {{topic}}. Something that makes people stop and reflect. Like Marcus Aurelius meets modern wisdom. Medium-long.',
    defaultSettings: {
      category: 'philosophy',
      language: 'hi',
      quoteLength: 'long',
    },
    themeConfig: { visualStyle: 'dark', fontStyle: 'elegant' },
  },
  {
    name: 'Savage One-Liner',
    description: 'Bold, attitude-packed one-liner. Viral on Instagram stories.',
    moduleType: 'QUOTE',
    category: 'attitude',
    tags: ['savage', 'attitude', 'one-liner', 'viral', 'instagram'],
    isFeatured: true,
    promptTemplate: 'Generate a bold, savage one-liner about: {{topic}}. Attitude-packed, confident, and unapologetic. Something people would screenshot and share on their story.',
    defaultSettings: {
      category: 'attitude',
      language: 'hi',
      quoteLength: 'short',
    },
    themeConfig: { visualStyle: 'bold', fontStyle: 'impact' },
  },
]

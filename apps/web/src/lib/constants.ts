export const PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    jobsLimit: 3,
    profilesLimit: 0,
    features: ['3 reels per month', 'AI script generation', 'Basic voices', '720p quality', 'Watermarked'],
    stripePriceId: null,
  },
  STARTER: {
    name: 'Starter',
    price: 1900,
    jobsLimit: 25,
    profilesLimit: 1,
    features: ['25 reels per month', '50+ AI voices', 'No watermark', '1080p quality', '1 channel profile'],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID,
  },
  PRO: {
    name: 'Pro',
    price: 4900,
    jobsLimit: 75,
    profilesLimit: 5,
    features: ['75 reels per month', 'Priority queue', '5 channel profiles', 'Custom intros/outros', 'Analytics'],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
  },
  BUSINESS: {
    name: 'Business',
    price: 9900,
    jobsLimit: 200,
    profilesLimit: -1,
    features: ['200 reels per month', 'Unlimited profiles', 'Team collaboration', 'API access', 'White-label'],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID,
  },
} as const

export const NICHE_PRESETS = {
  tech: { name: 'Tech & Gadgets', primaryColor: '#06B6D4', tone: 'PROFESSIONAL', hookStyle: 'stat', music: 'ambient' },
  motivation: { name: 'Motivation', primaryColor: '#F59E0B', tone: 'ENERGETIC', hookStyle: 'challenge', music: 'upbeat' },
  finance: { name: 'Finance', primaryColor: '#10B981', tone: 'PROFESSIONAL', hookStyle: 'question', music: 'minimal' },
  fitness: { name: 'Fitness', primaryColor: '#EF4444', tone: 'ENERGETIC', hookStyle: 'challenge', music: 'pump' },
  cooking: { name: 'Cooking', primaryColor: '#F59E0B', tone: 'CASUAL', hookStyle: 'tip', music: 'acoustic' },
  education: { name: 'Education', primaryColor: '#3B82F6', tone: 'CALM', hookStyle: 'question', music: 'minimal' },
  gaming: { name: 'Gaming', primaryColor: '#A855F7', tone: 'ENERGETIC', hookStyle: 'shock', music: 'electronic' },
  travel: { name: 'Travel', primaryColor: '#F97316', tone: 'INSPIRATIONAL', hookStyle: 'story', music: 'epic' },
  beauty: { name: 'Beauty & Fashion', primaryColor: '#EC4899', tone: 'CASUAL', hookStyle: 'tip', music: 'pop' },
  health: { name: 'Health & Wellness', primaryColor: '#22C55E', tone: 'CALM', hookStyle: 'tip', music: 'relaxing' },
  business: { name: 'Business', primaryColor: '#6366F1', tone: 'PROFESSIONAL', hookStyle: 'stat', music: 'corporate' },
  comedy: { name: 'Comedy', primaryColor: '#F59E0B', tone: 'HUMOROUS', hookStyle: 'shock', music: 'fun' },
} as const

export const CREDIT_PACKAGES = [
  { credits: 10, price: 999, label: '10 Credits', perCredit: '$1.00' },
  { credits: 50, price: 3999, label: '50 Credits', perCredit: '$0.80', popular: true },
  { credits: 100, price: 6999, label: '100 Credits', perCredit: '$0.70' },
] as const

export const REEL_DURATIONS = [15, 30, 60] as const
export const ASPECT_RATIOS = ['9:16', '1:1', '16:9'] as const

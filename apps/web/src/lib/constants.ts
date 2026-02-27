export const PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    jobsLimit: 3,
    profilesLimit: 0,
    features: ['3 jobs per month', 'AI script generation', 'Basic voices', '720p quality', 'Watermarked'],
    stripePriceId: null,
  },
  STARTER: {
    name: 'Starter',
    price: 1900,
    jobsLimit: 25,
    profilesLimit: 1,
    features: ['25 jobs per month', '50+ AI voices', 'No watermark', '1080p quality', '1 channel profile'],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID,
  },
  PRO: {
    name: 'Pro',
    price: 4900,
    jobsLimit: 75,
    profilesLimit: 5,
    features: ['75 jobs per month', 'Priority queue', '5 channel profiles', 'Custom intros/outros', 'Analytics'],
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
  },
  BUSINESS: {
    name: 'Business',
    price: 9900,
    jobsLimit: 200,
    profilesLimit: -1,
    features: ['200 jobs per month', 'Unlimited profiles', 'Team collaboration', 'API access', 'White-label'],
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

export const REEL_DURATIONS = [5, 10, 15, 30, 60] as const
export const ASPECT_RATIOS = ['9:16', '1:1', '16:9'] as const

export const VIDEO_STYLES = [
  { id: 'cinematic', name: 'Cinematic', color: '#1E293B', desc: 'Movie-like visuals' },
  { id: 'minimal', name: 'Minimal', color: '#F8FAFC', desc: 'Clean & simple' },
  { id: 'energetic', name: 'Energetic', color: '#EF4444', desc: 'High energy vibes' },
  { id: 'dark', name: 'Dark Mode', color: '#0F172A', desc: 'Sleek dark aesthetic' },
  { id: 'neon', name: 'Neon', color: '#A855F7', desc: 'Glowing neon effects' },
  { id: 'warm', name: 'Warm', color: '#F59E0B', desc: 'Warm golden tones' },
  { id: 'corporate', name: 'Corporate', color: '#3B82F6', desc: 'Professional look' },
  { id: 'documentary', name: 'Documentary', color: '#0F766E', desc: 'Educational style' },
  { id: 'retro', name: 'Retro', color: '#D97706', desc: 'Vintage vibes' },
  { id: 'nature', name: 'Nature', color: '#22C55E', desc: 'Earthy organic feel' },
  { id: 'urban', name: 'Urban', color: '#64748B', desc: 'City streetwear' },
  { id: 'luxury', name: 'Luxury', color: '#A16207', desc: 'Premium gold & black' },
  { id: 'playful', name: 'Playful', color: '#EC4899', desc: 'Fun & colorful' },
] as const

export const SUPPORTED_LANGUAGES = [
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pa', name: 'Punjabi', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰' },
  { code: 'bn', name: 'Bengali', flag: '🇮🇳' },
  { code: 'ta', name: 'Tamil', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', flag: '🇮🇳' },
  { code: 'mr', name: 'Marathi', flag: '🇮🇳' },
  { code: 'gu', name: 'Gujarati', flag: '🇮🇳' },
] as const

// Quote module constants
export const QUOTE_CATEGORIES = [
  { id: 'motivational', name: 'Motivation', icon: 'Flame', color: '#F59E0B' },
  { id: 'love', name: 'Love', icon: 'Heart', color: '#EC4899' },
  { id: 'funny', name: 'Comedy', icon: 'Laugh', color: '#F97316' },
  { id: 'wisdom', name: 'Wisdom', icon: 'Brain', color: '#8B5CF6' },
  { id: 'success', name: 'Success', icon: 'Trophy', color: '#10B981' },
  { id: 'life', name: 'Life', icon: 'Leaf', color: '#22C55E' },
  { id: 'friendship', name: 'Friendship', icon: 'Users', color: '#3B82F6' },
  { id: 'islamic', name: 'Islamic', icon: 'Star', color: '#059669' },
  { id: 'shayari', name: 'Hindi Shayari', icon: 'Pen', color: '#E11D48' },
  { id: 'tech', name: 'Tech & Gadgets', icon: 'Cpu', color: '#6366F1' },
  { id: 'finance', name: 'Finance', icon: 'TrendingUp', color: '#0EA5E9' },
  { id: 'fitness', name: 'Fitness', icon: 'Dumbbell', color: '#EF4444' },
  { id: 'education', name: 'Education', icon: 'GraduationCap', color: '#8B5CF6' },
  { id: 'business', name: 'Business', icon: 'Briefcase', color: '#1D4ED8' },
  { id: 'health', name: 'Health & Wellness', icon: 'HeartPulse', color: '#14B8A6' },
  { id: 'cooking', name: 'Cooking', icon: 'ChefHat', color: '#D97706' },
  { id: 'gaming', name: 'Gaming', icon: 'Gamepad2', color: '#7C3AED' },
  { id: 'travel', name: 'Travel', icon: 'Plane', color: '#0284C7' },
  { id: 'beauty', name: 'Beauty & Fashion', icon: 'Gem', color: '#DB2777' },
  { id: 'custom', name: 'Custom Topic', icon: 'Sparkles', color: '#6366F1' },
] as const

export const QUOTE_GRADIENTS = [
  { id: 'sunset', name: 'Sunset', colors: ['#FF6B6B', '#FFE66D'] },
  { id: 'ocean', name: 'Ocean', colors: ['#667eea', '#764ba2'] },
  { id: 'forest', name: 'Forest', colors: ['#11998e', '#38ef7d'] },
  { id: 'midnight', name: 'Midnight', colors: ['#0f0c29', '#302b63'] },
  { id: 'rose', name: 'Rose Gold', colors: ['#f093fb', '#f5576c'] },
  { id: 'sky', name: 'Sky Blue', colors: ['#a1c4fd', '#c2e9fb'] },
  { id: 'ember', name: 'Ember', colors: ['#ff9a9e', '#fad0c4'] },
  { id: 'dark', name: 'Dark Slate', colors: ['#1a1a2e', '#16213e'] },
  { id: 'gold', name: 'Gold', colors: ['#f7971e', '#ffd200'] },
  { id: 'lavender', name: 'Lavender', colors: ['#c471f5', '#fa71cd'] },
  { id: 'earth', name: 'Earth', colors: ['#8E2DE2', '#4A00E0'] },
  { id: 'mono', name: 'Monochrome', colors: ['#232526', '#414345'] },
] as const

export const QUOTE_FONTS = [
  { id: 'serif', name: 'Serif', desc: 'Classic elegant', preview: 'Georgia, serif' },
  { id: 'sans', name: 'Sans Serif', desc: 'Clean modern', preview: 'Arial, sans-serif' },
  { id: 'handwritten', name: 'Handwritten', desc: 'Personal touch', preview: 'cursive' },
  { id: 'bold', name: 'Bold Impact', desc: 'Strong statement', preview: 'Impact, sans-serif' },
] as const

// Challenge / Game Reels constants
export const CHALLENGE_TYPES = [
  { id: 'emoji_guess', name: 'Emoji Guess', icon: 'Smile', color: '#F59E0B', desc: 'Guess the movie/song from emojis' },
  { id: 'riddle', name: 'Riddle Challenge', icon: 'HelpCircle', color: '#8B5CF6', desc: 'Solve the brain teaser' },
  { id: 'math', name: 'Math in 5 Seconds', icon: 'Calculator', color: '#3B82F6', desc: 'Quick math problems' },
  { id: 'gk_quiz', name: 'GK / Trivia Quiz', icon: 'BookOpen', color: '#10B981', desc: 'General knowledge MCQs' },
  { id: 'would_you_rather', name: 'Would You Rather', icon: 'ArrowLeftRight', color: '#EC4899', desc: 'Two tough choices' },
] as const

export const CHALLENGE_CATEGORIES = [
  { id: 'kids', name: 'Kids', icon: 'Baby', color: '#F97316' },
  { id: 'students', name: 'Students', icon: 'GraduationCap', color: '#3B82F6' },
  { id: 'gk', name: 'General Knowledge', icon: 'Globe', color: '#10B981' },
  { id: 'bollywood', name: 'Bollywood', icon: 'Film', color: '#EC4899' },
  { id: 'fun', name: 'Fun & Memes', icon: 'PartyPopper', color: '#F59E0B' },
  { id: 'tech', name: 'Tech & Science', icon: 'Cpu', color: '#6366F1' },
  { id: 'sports', name: 'Sports', icon: 'Trophy', color: '#22C55E' },
  { id: 'exam_prep', name: 'Exam Prep', icon: 'FileText', color: '#EF4444' },
] as const

export const CHALLENGE_DIFFICULTIES = [
  { id: 'easy', name: 'Easy', color: '#22C55E', desc: 'Simple and fun' },
  { id: 'medium', name: 'Medium', color: '#F59E0B', desc: 'A bit tricky' },
  { id: 'hard', name: 'Hard', color: '#EF4444', desc: 'Real brain teaser' },
  { id: 'impossible', name: 'Impossible', color: '#7C3AED', desc: 'Only geniuses solve this' },
] as const

export const CHALLENGE_TEMPLATES = [
  { id: 'neon', name: 'Neon Glow', color: '#06B6D4', desc: 'Dark bg, neon text, glow effects' },
  { id: 'minimal', name: 'Minimal Clean', color: '#94A3B8', desc: 'Clean white/dark, modern look' },
  { id: 'gameshow', name: 'Game Show', color: '#F59E0B', desc: 'Bright, TV game show vibes' },
] as const

export const CHALLENGE_QUESTION_COUNTS = [1, 3, 5] as const
export const CHALLENGE_TIMER_OPTIONS = [5, 10, 15] as const

// Map languages to available voices (initially only English has voices)
export const LANGUAGE_VOICE_MAP: Record<string, string[]> = {
  en: ['EXAVITQu4vr4xnSDxMaL', 'TX3LPaxmHKxFdv7VOQHJ', 'XB0fDUnXU5powFXDhCwa', 'pqHfZKP75CvOlQylNhV4', 'Xb7hH8MSUJpSbSDYk0k2', 'CwhRBWXzGAHq8TQ4Fs17', 'jBpfuIE2acCO8z3wKNLl', 'bIHbv24MWmeRgasZH58o'],
}

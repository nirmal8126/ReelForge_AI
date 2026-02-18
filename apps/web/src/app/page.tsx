import Link from 'next/link'
import { auth } from '@/lib/auth'

const modules = [
  {
    name: 'AI Reels',
    desc: 'Generate short-form videos for YouTube Shorts, Instagram & Facebook Reels with AI scripts, voice, and visuals.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
    color: 'from-brand-500 to-purple-500',
    badge: 'Most Popular',
  },
  {
    name: 'Long-Form Videos',
    desc: 'Create 5-30 minute videos with full AI scripts, TTS narration, background clips, and auto-editing.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-2.625 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 0 1 6 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" />
      </svg>
    ),
    color: 'from-blue-500 to-cyan-500',
    badge: null,
  },
  {
    name: 'Cartoon Studio',
    desc: 'Build animated cartoon series with custom characters, AI-generated stories, and episode-by-episode creation.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
      </svg>
    ),
    color: 'from-pink-500 to-rose-500',
    badge: null,
  },
  {
    name: 'Gameplay Videos',
    desc: '3D animated gameplay footage — endless runners, ball mazes, obstacle towers — no game engine needed.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 0 1-.657.643 48.491 48.491 0 0 1-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 0 1-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 0 0-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 0 1-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 0 0 .657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 0 1-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 0 0 5.427-.63 48.05 48.05 0 0 0 .582-4.717.532.532 0 0 0-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 0 0 .658-.663 48.422 48.422 0 0 0-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 0 1-.61-.58v0Z" />
      </svg>
    ),
    color: 'from-green-500 to-emerald-500',
    badge: 'New',
  },
  {
    name: 'Challenge Reels',
    desc: 'Interactive quiz & challenge videos — emoji guesses, riddles, trivia, math puzzles with timer effects.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
      </svg>
    ),
    color: 'from-amber-500 to-orange-500',
    badge: null,
  },
  {
    name: 'Quotes',
    desc: 'Beautiful motivational, love, wisdom & shayari text quotes.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
    color: 'from-violet-500 to-purple-500',
    badge: null,
  },
]

const steps = [
  {
    step: '01',
    title: 'Choose a Module',
    desc: 'Pick from 6 AI-powered content creation modules — reels, long-form videos, cartoons, gameplay, challenges, or quotes.',
  },
  {
    step: '02',
    title: 'Customize & Generate',
    desc: 'Set your preferences — duration, style, voice, language — and let AI handle scripting, visuals, and audio.',
  },
  {
    step: '03',
    title: 'Download & Publish',
    desc: 'Get your finished content in minutes. Download in HD and publish directly to YouTube, Instagram, or Facebook.',
  },
]

const stats = [
  { value: '6', label: 'AI Modules' },
  { value: '50+', label: 'AI Voices' },
  { value: '9', label: 'Languages' },
  { value: '< 5 min', label: 'Avg. Generation' },
]

export default async function HomePage() {
  const session = await auth()
  const isLoggedIn = !!session?.user

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <header className="border-b border-white/[0.06] sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between p-5 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <span className="text-white font-bold text-sm">RF</span>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">ReelForge AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link href="#modules" className="text-sm text-gray-400 hover:text-white transition">Modules</Link>
            <Link href="#features" className="text-sm text-gray-400 hover:text-white transition">Features</Link>
            <Link href="#pricing" className="text-sm text-gray-400 hover:text-white transition">Pricing</Link>
            {isLoggedIn ? (
              <Link href="/dashboard" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition shadow-lg shadow-brand-500/20">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-400 hover:text-white transition">Sign In</Link>
                <Link href="/register" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition shadow-lg shadow-brand-500/20">
                  Get Started Free
                </Link>
              </>
            )}
          </div>
          {/* Mobile */}
          {isLoggedIn ? (
            <Link href="/dashboard" className="md:hidden rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
              Dashboard
            </Link>
          ) : (
            <Link href="/register" className="md:hidden rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
              Get Started
            </Link>
          )}
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative isolate px-6 pt-14 lg:px-8 overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-brand-500 to-purple-500 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
          </div>
          <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]">
            <div className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-pink-500 to-brand-500 opacity-10 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]" />
          </div>

          <div className="mx-auto max-w-4xl py-24 sm:py-32 lg:py-36">
            <div className="text-center">
              <div className="mb-8 flex justify-center">
                <div className="rounded-full px-4 py-1.5 text-sm font-medium text-brand-400 ring-1 ring-brand-400/30 bg-brand-400/10 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
                  </span>
                  6 AI-Powered Content Modules
                </div>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.1]">
                Create Any Video Content{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-purple-400 to-pink-400">
                  with AI
                </span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-400 max-w-2xl mx-auto">
                From short reels to full-length videos, cartoon series to gameplay footage — one platform, six powerful AI modules. No editing skills needed.
              </p>
              <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
                <Link
                  href="/register"
                  className="rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 px-7 py-3.5 text-base font-semibold text-white shadow-xl hover:shadow-brand-500/25 transition-all hover:scale-[1.02]"
                >
                  Start Creating Free
                </Link>
                <Link
                  href="#modules"
                  className="rounded-xl px-7 py-3.5 text-base font-semibold text-gray-300 ring-1 ring-white/20 hover:ring-white/40 hover:bg-white/5 transition"
                >
                  Explore Modules
                </Link>
              </div>
              <div className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-500 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  3 free jobs/month
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  All 6 modules included
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="border-y border-white/[0.06] bg-white/[0.02]">
          <div className="mx-auto max-w-7xl px-6 lg:px-8 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-3xl font-bold text-white">{s.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Modules Showcase */}
        <section id="modules" className="py-24 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-16">
              <span className="text-sm font-semibold text-brand-400 uppercase tracking-wider">Modules</span>
              <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Six Modules. Endless Content.</h2>
              <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
                Each module is a complete AI pipeline — from idea generation to finished, downloadable content. Pick the one you need.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {modules.map((mod) => (
                <div
                  key={mod.name}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-7 hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${mod.color} flex items-center justify-center text-white shadow-lg`}>
                      {mod.icon}
                    </div>
                    {mod.badge && (
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        mod.badge === 'New'
                          ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                          : 'text-brand-400 bg-brand-500/10 border border-brand-500/20'
                      }`}>
                        {mod.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{mod.name}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{mod.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 px-6 lg:px-8 bg-white/[0.02] border-y border-white/[0.06]">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-16">
              <span className="text-sm font-semibold text-brand-400 uppercase tracking-wider">How It Works</span>
              <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">From Idea to Video in 3 Steps</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {steps.map((s, i) => (
                <div key={s.step} className="relative text-center">
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-white/10 to-transparent" />
                  )}
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 border border-brand-500/20 mb-5">
                    <span className="text-xl font-bold text-brand-400">{s.step}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-16">
              <span className="text-sm font-semibold text-brand-400 uppercase tracking-wider">Platform Features</span>
              <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Built for Content Creators</h2>
              <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
                Everything you need to produce, manage, and scale AI-generated content.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: 'AI Script & Story Generation',
                  desc: 'Claude AI writes scripts, stories, quizzes, and cartoon episodes tailored to your niche.',
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                  ),
                },
                {
                  title: '50+ AI Voices & 9 Languages',
                  desc: 'Natural-sounding ElevenLabs voices in Hindi, English, Punjabi, Urdu, Bengali, Tamil, and more.',
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                  ),
                },
                {
                  title: 'AI Video Generation',
                  desc: 'Stunning visuals powered by RunwayML, canvas rendering, and intelligent clip selection.',
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  ),
                },
                {
                  title: 'Channel Profiles',
                  desc: 'Maintain brand consistency — save tone, style, language, and voice per channel across all modules.',
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                    </svg>
                  ),
                },
                {
                  title: 'Multi-Format Export',
                  desc: 'Export in 9:16 (Shorts/Reels), 16:9 (YouTube), or 1:1 (Instagram). Up to 1080p quality.',
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  ),
                },
                {
                  title: 'Referral Rewards',
                  desc: 'Earn free credits by referring friends. Both you and your friend get bonus credits.',
                  icon: (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                    </svg>
                  ),
                },
              ].map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300">
                  <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400 mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24 px-6 lg:px-8 bg-white/[0.02] border-y border-white/[0.06]">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-16">
              <span className="text-sm font-semibold text-brand-400 uppercase tracking-wider">Pricing</span>
              <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Simple, Transparent Pricing</h2>
              <p className="mt-4 text-lg text-gray-400">Start free. Scale as you grow. Every plan includes all 6 modules.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {[
                { name: 'Free', price: '$0', quota: '3 jobs/mo', features: ['All 6 modules', 'AI script generation', 'Basic voices', '720p quality'] },
                { name: 'Starter', price: '$19', quota: '25 jobs/mo', features: ['Everything in Free', '50+ AI voices', 'No watermark', '1080p quality', '1 channel profile'] },
                { name: 'Pro', price: '$49', quota: '75 jobs/mo', features: ['Everything in Starter', 'Priority queue', '5 channel profiles', 'Custom intros/outros', 'Analytics'], popular: true },
                { name: 'Business', price: '$99', quota: '200 jobs/mo', features: ['Everything in Pro', 'Unlimited profiles', 'Team collaboration', 'API access', 'White-label option'] },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-2xl border p-7 relative ${
                    plan.popular
                      ? 'border-brand-500/50 bg-brand-500/5 ring-1 ring-brand-500/30 shadow-xl shadow-brand-500/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                  } transition-all duration-300`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-400 bg-brand-500/10 border border-brand-500/30 px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-gray-500">/mo</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-400">{plan.quota}</p>
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-gray-300">
                        <svg className={`h-4 w-4 flex-shrink-0 ${plan.popular ? 'text-brand-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={`mt-8 block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition ${
                      plan.popular
                        ? 'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-500/20'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    Get Started
                  </Link>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-6 lg:px-8 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-500/20 to-transparent" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[600px] rounded-full bg-brand-500/10 blur-3xl" />
          </div>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-white sm:text-5xl">Ready to Create?</h2>
            <p className="mt-4 text-lg text-gray-400">
              Join creators who are building content faster with AI. Start with 3 free jobs — no credit card needed.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-brand-600 to-purple-600 px-8 py-3.5 text-base font-semibold text-white shadow-xl hover:shadow-brand-500/25 transition-all hover:scale-[1.02]"
              >
                Get Started Free
              </Link>
              <Link
                href="/login"
                className="rounded-xl px-8 py-3.5 text-base font-semibold text-gray-300 ring-1 ring-white/20 hover:ring-white/40 hover:bg-white/5 transition"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/[0.06] bg-gray-950">
          <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
              {/* Brand */}
              <div className="md:col-span-2">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
                    <span className="text-white font-bold text-xs">RF</span>
                  </div>
                  <span className="text-lg font-bold text-white">ReelForge AI</span>
                </div>
                <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                  AI-powered content creation platform with 6 modules — reels, long-form videos, cartoons, gameplay, challenges, and quotes. Create professional content in minutes.
                </p>
              </div>

              {/* Product */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Product</h4>
                <ul className="space-y-2.5">
                  <li><Link href="#modules" className="text-sm text-gray-500 hover:text-white transition">Modules</Link></li>
                  <li><Link href="#features" className="text-sm text-gray-500 hover:text-white transition">Features</Link></li>
                  <li><Link href="#pricing" className="text-sm text-gray-500 hover:text-white transition">Pricing</Link></li>
                  <li><Link href="/register" className="text-sm text-gray-500 hover:text-white transition">Get Started</Link></li>
                </ul>
              </div>

              {/* Account */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Account</h4>
                <ul className="space-y-2.5">
                  <li><Link href="/login" className="text-sm text-gray-500 hover:text-white transition">Sign In</Link></li>
                  <li><Link href="/register" className="text-sm text-gray-500 hover:text-white transition">Create Account</Link></li>
                  <li><Link href="/dashboard" className="text-sm text-gray-500 hover:text-white transition">Dashboard</Link></li>
                </ul>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-3">
              <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} ReelForge AI. All rights reserved.</p>
              <div className="flex items-center gap-5">
                <Link href="#" className="text-xs text-gray-600 hover:text-gray-400 transition">Privacy Policy</Link>
                <Link href="#" className="text-xs text-gray-600 hover:text-gray-400 transition">Terms of Service</Link>
                <Link href="#" className="text-xs text-gray-600 hover:text-gray-400 transition">Contact</Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}

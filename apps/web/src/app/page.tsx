import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <header className="border-b border-white/10">
        <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">RF</span>
            </div>
            <span className="text-xl font-bold text-white">ReelForge AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-gray-400 hover:text-white transition">Features</Link>
            <Link href="#pricing" className="text-sm text-gray-400 hover:text-white transition">Pricing</Link>
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition">Sign In</Link>
            <Link href="/register" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition">
              Get Started Free
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main>
        <section className="relative isolate px-6 pt-14 lg:px-8">
          <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-brand-500 to-purple-500 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
          </div>
          <div className="mx-auto max-w-3xl py-32 sm:py-48 lg:py-40">
            <div className="text-center">
              <div className="mb-8 flex justify-center">
                <div className="rounded-full px-4 py-1.5 text-sm font-medium text-brand-400 ring-1 ring-brand-400/30 bg-brand-400/10">
                  AI-Powered Video Generation
                </div>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                Create Stunning Reels{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400">
                  in Minutes
                </span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-400 max-w-2xl mx-auto">
                Transform your ideas into professional short-form videos for YouTube Shorts, Instagram Reels, and Facebook Reels. Powered by cutting-edge AI.
              </p>
              <div className="mt-10 flex items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-lg hover:bg-brand-500 transition-all hover:shadow-brand-500/25"
                >
                  Start Creating Free
                </Link>
                <Link
                  href="#features"
                  className="rounded-lg px-6 py-3 text-base font-semibold text-gray-300 ring-1 ring-white/20 hover:ring-white/40 transition"
                >
                  Learn More
                </Link>
              </div>
              <div className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-500">
                <span>3 free reels</span>
                <span className="h-1 w-1 rounded-full bg-gray-700" />
                <span>No credit card required</span>
                <span className="h-1 w-1 rounded-full bg-gray-700" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">Everything You Need to Create Viral Reels</h2>
              <p className="mt-4 text-lg text-gray-400">End-to-end AI pipeline from script to final video</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { title: 'AI Script Generation', desc: 'Claude AI writes engaging scripts tailored to your niche and audience.' },
                { title: 'Voice Synthesis', desc: 'Professional AI voiceovers with 50+ natural-sounding voices.' },
                { title: 'Video Generation', desc: 'Stunning AI-generated visuals powered by RunwayML.' },
                { title: 'Channel Profiles', desc: 'Maintain brand consistency across all your content channels.' },
                { title: 'Multi-Platform', desc: 'Optimized output for YouTube Shorts, Instagram & Facebook Reels.' },
                { title: 'Referral Credits', desc: 'Earn free reels by referring friends. Everyone wins.' },
              ].map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/5 p-8 hover:bg-white/10 transition">
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24 px-6 lg:px-8 bg-gray-950/50">
          <div className="mx-auto max-w-7xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">Simple, Transparent Pricing</h2>
              <p className="mt-4 text-lg text-gray-400">Start free. Scale as you grow.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {[
                { name: 'Free', price: '$0', reels: '3 reels/mo', features: ['AI script generation', 'Basic voices', 'Watermarked output', '720p quality'] },
                { name: 'Starter', price: '$19', reels: '25 reels/mo', features: ['Everything in Free', '50+ AI voices', 'No watermark', '1080p quality', '1 channel profile'] },
                { name: 'Pro', price: '$49', reels: '75 reels/mo', features: ['Everything in Starter', 'Priority queue', '5 channel profiles', 'Custom intros/outros', 'Analytics'], popular: true },
                { name: 'Business', price: '$99', reels: '200 reels/mo', features: ['Everything in Pro', 'Unlimited profiles', 'Team collaboration', 'API access', 'White-label option'] },
              ].map((plan) => (
                <div key={plan.name} className={`rounded-2xl border p-8 ${plan.popular ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500' : 'border-white/10 bg-white/5'}`}>
                  {plan.popular && <div className="text-brand-400 text-sm font-medium mb-4">Most Popular</div>}
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-gray-400">/mo</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">{plan.reels}</p>
                  <ul className="mt-8 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                        <svg className="h-4 w-4 text-brand-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/register" className={`mt-8 block w-full rounded-lg py-2.5 text-center text-sm font-medium transition ${plan.popular ? 'bg-brand-600 text-white hover:bg-brand-500' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    Get Started
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 py-12 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-brand-500 flex items-center justify-center">
                <span className="text-white font-bold text-xs">RF</span>
              </div>
              <span className="text-sm text-gray-400">ReelForge AI</span>
            </div>
            <p className="text-sm text-gray-500">&copy; 2025 ReelForge AI. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  )
}

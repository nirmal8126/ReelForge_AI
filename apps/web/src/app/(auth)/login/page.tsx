'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasGoogleAuth = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const deactivatedParam = searchParams.get('error') === 'deactivated'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
  })

  const onSubmit = async (data: LoginForm) => {
    setServerError('')
    setLoading(true)

    const normalizedEmail = data.email.trim().toLowerCase()

    // Check if account is deactivated before attempting sign-in
    try {
      const checkRes = await fetch('/api/auth/check-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      })
      const checkData = await checkRes.json()
      if (checkData.deactivated) {
        setServerError('Your account has been deactivated. Please contact support to reactivate it.')
        setLoading(false)
        return
      }
    } catch {
      // If check fails, proceed with normal sign-in
    }

    const result = await signIn('credentials', {
      email: normalizedEmail,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      setServerError('Invalid email or password')
      setLoading(false)
    } else {
      router.push(callbackUrl)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-brand-500 flex items-center justify-center">
              <span className="text-white font-bold">RF</span>
            </div>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-white">Welcome back</h1>
          <p className="mt-2 text-gray-400">Sign in to your account</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
          {hasGoogleAuth && (
            <>
              <button
                onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                className="w-full flex items-center justify-center gap-3 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 transition mb-6"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <div className="relative flex justify-center text-sm"><span className="bg-gray-900 px-4 text-gray-400">or</span></div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {deactivatedParam && !serverError && (
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm text-yellow-400">
                Your account has been deactivated. Please contact support to reactivate it.
              </div>
            )}
            {serverError && (
              <div className={`rounded-lg p-3 text-sm ${
                serverError.includes('deactivated')
                  ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {serverError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                {...register('email')}
                className={`w-full rounded-lg bg-white/10 border px-4 py-2.5 text-white placeholder-gray-500 focus:ring-1 outline-none transition ${
                  errors.email
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500'
                    : 'border-white/10 focus:border-brand-500 focus:ring-brand-500'
                }`}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <input
                type="password"
                {...register('password')}
                className={`w-full rounded-lg bg-white/10 border px-4 py-2.5 text-white placeholder-gray-500 focus:ring-1 outline-none transition ${
                  errors.password
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500'
                    : 'border-white/10 focus:border-brand-500 focus:ring-brand-500'
                }`}
                placeholder="Enter password"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-400">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-brand-400 hover:text-brand-300 font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  )
}

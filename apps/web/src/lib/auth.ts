import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@reelforge/db'
import { generateReferralCode } from './utils'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    newUser: '/dashboard',
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const email = String(credentials.email).trim().toLowerCase()
        const password = String(credentials.password)

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.passwordHash) return null
        if (!user.isActive) throw new Error('ACCOUNT_DEACTIVATED')

        const isValid = await bcrypt.compare(
          password,
          user.passwordHash
        )

        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user?.id) return true
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isActive: true },
      })
      if (dbUser && !dbUser.isActive) return '/login?error=deactivated'
      return true
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
      }
      if (trigger === 'signIn' || trigger === 'signUp') {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { subscription: true },
        })
        if (dbUser) {
          token.role = dbUser.role
          token.plan = dbUser.subscription?.plan || 'FREE'
          token.referralCode = dbUser.referralCode
          token.creditsBalance = dbUser.creditsBalance
          token.country = dbUser.country || null
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.plan = token.plan as string
        session.user.referralCode = token.referralCode as string
        session.user.creditsBalance = token.creditsBalance as number
        session.user.country = (token.country as string) || null
      }
      return session
    },
  },
  events: {
    async createUser({ user }) {
      // Generate referral code and create free subscription for new users
      await prisma.user.update({
        where: { id: user.id! },
        data: { referralCode: generateReferralCode() },
      })
      await prisma.subscription.create({
        data: {
          userId: user.id!,
          plan: 'FREE',
          status: 'ACTIVE',
          jobsLimit: 3,
        },
      })
    },
  },
})

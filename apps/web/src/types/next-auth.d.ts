import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      image?: string
      role: string
      plan: string
      referralCode: string
      creditsBalance: number
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    plan: string
    referralCode: string
    creditsBalance: number
  }
}

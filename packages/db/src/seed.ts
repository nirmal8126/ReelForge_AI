import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@reelforge.ai' },
    update: {},
    create: {
      email: 'admin@reelforge.ai',
      name: 'Admin User',
      passwordHash: adminPassword,
      role: 'ADMIN',
      referralCode: 'RFADMIN01',
      emailVerified: new Date(),
    },
  })

  await prisma.subscription.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      jobsLimit: -1,
    },
  })
  console.log('✅ Admin user created: admin@reelforge.ai / admin123')

  // Create demo user
  const demoPassword = await bcrypt.hash('demo1234', 12)
  const demo = await prisma.user.upsert({
    where: { email: 'demo@reelforge.ai' },
    update: {},
    create: {
      email: 'demo@reelforge.ai',
      name: 'Demo User',
      passwordHash: demoPassword,
      referralCode: 'RFDEMO01',
      creditsBalance: 10,
      emailVerified: new Date(),
    },
  })

  await prisma.subscription.upsert({
    where: { userId: demo.id },
    update: {},
    create: {
      userId: demo.id,
      plan: 'PRO',
      status: 'ACTIVE',
      jobsLimit: 75,
      jobsUsed: 12,
    },
  })

  // Create sample channel profile
  await prisma.channelProfile.upsert({
    where: { id: 'demo-profile-1' },
    update: {},
    create: {
      id: 'demo-profile-1',
      userId: demo.id,
      name: 'Tech Reviews',
      platform: 'YOUTUBE',
      niche: 'tech',
      tone: 'PROFESSIONAL',
      primaryColor: '#06B6D4',
      hookStyle: 'stat',
      musicPreference: 'ambient',
      consistencyScore: 85,
      totalReelsGenerated: 12,
      isDefault: true,
    },
  })

  // Create sample reel jobs
  const reelStatuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'PROCESSING', 'QUEUED'] as const
  for (let i = 0; i < 5; i++) {
    await prisma.reelJob.create({
      data: {
        userId: demo.id,
        channelProfileId: 'demo-profile-1',
        title: `Sample Reel ${i + 1}`,
        prompt: `A sample reel about AI tools for content creators - variation ${i + 1}`,
        style: ['cinematic', 'minimal', 'energetic', 'dark', 'neon'][i],
        durationSeconds: [15, 30, 30, 60, 30][i],
        status: reelStatuses[i],
        script: reelStatuses[i] === 'COMPLETED' ? 'This is a sample script.\nIt demonstrates caption timing.\nEach line is a new caption.' : null,
        outputUrl: reelStatuses[i] === 'COMPLETED' ? 'https://example.com/sample-reel.mp4' : null,
        processingTimeMs: reelStatuses[i] === 'COMPLETED' ? 180000 : null,
        completedAt: reelStatuses[i] === 'COMPLETED' ? new Date() : null,
      },
    })
  }

  console.log('✅ Demo user created: demo@reelforge.ai / demo1234')
  console.log('✅ Sample channel profile and reels created')
  console.log('')
  console.log('🎬 ReelForge AI database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

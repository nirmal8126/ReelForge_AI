import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Backfilling language field for existing records...');

  const reels = await prisma.reelJob.updateMany({
    where: { language: null },
    data: { language: 'en' },
  });

  console.log(`✅ Updated ${reels.count} ReelJob records to English`);

  const profiles = await prisma.channelProfile.updateMany({
    where: { defaultLanguage: null },
    data: { defaultLanguage: 'en' },
  });

  console.log(`✅ Updated ${profiles.count} ChannelProfile records to English`);

  console.log('\n🎉 Backfill complete!');
}

main()
  .catch((error) => {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

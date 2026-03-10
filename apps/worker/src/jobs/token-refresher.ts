import { Job } from 'bullmq';
import { prisma } from '@reelforge/db';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Token Refresher — proactively refreshes expiring OAuth tokens
// Runs every 30 minutes. Refreshes tokens that expire within 30 minutes.
// ---------------------------------------------------------------------------

const REFRESH_BUFFER_MS = 30 * 60 * 1000; // 30 minutes before expiry

async function refreshYouTubeToken(account: {
  id: string;
  refreshToken: string;
}): Promise<boolean> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    logger.warn({ accountId: account.id }, 'Missing Google OAuth credentials, skipping refresh');
    return false;
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    logger.error({ accountId: account.id, error: err }, 'YouTube token refresh failed');
    return false;
  }

  const data = await res.json();
  const newAccessToken = data.access_token as string;
  const expiresIn = (data.expires_in as number) || 3600;

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      accessToken: newAccessToken,
      tokenExpiry: new Date(Date.now() + expiresIn * 1000),
    },
  });

  return true;
}

export async function processTokenRefresher(_job: Job) {
  logger.info('Running token refresher');

  const cutoff = new Date(Date.now() + REFRESH_BUFFER_MS);

  // Find all active accounts with tokens expiring soon or already expired
  const expiringAccounts = await prisma.socialAccount.findMany({
    where: {
      isActive: true,
      refreshToken: { not: undefined },
      tokenExpiry: { lte: cutoff },
    },
    select: {
      id: true,
      platform: true,
      accountName: true,
      refreshToken: true,
      tokenExpiry: true,
    },
  });

  if (expiringAccounts.length === 0) {
    logger.info('No tokens need refreshing');
    return { refreshed: 0, failed: 0 };
  }

  let refreshed = 0;
  let failed = 0;

  for (const account of expiringAccounts) {
    if (!account.refreshToken) continue;

    try {
      let success = false;

      if (account.platform === 'YOUTUBE') {
        success = await refreshYouTubeToken({
          id: account.id,
          refreshToken: account.refreshToken,
        });
      }
      // Facebook/Instagram page tokens are long-lived and don't typically need refresh
      // If needed in the future, add handlers here

      if (success) {
        refreshed++;
        logger.info(
          { accountId: account.id, accountName: account.accountName, platform: account.platform },
          'Token refreshed successfully'
        );
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      logger.error(
        {
          accountId: account.id,
          accountName: account.accountName,
          err: err instanceof Error ? err.message : String(err),
        },
        'Token refresh error'
      );
    }
  }

  logger.info({ total: expiringAccounts.length, refreshed, failed }, 'Token refresher complete');
  return { refreshed, failed };
}

import { prisma } from '@reelforge/db';
import {
  type ServiceCategory,
  type ServiceCategoryConfig,
  type ProviderConfig,
  DEFAULT_SERVICE_CONFIGS,
  SERVICE_CONFIG_KEY,
  getEnabledProviders,
  findCategoryConfig,
} from '@reelforge/db';
import { logger } from '../utils/logger';

const log = logger.child({ module: 'service-config' });

// ---------------------------------------------------------------------------
// In-memory cache with TTL (60 seconds)
// ---------------------------------------------------------------------------

let cachedConfigs: ServiceCategoryConfig[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

async function loadConfigs(): Promise<ServiceCategoryConfig[]> {
  const now = Date.now();
  if (cachedConfigs && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfigs;
  }

  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: SERVICE_CONFIG_KEY },
    });

    if (setting?.value) {
      const parsed = JSON.parse(setting.value) as ServiceCategoryConfig[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedConfigs = parsed;
        cacheTimestamp = now;
        return cachedConfigs;
      }
    }
  } catch (err) {
    log.warn({ err }, 'Failed to load service config from DB, using defaults');
  }

  // Fallback to defaults
  cachedConfigs = DEFAULT_SERVICE_CONFIGS;
  cacheTimestamp = now;
  return cachedConfigs;
}

// ---------------------------------------------------------------------------
// Public API: get enabled providers for a service category
// ---------------------------------------------------------------------------

export async function getProviders(category: ServiceCategory): Promise<ProviderConfig[]> {
  const configs = await loadConfigs();
  const catConfig = findCategoryConfig(configs, category);
  if (!catConfig) {
    // Fall back to defaults if category not found
    const defaultCat = findCategoryConfig(DEFAULT_SERVICE_CONFIGS, category);
    return defaultCat ? getEnabledProviders(defaultCat) : [];
  }
  return getEnabledProviders(catConfig);
}

/**
 * Get the first enabled provider for a category that has its API key set.
 * Returns null if no provider is available.
 */
export async function getActiveProvider(category: ServiceCategory): Promise<ProviderConfig | null> {
  const providers = await getProviders(category);
  for (const p of providers) {
    if (process.env[p.envKey]) {
      return p;
    }
  }
  log.warn({ category, providerCount: providers.length }, 'No active provider with API key found');
  return null;
}

/**
 * Get all enabled providers for a category that have their API keys set.
 * Returns them in priority order for fallback chains.
 */
export async function getActiveProviders(category: ServiceCategory): Promise<ProviderConfig[]> {
  const providers = await getProviders(category);
  return providers.filter((p) => process.env[p.envKey]);
}

/**
 * Check if a specific provider is enabled for a category.
 */
export async function isProviderEnabled(category: ServiceCategory, providerId: string): Promise<boolean> {
  const providers = await getProviders(category);
  return providers.some((p) => p.id === providerId);
}

/**
 * Force-refresh the config cache (call after admin updates config).
 */
export function invalidateConfigCache(): void {
  cachedConfigs = null;
  cacheTimestamp = 0;
}

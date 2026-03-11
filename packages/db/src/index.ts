import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

function parseEnvValue(raw: string): string {
  const trimmed = raw.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function walkUpDirs(startDir: string): string[] {
  const dirs: string[] = []
  let current = path.resolve(startDir)

  while (true) {
    dirs.push(current)
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  return dirs
}

function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) return

  const roots = [process.cwd(), __dirname]
  const candidates: string[] = []
  const seen = new Set<string>()

  for (const root of roots) {
    for (const dir of walkUpDirs(root)) {
      const envLocalPath = path.join(dir, '.env.local')
      const envPath = path.join(dir, '.env')
      if (!seen.has(envLocalPath)) {
        seen.add(envLocalPath)
        candidates.push(envLocalPath)
      }
      if (!seen.has(envPath)) {
        seen.add(envPath)
        candidates.push(envPath)
      }
    }
  }

  for (const filePath of candidates) {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const line = content
        .split(/\r?\n/)
        .find((entry) => entry.trim().startsWith('DATABASE_URL='))
      if (!line) continue
      const rawValue = line.slice(line.indexOf('=') + 1)
      const value = parseEnvValue(rawValue)
      if (value) {
        process.env.DATABASE_URL = value
        return
      }
    } catch {
      // ignore missing/unreadable env files
    }
  }
}

function findExistingEngineDir(startDir: string): string | null {
  let current = path.resolve(startDir)

  while (true) {
    const candidate = path.join(current, 'node_modules/.prisma/client')
    try {
      const files = fs.readdirSync(candidate)
      const hasEngine = files.some(
        (file) => file.startsWith('libquery_engine') && file.endsWith('.node')
      )
      if (hasEngine) return candidate
    } catch {
      // ignore and continue walking up
    }

    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  return null
}

function ensurePrismaEnginePath() {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return

  const searchRoots = [process.cwd(), __dirname]
  const seen = new Set<string>()

  for (const root of searchRoots) {
    const engineDir = findExistingEngineDir(root)
    if (!engineDir || seen.has(engineDir)) continue
    seen.add(engineDir)

    try {
      const engineFile = fs
        .readdirSync(engineDir)
        .find((file) => file.startsWith('libquery_engine') && file.endsWith('.node'))
      if (engineFile) {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(engineDir, engineFile)
        return
      }
    } catch {
      // ignore and keep trying
    }
  }
}

ensureDatabaseUrl()
ensurePrismaEnginePath()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '@prisma/client'
export * from './service-config'
export default prisma

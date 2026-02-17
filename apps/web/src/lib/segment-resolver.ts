import { Prisma } from '@reelforge/db'

type Operator = 'eq' | 'neq' | 'in' | 'notIn' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'contains'

export interface SegmentCondition {
  field: string
  operator: Operator
  value: any
}

export interface SegmentRules {
  conditions: SegmentCondition[]
  match: 'all' | 'any'
}

function resolveCondition(c: SegmentCondition): Prisma.UserWhereInput {
  const { field, operator, value } = c

  switch (field) {
    case 'plan': {
      const planFilter = operator === 'in'
        ? { in: value as string[] }
        : operator === 'notIn'
          ? { notIn: value as string[] }
          : operator === 'eq'
            ? value
            : operator === 'neq'
              ? { not: value }
              : value
      return { subscription: { plan: planFilter as any } }
    }

    case 'country': {
      if (operator === 'in') return { country: { in: value as string[] } }
      if (operator === 'notIn') return { country: { notIn: value as string[] } }
      if (operator === 'eq') return { country: value }
      if (operator === 'neq') return { country: { not: value } }
      return {}
    }

    case 'referralTier': {
      if (operator === 'in') return { referralTier: { in: value as any[] } }
      if (operator === 'eq') return { referralTier: value as any }
      if (operator === 'neq') return { referralTier: { not: value as any } }
      return {}
    }

    case 'creditsBalance': {
      return { creditsBalance: buildNumberFilter(operator, value) }
    }

    case 'totalReferrals': {
      return { totalReferrals: buildNumberFilter(operator, value) }
    }

    case 'createdAt': {
      if (operator === 'between' && Array.isArray(value)) {
        return { createdAt: { gte: new Date(value[0]), lte: new Date(value[1]) } }
      }
      return { createdAt: buildDateFilter(operator, value) }
    }

    case 'lastLoginAt': {
      if (operator === 'between' && Array.isArray(value)) {
        return { lastLoginAt: { gte: new Date(value[0]), lte: new Date(value[1]) } }
      }
      return { lastLoginAt: buildDateFilter(operator, value) }
    }

    case 'jobsUsed': {
      return { subscription: { jobsUsed: buildNumberFilter(operator, value) } }
    }

    default:
      return {}
  }
}

function buildNumberFilter(operator: Operator, value: any): any {
  switch (operator) {
    case 'eq': return value
    case 'neq': return { not: value }
    case 'gt': return { gt: value }
    case 'gte': return { gte: value }
    case 'lt': return { lt: value }
    case 'lte': return { lte: value }
    case 'between': return Array.isArray(value) ? { gte: value[0], lte: value[1] } : value
    default: return value
  }
}

function buildDateFilter(operator: Operator, value: any): any {
  switch (operator) {
    case 'gt': return { gt: new Date(value) }
    case 'gte': return { gte: new Date(value) }
    case 'lt': return { lt: new Date(value) }
    case 'lte': return { lte: new Date(value) }
    default: return { gte: new Date(value) }
  }
}

/**
 * Converts segment JSON rules into a Prisma UserWhereInput clause.
 */
export function resolveSegmentRules(rules: SegmentRules): Prisma.UserWhereInput {
  if (!rules?.conditions?.length) return {}

  const conditions = rules.conditions
    .map(resolveCondition)
    .filter((c) => Object.keys(c).length > 0)

  if (conditions.length === 0) return {}

  if (rules.match === 'any') {
    return { OR: conditions }
  }
  return { AND: conditions }
}

/**
 * Check if a specific user matches segment rules.
 */
export function resolveSegmentWhereForUser(
  rules: SegmentRules,
  userId: string
): Prisma.UserWhereInput {
  const segmentWhere = resolveSegmentRules(rules)
  return { AND: [{ id: userId }, segmentWhere] }
}

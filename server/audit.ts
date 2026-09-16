import type { DbHandle } from './db/client.js'
import { auditEvents } from './db/schema.js'
import type { AuthedUser } from './auth.js'

/**
 * Audit log — human actions, memory changes, ingestion, handover steps.
 * Secrets (passwords, API keys) must never reach this: callers pass structured
 * details only, and we scrub obvious secret-looking fields defensively.
 */

const SECRET_PATTERNS = /password|apikey|api_key|secret|token|authorization/i

function scrub(detail: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(detail)) {
    if (SECRET_PATTERNS.test(k)) {
      clean[k] = '[masqué]'
    } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      clean[k] = scrub(v as Record<string, unknown>)
    } else {
      clean[k] = v
    }
  }
  return clean
}

export async function audit(
  dbh: DbHandle,
  organizationId: string,
  opts: {
    actor?: AuthedUser | null
    actorKind?: 'human' | 'agent' | 'system'
    actorName?: string
    action: string
    targetType?: string
    targetId?: string
    detail?: Record<string, unknown>
  },
) {
  await dbh.db.insert(auditEvents).values({
    organizationId,
    actorId: opts.actor?.id ?? null,
    actorName: opts.actor?.name ?? opts.actorName ?? 'système',
    actorKind: opts.actorKind ?? (opts.actor ? 'human' : 'system'),
    action: opts.action,
    targetType: opts.targetType ?? null,
    targetId: opts.targetId ?? null,
    detail: opts.detail ? scrub(opts.detail) : {},
  })
}

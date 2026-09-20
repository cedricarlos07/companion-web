import type { DbHandle } from '../db/client.js'

/** Petit pont SQL typé pour les tools (lecture/écriture simple) — les valeurs
 *  passent par les placeholders $n du driver, jamais par concaténation. */
export async function runCompanionQuery<T = Record<string, unknown>>(
  dbh: DbHandle,
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  return dbh.query<T>(sql, params)
}

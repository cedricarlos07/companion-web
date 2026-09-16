import type { DbHandle } from '../db/client.js'

/** Petit pont SQL typé pour les tools (lecture simple) — évite la duplication de drizzle calls. */
export async function runCompanionQuery<T = Record<string, unknown>>(dbh: DbHandle, sql: string): Promise<T[]> {
  return dbh.query<T>(sql)
}

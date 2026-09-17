import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

/**
 * Stockage du Control Center — PGlite embarqué (un seul process éditeur).
 * En production Kamaloka : DATABASE_URL vers un PostgreSQL dédié.
 */

export interface DbHandle {
  query: <T = Record<string, unknown>>(sql: string) => Promise<T[]>
  exec: (sql: string) => Promise<void>
  driver: string
}

let dbh: DbHandle | null = null
let rawDb: InstanceType<typeof PGlite> | null = null

export async function getDb(): Promise<DbHandle> {
  if (dbh) return dbh

  if (process.env.DATABASE_URL) {
    // PostgreSQL dédié — via pglite non applicable ; le driver node-postgres est
    // ajouté au besoin. V1 : PGlite fichier, suffisant pour l'échelle Kamaloka.
    throw new Error('DATABASE_URL non supporté en v1 du Control Center (PGlite fichier).')
  }

  const dataDir = process.env.CC_DATA_DIR ?? './data/cc'
  fs.mkdirSync(dataDir, { recursive: true })
  const db = new PGlite(dataDir)
  rawDb = db

  const handle: DbHandle = {
    driver: 'pglite',
    query: <T>(sql: string) => db.query(sql).then((r) => r.rows as unknown as T[]),
    exec: (sql) => db.exec(sql).then(() => undefined),
  }
  await handle.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
  dbh = handle
  return handle
}

/** Arrêt propre : flush WAL avant exit (évite un data dir sale au reboot). */
export async function closeDb(): Promise<void> {
  if (rawDb) {
    await rawDb.close().catch(() => {})
    rawDb = null
    dbh = null
  }
}

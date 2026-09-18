import { PGlite } from '@electric-sql/pglite'
import { vector as pgliteVector } from '@electric-sql/pglite/vector'
import { drizzle as drizzlePgLite } from 'drizzle-orm/pglite'
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'

/**
 * DB bootstrap.
 * - DATABASE_URL set  → real PostgreSQL (self-hosted / Docker Compose, pgvector).
 * - otherwise         → PGlite embedded Postgres (same engine, pgvector included),
 *                       persisted under ./data/pg — zero-dependency dev/demo mode.
 */
export interface DbHandle {
  db: ReturnType<typeof drizzlePgLite<typeof schema>>
  /**
   * Requête SQL. `params` (recommandé pour toute valeur issue de la requête
   * HTTP) passe par les placeholders $1, $2… du pilote — jamais par
   * concaténation.
   */
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
  exec: (sql: string, params?: unknown[]) => Promise<void>
  driver: 'pglite' | 'pg'
  close: () => Promise<void>
}

export async function createDb(): Promise<DbHandle> {
  const url = process.env.DATABASE_URL
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: 10 })
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector')
    const db = drizzleNodePg(pool, { schema })
    return {
      db: db as unknown as DbHandle['db'],
      query: async <T>(sql: string, params?: unknown[]) => {
        const res = await pool.query(sql, params)
        return res.rows as T[]
      },
      exec: async (sql, params) => {
        await pool.query(sql, params)
      },
      driver: 'pg',
      close: () => pool.end(),
    }
  }

  const client = new PGlite('./data/pg', { extensions: { vector: pgliteVector } })
  await client.exec('CREATE EXTENSION IF NOT EXISTS vector')
  const db = drizzlePgLite(client, { schema })
  return {
    db: db as unknown as DbHandle['db'],
    query: async <T>(sql: string, params?: unknown[]) => {
      try {
        const res = await client.query<T>(sql, params)
        return res.rows
      } catch (err) {
        console.error('[sql-debug]', sql.replace(/\s+/g, ' ').slice(0, 200), JSON.stringify(params))
        throw err
      }
    },
    exec: async (sql, params) => {
      // PGlite : exec ne prend pas de params — on passe par query quand il y en a.
      try {
        if (params?.length) await client.query(sql, params)
        else await client.exec(sql)
      } catch (err) {
        console.error('[sql-debug]', sql.replace(/\s+/g, ' ').slice(0, 200), JSON.stringify(params))
        throw err
      }
    },
    driver: 'pglite',
    close: () => client.close(),
  }
}

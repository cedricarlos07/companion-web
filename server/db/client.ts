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
  query: <T = Record<string, unknown>>(sql: string) => Promise<T[]>
  exec: (sql: string) => Promise<void>
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
      query: async <T>(sql: string) => {
        const res = await pool.query(sql)
        return res.rows as T[]
      },
      exec: async (sql) => {
        await pool.query(sql)
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
    query: async <T>(sql: string) => {
      const res = await client.query<T>(sql)
      return res.rows
    },
    exec: async (sql) => {
      await client.exec(sql)
    },
    driver: 'pglite',
    close: () => client.close(),
  }
}

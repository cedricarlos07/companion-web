import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DbHandle } from './client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Applies SQL migrations from ./migrations in order, idempotently. */
export async function runMigrations(dbh: DbHandle) {
  await dbh.exec(`CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())`)
  const dir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    const applied = await dbh.query<{ name: string }>(
      `SELECT name FROM _migrations WHERE name = '${file}'`,
    )
    if (applied.length > 0) continue
    const sqlContent = fs.readFileSync(path.join(dir, file), 'utf8')
    await dbh.exec(sqlContent)
    await dbh.exec(`INSERT INTO _migrations (name) VALUES ('${file}')`)
  }
}

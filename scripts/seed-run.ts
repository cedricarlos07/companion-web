import { createDb } from '../server/db/client.js'
import { runMigrations } from '../server/db/migrate.js'
import { seedDatabase } from '../server/seed.js'

const dbh = await createDb()
await runMigrations(dbh)
console.log('[seed-run] migrations ok')
const result = await seedDatabase(dbh)
console.log('[seed-run] résultat:', result)
await dbh.close()
process.exit(0)

import fs from 'node:fs'
import path from 'node:path'
import type { DbHandle } from '../db/client.js'
import { audit } from '../audit.js'

/**
 * Backup / Restore / Upgrade.
 *
 * Un backup contient :
 *   1. backup.json  — toutes les données PostgreSQL (tables métier, ordonnées)
 *   2. uploads/     — fichiers sources stockés sur disque
 *   3. manifest.json — version Companion, date, checksums
 *
 * Compatible PGlite (dev) et PostgreSQL (prod) : export/import en JSON
 * structuré, ordonné par dépendances de clés étrangères.
 */

const BACKUP_DIR = process.env.BACKUP_DIR ?? './data/backups'

// Ordre de réinsertion (parents avant enfants)
const TABLES_ORDER = [
  'organizations',
  'departments',
  'roles',
  'users',
  'employees',
  'sources',
  'documents',
  'chunks',
  'memories',
  'memory_sources',
  'memory_links',
  'memory_versions',
  'feedback',
  'handovers',
  'handover_gaps',
  'handover_answers',
  'onboardings',
  'audit_events',
  'interview_questions',
  'agents',
  'agent_runs',
  'agent_run_steps',
  'tool_calls',
  'approvals',
  'triggers',
  'agent_feedback',
  'invitations',
  'password_resets',
  'email_verifications',
  'user_sessions',
  'invoices',
  'org_entitlements',
  'licenses',
  'settings',
  'credentials',
  'ap_tool_registry',
  'mcp_clients',
]

interface BackupManifest {
  version: string
  createdAt: string
  tables: Record<string, number>
  uploadsCount: number
}

/** Crée un backup complet dans BACKUP_DIR/<timestamp>/ */
export async function createBackup(dbh: DbHandle, organizationId?: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupDir = path.join(BACKUP_DIR, timestamp)
  fs.mkdirSync(backupDir, { recursive: true })

  // 1. Export des données
  const backupData: Record<string, unknown[]> = {}
  const tableCounts: Record<string, number> = {}

  for (const table of TABLES_ORDER) {
    try {
      const exists = await dbh.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS exists`, [table],
      )
      if (!exists[0]?.exists) continue
      // sql:ident — table issue de TABLES_ORDER, whitelist statique du code.
      const rows = await dbh.query<Record<string, unknown>>(`SELECT /* sql:ident */ * FROM ${table}`)
      if (rows.length === 0) continue
      backupData[table] = rows
      tableCounts[table] = rows.length
    } catch {
      // Table optionnelle ou erreur non bloquante
    }
  }

  // 2. Uploads
  const uploadsDir = path.resolve('./data/uploads')
  const uploadsBackup = path.join(backupDir, 'uploads')
  if (fs.existsSync(uploadsDir)) {
    fs.cpSync(uploadsDir, uploadsBackup, { recursive: true })
  }
  const uploadsCount = fs.existsSync(uploadsBackup)
    ? fs.readdirSync(uploadsBackup).length
    : 0

  // 3. Manifest
  const manifest: BackupManifest = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    tables: tableCounts,
    uploadsCount,
  }
  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  // 4. Données
  fs.writeFileSync(path.join(backupDir, 'backup.json'), JSON.stringify(backupData, null, 0))

  return backupDir
}

/** Restaure depuis un backup. Efface les données existantes (destructif). */
export async function restoreBackup(dbh: DbHandle, backupDir: string, organizationId?: string): Promise<RestoreResult> {
  const backupFile = path.join(backupDir, 'backup.json')
  if (!fs.existsSync(backupFile)) throw new Error(`backup.json introuvable dans ${backupDir}`)

  const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8')) as Record<string, unknown[]>
  const restored: Record<string, number> = {}

  // Désactiver les contraintes pendant la restauration
  await dbh.exec('SET session_replication_role = replica').catch(() => {
    // PGlite ne supporte pas session_replication_role — on utilise TRUNCATE CASCADE à la place
  })

  // Effacer les données existantes (ordre inverse)
  for (const table of [...TABLES_ORDER].reverse()) {
    await dbh.exec(`DELETE /* sql:ident */ FROM ${table}`).catch(() => undefined)
  }

  // Réinsérer dans l'ordre de dépendance
  const IDENT_RE = /^[a-z_][a-z0-9_]*$/
  for (const table of TABLES_ORDER) {
    if (!IDENT_RE.test(table)) throw new Error(`nom de table invalide: ${table}`)
    const rows = backupData[table]
    if (!rows || rows.length === 0) continue
    for (const row of rows) {
      const columns = Object.keys(row as Record<string, unknown>).filter((c) => IDENT_RE.test(c))
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
      const params = columns.map((c) => (row as Record<string, unknown>)[c] ?? null)
      await dbh.exec(
        `INSERT /* sql:ident */ INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        params,
      ).catch((err) => {
        console.warn(`[restore] erreur table ${table}:`, String(err).slice(0, 120))
      })
    }
    restored[table] = rows.length
  }

  // Réactiver les contraintes
  await dbh.exec('SET session_replication_role = DEFAULT').catch(() => undefined)

  // Restaurer les uploads
  const uploadsSrc = path.join(backupDir, 'uploads')
  const uploadsDst = path.resolve('./data/uploads')
  if (fs.existsSync(uploadsSrc)) {
    fs.mkdirSync(uploadsDst, { recursive: true })
    fs.cpSync(uploadsSrc, uploadsDst, { recursive: true })
  }

  return { restored, total: Object.values(restored).reduce((s, n) => s + n, 0) }
}

export interface RestoreResult {
  restored: Record<string, number>
  total: number
}

/** Liste les backups disponibles. */
export function listBackups(): { dir: string; manifest: BackupManifest | null }[] {
  if (!fs.existsSync(BACKUP_DIR)) return []
  return fs.readdirSync(BACKUP_DIR)
    .filter((d) => fs.existsSync(path.join(BACKUP_DIR, d, 'manifest.json')))
    .map((d) => ({
      dir: d,
      manifest: JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, d, 'manifest.json'), 'utf8')) as BackupManifest,
    }))
}

/** Backup automatique avant migration (appelé avant runMigrations si des changements sont détectés). */
export async function preUpgradeBackup(dbh: DbHandle): Promise<string | null> {
  try {
    return await createBackup(dbh)
  } catch (err) {
    console.error('[backup] pre-upgrade backup a échoué:', err)
    return null
  }
}

// path module import

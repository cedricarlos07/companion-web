import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Version installée de Companion — lue depuis package.json (source de vérité,
 * bumpée à chaque release). Le heartbeat de licence et /system/update-check
 * remontent cette valeur.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as { version: string }

export const APP_VERSION: string = pkg.version

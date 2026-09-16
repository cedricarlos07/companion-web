import fs from 'node:fs'
import path from 'node:path'
import { eq, sql } from 'drizzle-orm'
import type { DbHandle } from '../db/client.js'
import { documents, chunks, employees, roles } from '../db/schema.js'
import { config } from '../config.js'
import { embed, toPgVectorLiteral } from './embeddings.js'
import { extractCandidates } from './extraction.js'
import { createMemory } from './memory.js'

/**
 * Source ingestion pipeline:
 * extract → normalize → chunk → embed → memory candidates → dedup/contradiction → save → index.
 * The original document text is always preserved (documents.raw_text + file on disk).
 */

export interface IngestResult {
  documentId: string
  pagesApprox: number
  chunksIndexed: number
  candidatesFound: number
  memoriesCreated: number
  confirmations: number
  conflicts: number
  engine: 'llm' | 'heuristic'
}

const CHUNK_SIZE = 900
const CHUNK_OVERLAP = 150

function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (clean.length <= CHUNK_SIZE) return clean.length > 0 ? [clean] : []
  const out: string[] = []
  let start = 0
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length)
    if (end < clean.length) {
      const breakPoint = clean.lastIndexOf('.', end)
      const nlPoint = clean.lastIndexOf('\n', end)
      const soft = Math.max(breakPoint, nlPoint)
      if (soft > start + CHUNK_SIZE * 0.5) end = soft + 1
    }
    out.push(clean.slice(start, end).trim())
    start = end - CHUNK_OVERLAP
    if (start < 0) start = 0
    if (end >= clean.length) break
  }
  return out.filter((c) => c.length > 40)
}

export async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  if (mimeType === 'pdf') {
    const { PDFParse } = await import('pdf-parse')
    const buffer = fs.readFileSync(filePath)
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    try {
      const result = await parser.getText()
      return result.text ?? ''
    } finally {
      await parser.destroy()
    }
  }
  if (mimeType === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value ?? ''
  }
  // txt | md | csv | paste — plain text
  return fs.readFileSync(filePath, 'utf8')
}

export async function ingestDocument(
  dbh: DbHandle,
  documentId: string,
  actorName: string,
): Promise<IngestResult> {
  const docs = await dbh.query<{
    id: string; organization_id: string; title: string; mime_type: string;
    storage_path: string | null; raw_text: string | null; source_id: string | null;
  }>(`SELECT id, organization_id, title, mime_type, storage_path, raw_text, source_id FROM documents WHERE id = '${documentId}'`)
  const doc = docs[0]
  if (!doc) throw new Error(`document introuvable: ${documentId}`)

  await setStatus(dbh, documentId, 'extracting', 'extraction du texte')

  let text = doc.raw_text ?? ''
  if (!text && doc.storage_path && fs.existsSync(doc.storage_path)) {
    text = await extractTextFromFile(doc.storage_path, doc.mime_type)
    await dbh.db.update(documents).set({ rawText: text }).where(eq(documents.id, documentId))
  }
  text = (text ?? '').trim()

  if (text.length < 20) {
    await setStatus(dbh, documentId, 'failed', 'texte insuffisant ou illisible')
    return { documentId, pagesApprox: 0, chunksIndexed: 0, candidatesFound: 0, memoriesCreated: 0, confirmations: 0, conflicts: 0, engine: 'heuristic' }
  }

  // Owner context (employee/role) — uploads carry the knowledge owner in source config.
  let employeeId: string | null = null
  let roleId: string | null = null
  let employeeName = ''
  let roleTitle = ''

  if (doc.source_id) {
    const ownerRows = await dbh.query<{ employee_id: string | null; first_name: string | null; last_name: string | null; role_id: string | null; role_title: string | null }>(`
      SELECT e.id AS employee_id, e.first_name, e.last_name, r.id AS role_id, r.title AS role_title
      FROM sources s
      LEFT JOIN employees e ON e.id::text = (s.config->>'employeeId')
      LEFT JOIN roles r ON r.id = e.role_id
      WHERE s.id = ${quoteStr(doc.source_id)}
    `)
    if (ownerRows[0]) {
      employeeId = ownerRows[0].employee_id ?? null
      roleId = ownerRows[0].role_id ?? null
      employeeName = `${ownerRows[0].first_name ?? ''} ${ownerRows[0].last_name ?? ''}`.trim()
      roleTitle = ownerRows[0].role_title ?? ''
    }
  }

  const parts = chunkText(text)
  const pagesApprox = Math.max(1, Math.round(text.length / 2600))

  // Embed + index chunks
  await setStatus(dbh, documentId, 'embedding', `${parts.length} fragments`)
  let chunkCounter = 0
  const chunkIds: string[] = []
  for (const [i, part] of parts.entries()) {
    const { vector, provider } = await embed(part)
    const id = crypto.randomUUID()
    await dbh.exec(
      `INSERT INTO chunks (id, document_id, organization_id, chunk_index, content, embedding, embedding_provider)
       VALUES ('${id}', '${doc.id}', '${doc.organization_id}', ${i}, ${quoteStr(part)}, '${toPgVectorLiteral(vector)}'::vector, '${provider}')`,
    )
    chunkIds.push(id)
    chunkCounter++
  }

  // Memory candidate extraction per chunk
  await setStatus(dbh, documentId, 'extracting_memories', 'extraction des connaissances')
  let created = 0
  let confirmations = 0
  let conflicts = 0
  let candidatesFound = 0
  let engine: 'llm' | 'heuristic' = 'heuristic'

  // Remember which candidates we already created for this document to avoid dupes inside one doc.
  const createdTitles = new Set<string>()

  for (const [i, part] of parts.entries()) {
    const { candidates, engine: e } = await extractCandidates(part, {
      documentTitle: doc.title,
      employeeName: employeeName || undefined,
      roleTitle: roleTitle || undefined,
    })
    engine = e
    candidatesFound += candidates.length

    for (const candidate of candidates) {
      const titleKey = candidate.title.toLowerCase().slice(0, 60)
      if (createdTitles.has(titleKey)) continue
      createdTitles.add(titleKey)

      const scope: 'employee' | 'role' | 'department' | 'company' =
        candidate.scopeSuggestion === 'restricted'
          ? 'employee'
          : candidate.scopeSuggestion === 'employee' && !employeeId
            ? 'role'
            : (candidate.scopeSuggestion as 'employee' | 'role' | 'department' | 'company')

      const result = await createMemory(dbh, {
        organizationId: doc.organization_id,
        type: candidate.type,
        title: candidate.title,
        content: candidate.content,
        scope,
        employeeId: scope === 'employee' ? employeeId : employeeId ?? null,
        roleId: roleId,
        confidence: candidate.confidence,
        importance: candidate.importance,
        validFrom: candidate.validFrom ?? null,
        contributor: employeeName || actorName,
        origin: e === 'llm' ? 'llm' : 'heuristic',
        source: {
          documentId: doc.id,
          chunkId: chunkIds[i] ?? null,
          excerpt: part.slice(0, 280),
          location: `fragment ${i + 1}/${parts.length}`,
        },
        changedBy: actorName,
      })
      if (result.created) created++
      else if (result.verdict.action === 'confirm') confirmations++
      if (result.verdict.action === 'flag-contradiction') conflicts++
    }
  }

  await setStatus(dbh, documentId, 'done', `${created} mémoires créées`)
  void roleId
  return {
    documentId,
    pagesApprox,
    chunksIndexed: chunkCounter,
    candidatesFound,
    memoriesCreated: created,
    confirmations,
    conflicts,
    engine,
  }
}

async function setStatus(dbh: DbHandle, documentId: string, status: string, detail: string) {
  await dbh.db.update(documents).set({ status, statusDetail: detail }).where(eq(documents.id, documentId))
}

function quoteStr(s: string | null | undefined): string {
  if (s === null || s === undefined) return 'NULL'
  return `'${s.replace(/'/g, "''")}'`
}

/** Ensures the upload directory exists. */
export function ensureUploadsDir() {
  fs.mkdirSync(config.uploadsDir, { recursive: true })
}

export function storagePathFor(organizationId: string, fileName: string): string {
  ensureUploadsDir()
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  return path.join(config.uploadsDir, `${organizationId.slice(0, 8)}-${Date.now()}-${safe}`)
}

import { ollamaChatJson, ollamaStatus } from '../providers/ollama.js'
import type { MemoryType, MemoryScope } from './memory.js'

/**
 * Memory candidate extraction.
 * Primary: Ollama with structured JSON output.
 * Fallback: deterministic French heuristic extractor — so the pipeline always
 * produces candidates, honestly labeled with lower confidence.
 */

export interface MemoryCandidate {
  type: MemoryType
  title: string
  content: string
  scopeSuggestion: MemoryScope
  confidence: number
  importance: number
  validFrom?: string
}

const VALID_TYPES: MemoryType[] = [
  'fact', 'decision', 'procedure', 'relationship', 'preference', 'lesson', 'project', 'handover',
]

const EXTRACTION_SYSTEM = `Tu es un moteur d'extraction de connaissances pour une entreprise.
À partir d'un extrait de document professionnel, extrais 0 à 4 connaissances durables et réutilisables.
Réponds UNIQUEMENT en JSON avec la forme exacte :
{"memories":[{"type":"fact|decision|procedure|relationship|preference|lesson|project|handover","title":"titre court","content":"connaissance complète et autonome, rédigée à la 3e personne","scopeSuggestion":"employee|role|department|company","confidence":40-95,"importance":20-100,"validFrom":"YYYY ou YYYY-MM ou texte court optionnel"}]}
Règles :
- Une procédure = étapes reproductibles. Une décision = choix + rationale. Une relation = client/partenaire/fournisseur et qui le gère.
- Ignorer les banalités, les formules de politesse, le remplissage.
- Chaque content doit être compréhensible sans lire le document.
- confidence basse (< 60) si l'information est implicite ou incertaine.
- Si rien n'est extractable, réponds {"memories":[]}.`

export async function extractCandidates(
  chunkText: string,
  context: { documentTitle: string; employeeName?: string; roleTitle?: string },
): Promise<{ candidates: MemoryCandidate[]; engine: 'llm' | 'heuristic' }> {
  const status = await ollamaStatus()
  if (status.available) {
    const userPrompt = `Document : ${context.documentTitle}${context.employeeName ? `\nAuteur / titulaire du rôle : ${context.employeeName}` : ''}${context.roleTitle ? `\nRôle : ${context.roleTitle}` : ''}\n\nExtrait :\n"""\n${chunkText.slice(0, 4000)}\n"""`
    const result = await ollamaChatJson(
      [
        { role: 'system', content: EXTRACTION_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.1 },
    )
    const memories = (result as { memories?: unknown[] })?.memories
    if (Array.isArray(memories)) {
      const candidates = memories
        .map(serializeLlmCandidate)
        .filter((c): c is MemoryCandidate => c !== null)
      if (candidates.length > 0) {
        return { candidates, engine: 'llm' }
      }
      // JSON valide mais rien d'exploitable → plancher heuristique.
      const fallback = heuristicExtract(chunkText)
      return { candidates: fallback, engine: fallback.length > 0 ? 'heuristic' : 'llm' }
    }
  }
  return { candidates: heuristicExtract(chunkText), engine: 'heuristic' }
}

function serializeLlmCandidate(raw: unknown): MemoryCandidate | null {
  const m = raw as Partial<MemoryCandidate>
  if (!m || typeof m.title !== 'string' || typeof m.content !== 'string') return null
  if (m.title.trim().length < 6 || m.content.trim().length < 15) return null
  const type = VALID_TYPES.includes(m.type as MemoryType) ? (m.type as MemoryType) : 'fact'
  const scope = (['employee', 'role', 'department', 'company'] as MemoryScope[]).includes(
    m.scopeSuggestion as MemoryScope,
  )
    ? (m.scopeSuggestion as MemoryScope)
    : 'company'
  const clamp = (n: unknown, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, Math.round(Number(n) || lo)))
  return {
    type,
    title: m.title.trim().slice(0, 160),
    content: m.content.trim().slice(0, 1200),
    scopeSuggestion: scope,
    confidence: clamp(m.confidence, 30, 95),
    importance: clamp(m.importance, 20, 100),
    validFrom: typeof m.validFrom === 'string' ? m.validFrom.slice(0, 40) : undefined,
  }
}

/* ------------------------- Heuristic fallback ---------------------------- */

const TYPE_SIGNALS: { type: MemoryType; patterns: RegExp[]; base: number }[] = [
  {
    type: 'procedure',
    patterns: [/\bproc[ée]dur/i, /\b[ée]tapes?\b/i, /\bprocessus\b/i, /\bil faut\b/i, /\bdoit [êe]tre\b/i, /\bavant de\b/i, /\bpuis\b/i, /\benfin\b/i],
    base: 55,
  },
  {
    type: 'decision',
    patterns: [/\bd[ée]cid[ée]/i, /\bd[ée]cision\b/i, /\bnous avons choisi/i, /\bvalid[ée] en comit[ée]/i, /\barr[êe]t[ée] le choix/i, /\bvalid(é|e)e par\b/i],
    base: 58,
  },
  {
    type: 'relationship',
    patterns: [/\bclient(s)?\b/i, /\bfournisseur(s)?\b/i, /\bpartenaire(s)?\b/i, /\binterlocuteur/i, /\bcontact/i],
    base: 42,
  },
  {
    type: 'lesson',
    patterns: [/\ble[çc]on\b/i, /\bretour d'exp[ée]rience/i, /\battention\b/i, /\b[ée]viter\b/i, /\bpr[ée]voir\b/i, /\bconstat[ée] que\b/i],
    base: 46,
  },
  {
    type: 'preference',
    patterns: [/\bpr[ée]f[èe]re/i, /\btoujours\b/i, /\bjamais\b/i, /\bde pr[ée]f[ée]rence/i, /\bhors contrat/i],
    base: 40,
  },
  {
    type: 'project',
    patterns: [/\bprojet\b/i, /\bphase\b/i, /\bjalon\b/i, /\bpilote\b/i, /\bd[ée]ploiement\b/i],
    base: 44,
  },
  {
    type: 'fact',
    patterns: [/\bexige\b/i, /\bconditions?\b/i, /\bd[ée]lai(s)?\b/i, /\bmontant\b/i, /\bpourcentage\b/i, /%\b/],
    base: 40,
  },
]

/** Sentence-level French heuristic extraction — deterministic, lower confidence. */
export function heuristicExtract(text: string): MemoryCandidate[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 60 && s.length <= 600)

  const candidates: MemoryCandidate[] = []
  for (const sentence of sentences) {
    let best: { type: MemoryType; score: number } | null = null
    for (const signal of TYPE_SIGNALS) {
      const hits = signal.patterns.filter((p) => p.test(sentence)).length
      if (hits > 0) {
        const score = signal.base + hits * 4
        if (!best || score > best.score) best = { type: signal.type, score }
      }
    }
    if (!best) continue
    if (candidates.some((c) => similarEnough(c.title, sentence))) continue
    const title = sentence.length > 90 ? `${sentence.slice(0, 87)}…` : sentence
    candidates.push({
      type: best.type,
      title,
      content: sentence,
      scopeSuggestion: /client|fournisseur/i.test(sentence) ? 'employee' : 'role',
      // Heuristics stay below the auto-truth line: candidates need human review.
      confidence: Math.min(64, best.score),
      importance: /proc[ée]dur|d[ée]cision|obligatoire|validation/i.test(sentence) ? 70 : 45,
    })
    if (candidates.length >= 4) break
  }
  return candidates
}

function similarEnough(a: string, b: string): boolean {
  const aw = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 3))
  const bw = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 3))
  if (aw.size === 0 || bw.size === 0) return false
  let inter = 0
  for (const w of aw) if (bw.has(w)) inter++
  return inter / Math.min(aw.size, bw.size) > 0.7
}

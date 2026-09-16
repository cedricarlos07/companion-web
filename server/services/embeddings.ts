import { config } from '../config.js'
import { ollamaEmbed, ollamaStatus } from '../providers/ollama.js'

/**
 * Embedding provider interface.
 * Primary: Ollama (nomic-embed-text, 768d, local).
 * Fallback: deterministic hashed bag-of-words into the same 768-dim space, so
 * pgvector retrieval works even without a model — degraded but functional.
 */

export interface EmbedResult {
  vector: number[]
  provider: 'ollama' | 'local-hash'
}

const FRENCH_STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'à', 'au', 'aux', 'en',
  'dans', 'sur', 'pour', 'par', 'avec', 'sans', 'sous', 'sur', 'que', 'qui', 'quoi', 'dont',
  'est', 'sont', 'être', 'avoir', 'a', 'ont', 'ce', 'cet', 'cette', 'ces', 'son', 'sa', 'ses',
  'leur', 'leurs', 'nous', 'vous', 'il', 'elle', 'ils', 'elles', 'on', 'se', 'ne', 'pas',
  'plus', 'moins', 'très', 'bien', 'aussi', 'alors', 'donc', 'si', 'comme', 'tout', 'tous',
  'the', 'of', 'to', 'and', 'in', 'is', 'it', 'for', 'on', 'with', 'as', 'at', 'by', 'be',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9àâçéèêëîïôûùüÿñ\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !FRENCH_STOPWORDS.has(t))
}

function hashToken(token: string, seed: number): number {
  let h = seed
  for (let i = 0; i < token.length; i++) {
    h = (Math.imul(31, h) + token.charCodeAt(i)) >>> 0
  }
  return h
}

/** Deterministic local embedder — hashed bag-of-words, L2-normalized. */
export function localEmbed(text: string): number[] {
  const vec = new Array(config.embedDim).fill(0)
  const tokens = tokenize(text)
  for (const token of tokens) {
    const idx = hashToken(token, 0x9e3779b9) % config.embedDim
    const sign = hashToken(token, 0x85ebca6b) % 2 === 0 ? 1 : -1
    vec[idx] += sign
    // bigram-ish second probe to reduce collisions
    const idx2 = hashToken(token, 0xc2b2ae35) % config.embedDim
    vec[idx2] += 0.5 * sign
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}

/** Embed text through the best available provider. */
export async function embed(text: string): Promise<EmbedResult> {
  const status = await ollamaStatus()
  if (status.available) {
    const vector = await ollamaEmbed(text.slice(0, 6000))
    if (vector) {
      // Model dim may differ from column dim — pad or truncate to config.embedDim.
      return { vector: fitDimension(vector), provider: 'ollama' }
    }
  }
  return { vector: localEmbed(text), provider: 'local-hash' }
}

function fitDimension(vector: number[]): number[] {
  if (vector.length === config.embedDim) return vector
  if (vector.length > config.embedDim) return vector.slice(0, config.embedDim)
  const out = new Array(config.embedDim).fill(0)
  // Deterministic expansion: fold values across the vector into the target space.
  for (let i = 0; i < vector.length; i++) {
    out[i % config.embedDim] += vector[i]
  }
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1
  return out.map((v) => v / norm)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) dot += a[i] * b[i]
  return dot
}

export function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.map((v) => Number.isFinite(v) ? v.toFixed(6) : '0').join(',')}]`
}

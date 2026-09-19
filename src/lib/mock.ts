/**
 * Garde anti-mock — la règle commerciale :
 *
 *   0 donnée mockée en production.
 *   0 bouton principal sans backend.
 *   0 écriture non persistée.
 *
 * `ALLOW_MOCK_DATA` est injecté au build par vite.config.ts depuis
 * l'environnement (`ALLOW_MOCK_DATA=true`). Par défaut : INTERDIT.
 *
 * En production (`import.meta.env.PROD`), une valeur truthy fait échouer le
 * démarrage de l'application (src/main.tsx) — impossible de servir des
 * fixtures à un client payant, même par erreur de configuration.
 *
 * Utilisation dans une page : quand l'API échoue et qu'un repli démonstration
 * existe encore (à faire disparaître), le repli n'est pris que si
 * `assertMockAllowed('page/x')` renvoie true — sinon l'erreur est affichée.
 */

export const MOCK_ALLOWED: boolean =
  import.meta.env.ALLOW_MOCK_DATA === true || import.meta.env.ALLOW_MOCK_DATA === 'true'

/** Vrai en build de production (vite). */
export const IS_PROD_BUILD: boolean = import.meta.env.PROD === true

export function assertMockAllowed(context: string): boolean {
  if (MOCK_ALLOWED) return true
  // En dev, on signale chaque repli bloqué : c'est la liste des pages à brancher.
  if (import.meta.env.DEV) console.warn(`[companion] mock bloqué (${context}) — API réelle requise`)
  return false
}

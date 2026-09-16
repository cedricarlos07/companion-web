import { useSyncExternalStore } from 'react'

/**
 * Thème clair / sombre / système de la plateforme.
 *
 * - Le choix persiste dans localStorage (`companion-theme`), défaut : système.
 * - `applyTheme` bascule la classe `.dark` sur <html>, que le CSS BoardUI
 *   (styles/theme.css) utilise pour retourner tous les tokens sémantiques.
 * - index.html applique la même logique inline avant le premier rendu pour
 *   éviter le flash ; ce module la rejoue à l'hydratation.
 *
 * Le store expose un compteur de version consommé par `useTheme` — les
 * composants lisent `getThemeChoice()` / `resolvedTheme()` après re-render.
 */

export type ThemeChoice = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'companion-theme'

let choice: ThemeChoice = load()
let version = 0
const listeners = new Set<() => void>()

function load(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // Stockage indisponible — on reste sur le défaut système.
  }
  return 'system'
}

export function resolvedTheme(): 'light' | 'dark' {
  if (choice !== 'system') return choice
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function commit() {
  document.documentElement.classList.toggle('dark', resolvedTheme() === 'dark')
  version++
  listeners.forEach((l) => l())
}

export function getThemeChoice(): ThemeChoice {
  return choice
}

export function setTheme(next: ThemeChoice) {
  choice = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Le choix reste actif pour la session même sans stockage.
  }
  commit()
}

export function useTheme(): ThemeChoice {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    () => version,
  )
  return choice
}

// Un changement OS pendant le mode « système » doit repercuter le flip.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (choice === 'system') commit()
})

commit()

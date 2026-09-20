import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cx } from '@/utils/cx'
import { HugeIcon } from '@/components/ui/huge-icon'
import {
  AiBrain01Icon,
  BotIcon,
  Database01Icon,
  Exchange01Icon,
  HierarchyIcon,
  Search01Icon,
  UserGroupIcon,
  ArrowRight02Icon,
} from '@/lib/icons'
import { Kbd } from '@/components/base/kbd/kbd'
import { api, type AgentListRow } from '@/services/api'

interface SearchEntry {
  id: string
  group: string
  icon: typeof Search01Icon
  title: string
  meta?: string
  href: string
}

const GROUP_ORDER = ['Personnes', 'Connaissances', 'Rôles', 'Agents', 'Transferts', 'Sources'] as const

/** Index construit sur les données réelles de l'organisation. */
async function buildIndex(): Promise<SearchEntry[]> {
  const [employees, memories, roles, agents, handovers] = await Promise.all([
    api.employees(),
    api.memories(),
    api.roles(),
    api.agents(),
    api.handovers(),
  ])
  const entries: SearchEntry[] = []
  for (const e of employees ?? []) {
    entries.push({
      id: e.id, group: 'Personnes', icon: UserGroupIcon,
      title: `${e.firstName} ${e.lastName}`, meta: e.roleTitle, href: `/people/${e.id}`,
    })
  }
  for (const m of (memories ?? []).slice(0, 80)) {
    entries.push({
      id: m.id, group: 'Connaissances', icon: AiBrain01Icon,
      title: m.title, meta: m.scope, href: `/brain/${m.id}`,
    })
  }
  for (const r of roles ?? []) {
    entries.push({
      id: r.id, group: 'Rôles', icon: HierarchyIcon,
      title: r.title, meta: `${r.currentEmployees} en poste`, href: `/roles/${r.id}`,
    })
  }
  for (const a of (agents ?? { agents: [] as AgentListRow[] }).agents ?? []) {
    entries.push({
      id: a.id, group: 'Agents', icon: BotIcon,
      title: a.name, meta: a.key, href: `/agents/${a.id}`,
    })
  }
  for (const h of handovers ?? []) {
    entries.push({
      id: h.id, group: 'Transferts', icon: Exchange01Icon,
      title: `Handover — ${h.employeeName}`, meta: h.roleTitle, href: `/handovers/${h.id}`,
    })
  }
  entries.push({ id: 'grp-sources', group: 'Sources', icon: Database01Icon, title: 'Sources', meta: 'Connecteurs de données', href: '/sources' })
  return entries
}

/** ⌘K global command search with grouped results and keyboard navigation. */
export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const [index, setIndex] = useState<SearchEntry[]>([])
  const [loadingIndex, setLoadingIndex] = useState(false)

  // L'index réel se charge au premier appel — jamais de données codées.
  useEffect(() => {
    if (!open || index.length > 0 || loadingIndex) return
    setLoadingIndex(true)
    void buildIndex().then((entries) => {
      setIndex(entries)
      setLoadingIndex(false)
    })
  }, [open, index.length, loadingIndex])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // Default: show a sample of everything, grouped.
      const seen = new Map<string, SearchEntry[]>()
      for (const entry of index) {
        const list = seen.get(entry.group) ?? []
        if (list.length < 3) list.push(entry)
        seen.set(entry.group, list)
      }
      return seen
    }
    const filtered = index.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.meta ?? '').toLowerCase().includes(q) ||
        e.group.toLowerCase().includes(q),
    )
    const grouped = new Map<string, SearchEntry[]>()
    for (const entry of filtered.slice(0, 24)) {
      const list = grouped.get(entry.group) ?? []
      list.push(entry)
      grouped.set(entry.group, list)
    }
    return grouped
  }, [index, query])

  const flat = useMemo(
    () => GROUP_ORDER.flatMap((g) => results.get(g) ?? []),
    [results],
  )

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      // Slight delay so the input exists before focus.
      window.setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => setActive(0), [query])

  if (!open) return null

  function go(entry: SearchEntry) {
    onClose()
    navigate(entry.href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const entry = flat[active]
      if (entry) go(entry)
    }
  }

  let flatIndex = -1

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-950/40 p-4 pt-[12vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recherche globale"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default shadow-xl"
      >
        <div className="flex items-center gap-2.5 border-b border-separator-border px-4">
          <HugeIcon icon={Search01Icon} size="md" className="shrink-0 text-foreground-icon-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans Companion…"
            aria-label="Rechercher"
            className="h-12 flex-1 bg-transparent text-body-medium text-text-primary outline-none placeholder:text-text-placeholder"
          />
          <Kbd>Échap</Kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2" role="listbox" aria-label="Résultats">
          {loadingIndex && (
            <p className="px-3 py-8 text-center text-body-2-regular text-text-tertiary">
              Chargement de l'index de recherche…
            </p>
          )}
          {!loadingIndex && flat.length === 0 && (
            <p className="px-3 py-8 text-center text-body-2-regular text-text-tertiary">
              Aucun résultat pour « {query} ».
            </p>
          )}
          {GROUP_ORDER.map((group) => {
            const entries = results.get(group)
            if (!entries || entries.length === 0) return null
            return (
              <div key={group} className="mb-1">
                <p className="px-3 pt-2 pb-1 text-caption-1-semibold tracking-wide text-text-tertiary uppercase">
                  {group}
                </p>
                {entries.map((entry) => {
                  flatIndex += 1
                  const isActive = flatIndex === active
                  return (
                    <button
                      key={`${group}-${entry.id}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActive(flat[flatIndex] === entry ? flatIndex : active)}
                      onClick={() => go(entry)}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none',
                        isActive ? 'bg-background-secondary-default' : 'hover:bg-background-primary-hover',
                      )}
                    >
                      <HugeIcon icon={entry.icon} size="sm" className="shrink-0 text-foreground-icon-secondary" />
                      <span className="min-w-0 flex-1 truncate text-body-medium text-text-primary">
                        {entry.title}
                      </span>
                      {entry.meta && (
                        <span className="shrink-0 text-caption-1-medium text-text-tertiary">{entry.meta}</span>
                      )}
                      <HugeIcon
                        icon={ArrowRight02Icon}
                        size="xs"
                        className={cx('shrink-0', isActive ? 'text-foreground-icon-secondary' : 'invisible')}
                      />
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-separator-border px-4 py-2 text-caption-1-medium text-text-tertiary">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> naviguer
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> ouvrir
          </span>
        </div>
      </div>
    </div>
  )
}

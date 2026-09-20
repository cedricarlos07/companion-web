import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import {
  KnowledgeStatusBadge,
  KnowledgeTypeBadge,
  KNOWLEDGE_TYPE_ICONS,
  memoryStatusMeta,
} from '@/components/common/badges'
import { EmptyState } from '@/components/common/states'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { api } from '@/services/api'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Select, SelectItem } from '@/components/base/select/select'
import { Pagination } from '@/components/base/pagination/pagination'
import { Search01Icon } from '@/lib/icons'
import { cx } from '@/utils/cx'
import type { KnowledgeType, Memory, MemoryStatus } from '@/types'

const TYPE_FILTERS: { id: KnowledgeType | 'all'; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'fact', label: 'Faits' },
  { id: 'decision', label: 'Décisions' },
  { id: 'procedure', label: 'Procédures' },
  { id: 'relationship', label: 'Relations' },
  { id: 'lesson', label: 'Leçons' },
  { id: 'project', label: 'Projets' },
]

const STATUSES: (MemoryStatus | 'all')[] = [
  'all',
  'candidate',
  'verified',
  'active',
  'conflicted',
  'contradicted',
  'deprecated',
  'archived',
]

const PAGE_SIZE = 8

export function BrainPage() {
  const navigate = useNavigate()
  const [allMemories, setAllMemories] = useState<Memory[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<KnowledgeType | 'all'>('all')
  const [dept, setDept] = useState('all')
  const [status, setStatus] = useState<MemoryStatus | 'all'>('all')
  const [confidenceMin, setConfidenceMin] = useState('all')
  const [page, setPage] = useState(1)

  // Company Brain réel — aucune donnée si le backend ne répond pas.
  useEffect(() => {
    api.memories().then((real) => {
      if (real === null) {
        setError('Impossible de charger les connaissances — backend indisponible.')
        setAllMemories([])
        return
      }
      setAllMemories(real)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (allMemories ?? []).filter((m) => {
      if (type !== 'all' && m.type !== type) return false
      if (dept !== 'all' && m.scope !== dept) return false
      if (status !== 'all' && m.status !== status) return false
      if (confidenceMin !== 'all' && m.confidence < Number(confidenceMin)) return false
      if (q && !`${m.title} ${m.content} ${m.ownerName}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [allMemories, query, type, dept, status, confidenceMin])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const current = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Départements réels dérivés des portées des mémoires chargées.
  const DEPARTMENTS = useMemo(() => [...new Set((allMemories ?? []).map((m) => m.scope).filter(Boolean))], [allMemories])
  const deptItems = [{ id: 'all', label: 'Tous les départements' }, ...DEPARTMENTS.map((d) => ({ id: d, label: d }))]
  const statusItems = STATUSES.map((s) => ({
    id: s,
    label: s === 'all' ? 'Tous les statuts' : memoryStatusMeta(s as MemoryStatus).label,
  }))
  const confidenceItems = [
    { id: 'all', label: 'Toute confiance' },
    { id: '85', label: '≥ 85 %' },
    { id: '65', label: '≥ 65 %' },
    { id: '50', label: '≥ 50 %' },
  ]
  const deptCurrent = deptItems.find((i) => i.id === dept)
  const statusCurrent = statusItems.find((i) => i.id === status)
  const confidenceCurrent = confidenceItems.find((i) => i.id === confidenceMin)

  return (
    <div>
      <PageHeader
        title="Company Brain"
        subtitle="Explorez ce que votre organisation sait."
        actions={<Button onClick={() => navigate('/sources/new')}>Ajouter une source</Button>}
      />

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      {/* Primary type filters */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map((f) => {
          const Icon = f.id === 'all' ? null : KNOWLEDGE_TYPE_ICONS[f.id as KnowledgeType]
          const isActive = type === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setType(f.id)
                setPage(1)
              }}
              aria-pressed={isActive}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-body-2-medium transition-colors',
                isActive
                  ? 'border-accent-500 bg-accent-50 text-accent-700'
                  : 'border-border-button-default text-text-secondary hover:bg-background-primary-hover',
              )}
            >
              {Icon && <HugeIcon icon={Icon} size="xs" />}
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Secondary filters */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Rechercher une connaissance…"
          value={query}
          onChange={(v) => {
            setQuery(v)
            setPage(1)
          }}
          leadingIcon={adaptIcon(Search01Icon, 18)}
          aria-label="Rechercher une connaissance"
        />
        <Select
          aria-label="Département"
          selectedKey={dept}
          onSelectionChange={(k) => {
            setDept(String(k))
            setPage(1)
          }}
          items={deptItems}
          renderValue={<span className="truncate">{deptCurrent?.label}</span>}
        >
          {deptItems.map((item) => (
            <SelectItem key={item.id} id={item.id} textValue={item.label}>
              {item.label}
            </SelectItem>
          ))}
        </Select>
        <Select
          aria-label="Statut"
          selectedKey={status}
          onSelectionChange={(k) => {
            setStatus(k as MemoryStatus | 'all')
            setPage(1)
          }}
          items={statusItems}
          renderValue={<span className="truncate">{statusCurrent?.label}</span>}
        >
          {statusItems.map((item) => (
            <SelectItem key={item.id} id={item.id} textValue={item.label}>
              {item.label}
            </SelectItem>
          ))}
        </Select>
        <Select
          aria-label="Confiance minimale"
          selectedKey={confidenceMin}
          onSelectionChange={(k) => {
            setConfidenceMin(String(k))
            setPage(1)
          }}
          items={confidenceItems}
          renderValue={<span className="truncate">{confidenceCurrent?.label}</span>}
        >
          {confidenceItems.map((item) => (
            <SelectItem key={item.id} id={item.id} textValue={item.label}>
              {item.label}
            </SelectItem>
          ))}
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default shadow-card">
        <div className="grid grid-cols-[1fr_110px_170px_100px_110px] items-center gap-3 border-b border-border-table bg-background-secondary-default px-4 py-2.5 text-caption-1-semibold text-text-secondary max-md:hidden">
          <span>Connaissance</span>
          <span>Type</span>
          <span>Propriétaire</span>
          <span>Confiance</span>
          <span>Statut</span>
        </div>
        {allMemories === null ? (
          <p className="px-4 py-4 text-body-2-medium text-text-tertiary">Chargement des connaissances…</p>
        ) : current.length === 0 ? (
          <EmptyState
            title="Aucune connaissance trouvée."
            detail="Ajustez vos filtres ou importez une nouvelle source."
            action={<Button onClick={() => navigate('/sources/new')}>Importer une source</Button>}
          />
        ) : (
          current.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate(`/brain/${m.id}`)}
              className="grid w-full grid-cols-[1fr_110px_170px_100px_110px] items-center gap-3 border-b border-separator-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-background-primary-hover max-md:grid-cols-[1fr_auto]"
            >
              <span className="min-w-0">
                <span className="block truncate text-body-medium text-text-primary">{m.title}</span>
                <span className="block truncate text-caption-1-medium text-text-tertiary md:hidden">
                  {m.ownerName} · {m.confidence} % · {m.updated}
                </span>
              </span>
              <span className="max-md:hidden">
                <KnowledgeTypeBadge type={m.type} />
              </span>
              <span className="truncate text-body-2-regular text-text-secondary max-md:hidden">{m.ownerName}</span>
              <span className="text-body-2-semibold text-text-primary tabular-nums max-md:hidden">
                {m.confidence} %
              </span>
              <span className="max-md:hidden">
                <KnowledgeStatusBadge status={m.status} />
              </span>
            </button>
          ))
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination totalPages={pageCount} page={safePage} onChange={setPage} />
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Input } from '@/components/base/input/input'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon } from '@/components/ui/huge-icon'
import { StarIcon, CheckmarkCircle02Icon } from '@/lib/icons'
import { cx } from '@/utils/cx'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'

interface CatalogPiece {
  name: string
  displayName: string
  description: string
  logoUrl: string
  categories: string[]
  featured: boolean
  actions: number
  triggers: number
}

const CATEGORIES = [
  { id: 'all', label: 'Tout' },
  { id: 'featured', label: 'Recommandées' },
  { id: 'communication', label: 'Communication' },
  { id: 'email-calendar', label: 'Email & Agenda' },
  { id: 'documents', label: 'Documents' },
  { id: 'crm', label: 'CRM & Ventes' },
  { id: 'productivity', label: 'Productivité' },
  { id: 'support', label: 'Support' },
  { id: 'development', label: 'Développement' },
  { id: 'meetings', label: 'Réunions' },
]

export function IntegrationsPage() {
  const [catalog, setCatalog] = useState<CatalogPiece[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [apHealth, setApHealth] = useState<{ enabled: boolean; ok: boolean } | null>(null)
  const [connectedNames, setConnectedNames] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      api.request<{ pieces: CatalogPiece[]; count: number }>('/integrations/catalog'),
      api.request<{ enabled: boolean; ok: boolean }>('/integrations/activepieces/health'),
      api.request<{ sources: { name: string; status: string }[] }>('/sources'),
    ]).then(([cat, ap, src]) => {
      if (cat?.pieces?.length) setCatalog(cat.pieces)
      if (ap) setApHealth(ap)
      if (src?.sources) {
        // Map connected source names to catalog piece names
        const connected = new Set<string>()
        for (const s of src.sources) {
          const n = s.name.toLowerCase()
          if (n.includes('drive')) connected.add('google-drive')
          if (n.includes('gmail')) connected.add('gmail')
          if (n.includes('outlook')) connected.add('microsoft-outlook')
          if (n.includes('slack')) connected.add('slack')
          if (n.includes('notion')) connected.add('notion')
          if (n.includes('whatsapp')) connected.add('whatsapp')
        }
        setConnectedNames(connected)
      }
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const ql = query.toLowerCase()
    let list = catalog
    if (category === 'featured') list = list.filter((p) => p.featured)
    else if (category !== 'all') list = list.filter((p) => p.categories.includes(category))
    if (ql) list = list.filter((p) => p.displayName.toLowerCase().includes(ql) || p.name.includes(ql) || p.description.toLowerCase().includes(ql))
    return list
  }, [catalog, query, category])

  const featuredList = useMemo(() => catalog.filter((p) => p.featured).slice(0, 9), [catalog])
  const isConnected = (name: string) => connectedNames.has(name)

  return (
    <div>
      <PageHeader
        title="Intégrations"
        subtitle="Connectez les outils que votre entreprise utilise déjà."
        actions={
          apHealth && (
            <span className={cx('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-caption-1-medium',
              apHealth.enabled && apHealth.ok ? 'bg-status-lime-background text-status-lime-text' : 'bg-background-tertiary-default text-text-secondary')}>
              {apHealth.enabled && apHealth.ok ? 'Intégrations actives' : 'Intégrations inactives'}
            </span>
          )
        }
      />

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Rechercher parmi les intégrations…"
          value={query}
          onChange={setQuery}
          aria-label="Rechercher une intégration"
        />
      </div>

      {/* Category tabs */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={cx(
              'rounded-full border px-3 py-1.5 text-body-2-medium transition-colors',
              category === c.id
                ? 'border-accent-500 bg-accent-50 text-accent-700'
                : 'border-border-button-default text-text-secondary hover:bg-background-primary-hover',
            )}
          >
            {c.id === 'featured' && '⭐'}
            {c.label}
          </button>
        ))}
      </div>

      {/* Featured grid */}
      {category === 'all' && !query && featuredList.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-1.5 text-caption-1-semibold uppercase tracking-wide text-text-tertiary">
            <HugeIcon icon={StarIcon} size="xs" className="text-amber-400" />
            Recommandées
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {featuredList.map((p) => (
              <IntegrationCard key={p.name} piece={p} connected={isConnected(p.name)} />
            ))}
          </div>
        </section>
      )}

      {/* All integrations */}
      <section>
        {query || category !== 'all' ? (
          <>
            <h2 className="mb-3 text-caption-1-semibold uppercase tracking-wide text-text-tertiary">
              Résultats ({filtered.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => (
                <IntegrationCard key={p.name} piece={p} connected={isConnected(p.name)} />
              ))}
            </div>
            {filtered.length === 0 && !loading && (
              <Card>
                <p className="py-6 text-center text-body-2-regular text-text-tertiary">
                  Aucune intégration trouvée pour « {query} ».
                </p>
              </Card>
            )}
          </>
        ) : null}
      </section>

      {/* Count footer */}
      <p className="mt-6 text-center text-caption-1-medium text-text-tertiary">
        {catalog.length > 0
          ? `${catalog.length} applications disponibles via vos intégrations`
          : 'Activepieces non configuré — connectez vos outils via Settings > Activepieces.'}
      </p>
    </div>
  )
}

function IntegrationCard({ piece, connected }: { piece: CatalogPiece; connected: boolean }) {
  const { pushToast } = useAppStore()
  return (
    <div className={cx(
      'flex flex-col rounded-2xl border bg-background-primary-default p-4 shadow-card transition-colors',
      connected ? 'border-emerald-200' : 'border-border-button-default',
    )}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background-secondary-default text-caption-1-semibold text-text-secondary">
          {piece.displayName.slice(0, 2).toUpperCase()}
        </span>
        {connected ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-status-lime-background px-1.5 py-0.5 text-caption-2-medium text-status-lime-text">
            <HugeIcon icon={CheckmarkCircle02Icon} size="xs" />
            Connecté
          </span>
        ) : (
          <span className="rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-caption-2-medium text-text-tertiary">
            Disponible
          </span>
        )}
      </div>
      <p className="text-body-medium font-medium text-text-primary">{piece.displayName}</p>
      <p className="mt-0.5 line-clamp-2 flex-1 text-caption-1-medium text-text-secondary">{piece.description}</p>
      <div className="mt-2 flex items-center gap-2 text-caption-2-medium text-text-tertiary">
        {piece.actions > 0 && <span>{piece.actions} actions</span>}
        {piece.triggers > 0 && <span>· {piece.triggers} triggers</span>}
      </div>
      <Button
        variant={connected ? 'secondary' : 'primary'}
        size="xs"
        className="mt-3 w-full justify-center"
        onClick={() => pushToast(connected ? `${piece.displayName} — configuration ouverte.` : `${piece.displayName} : connexion via Activepieces.`)}
      >
        {connected ? 'Configurer' : 'Connecter'}
      </Button>
    </div>
  )
}

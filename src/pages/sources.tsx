import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { EmptyState } from '@/components/common/states'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  Database01Icon,
  File01Icon,
  GoogleDriveIcon,
  HardDriveIcon,
  Mail01Icon,
  MicrosoftIcon,
  NotionIcon,
  SlackIcon,
  WhatsappIcon,
  PlusSignIcon,
  RefreshIcon,
  CheckmarkCircle02Icon,
  Alert02Icon,
} from '@/lib/icons'
import { api } from '@/services/api'
import { cx } from '@/utils/cx'
import type { SourceKind } from '@/types'

const SOURCE_ICONS: Record<SourceKind, typeof File01Icon> = {
  drive: GoogleDriveIcon,
  gmail: Mail01Icon,
  m365: MicrosoftIcon,
  notion: NotionIcon,
  slack: SlackIcon,
  whatsapp: WhatsappIcon,
  local: HardDriveIcon,
  crm: Database01Icon,
  erp: File01Icon,
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  connected: { label: 'Connectée', cls: 'bg-status-lime-background text-status-lime-text' },
  disconnected: { label: 'Déconnectée', cls: 'bg-status-rose-background text-status-rose-text' },
  available: { label: 'Disponible', cls: 'bg-background-tertiary-default text-text-secondary' },
  error: { label: 'Erreur', cls: 'bg-status-yellow-background text-status-yellow-text' },
}

interface SourceRow {
  id: string
  kind: string
  name: string
  status: string
  created_at?: string
}

interface DocumentRow {
  id: string
  title: string
  mime_type: string | null
  size_bytes: number | null
  status: string
  status_detail: string | null
  uploaded_at: string
  source_name: string | null
}

export function SourcesPage() {
  const navigate = useNavigate()
  const [sources, setSources] = useState<SourceRow[] | null>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await api.sources()
    if (res === null) {
      setError('Impossible de charger les sources — backend indisponible.')
      setSources([])
      return
    }
    setSources(res.sources as unknown as SourceRow[])
    setDocuments(res.documents as unknown as DocumentRow[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <PageHeader
        title="Sources"
        subtitle="D'où vient la mémoire de votre entreprise."
        actions={
          <>
            <Button variant="secondary" leadingIcon={adaptIcon(RefreshIcon, 20)} onClick={() => void load()}>
              Rafraîchir
            </Button>
            <Button leadingIcon={adaptIcon(PlusSignIcon, 20)} onClick={() => navigate('/sources/new')}>
              Ajouter une source
            </Button>
          </>
        }
      />

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      {/* Source cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sources === null ? (
          <Card>
            <p className="text-body-2-medium text-text-tertiary">Chargement des sources…</p>
          </Card>
        ) : sources.length === 0 ? (
          <Card>
            <p className="text-body-2-medium text-text-secondary">
              Aucune source — importez un premier document ou connectez une application.
            </p>
          </Card>
        ) : (
          sources.map((s) => {
            const Icon = SOURCE_ICONS[s.kind as SourceKind] ?? HardDriveIcon
            const meta = STATUS_META[s.status] ?? STATUS_META.available
            return (
              <div
                key={s.id}
                className="flex flex-col rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-card"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <HugeIcon icon={Icon} size="md" className="text-foreground-icon-secondary" />
                  <span className={`rounded-md px-1.5 py-1 text-caption-1-medium ${meta.cls}`}>{meta.label}</span>
                </div>
                <p className="text-headline-medium text-text-primary">{s.name}</p>
                <p className="mt-0.5 flex-1 text-caption-1-medium text-text-secondary">
                  {s.kind === 'local' ? 'Import manuel' : `Connecteur ${s.kind}`}
                </p>
                <p className="mt-2 text-caption-1-medium text-text-tertiary">
                  {s.created_at ? `Créée le ${s.created_at.slice(0, 10)}` : ''}
                </p>
                <div className="mt-3">
                  <Button
                    variant="secondary"
                    size="xs"
                    className="w-full justify-center"
                    onClick={() => navigate(s.kind === 'local' ? '/sources/new' : '/integrations')}
                  >
                    {s.kind === 'local' ? 'Nouvel import' : 'Gérer le connecteur'}
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Recent ingestion */}
      <Card title="Importations récentes" className="mt-5" bodyClassName="p-0">
        {documents.length === 0 ? (
          <EmptyState title="Aucun document importé." action={<Button onClick={() => navigate('/sources/new')}>Importer un document</Button>} />
        ) : (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="grid grid-cols-[1fr_140px_150px_110px_1fr_110px] items-center gap-3 border-b border-separator-border px-4 py-3 last:border-b-0 max-lg:grid-cols-[1fr_auto]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <HugeIcon icon={File01Icon} size="sm" className="shrink-0 text-foreground-icon-tertiary" />
                <span className="min-w-0">
                  <span className="block truncate text-body-2-medium text-text-primary">{doc.title}</span>
                  <span className="block truncate text-caption-1-medium text-text-tertiary lg:hidden">
                    {doc.source_name ?? 'Import manuel'} · {doc.uploaded_at.slice(0, 10)}
                  </span>
                </span>
              </span>
              <span className="truncate text-body-2-regular text-text-secondary max-lg:hidden">
                {doc.mime_type ?? '—'}
              </span>
              <span className="truncate text-body-2-regular text-text-secondary max-lg:hidden">
                {doc.source_name ?? 'Import manuel'}
              </span>
              <span className="text-body-2-regular text-text-secondary max-lg:hidden">
                {doc.uploaded_at.slice(0, 10)}
              </span>
              <span className="truncate text-caption-1-medium text-text-tertiary max-lg:hidden">
                {doc.size_bytes != null ? `${(doc.size_bytes / 1024).toFixed(0)} Ko` : ''}
                {doc.status_detail ? ` · ${doc.status_detail}` : ''}
              </span>
              <span className="max-lg:hidden">
                <span
                  className={cx(
                    'inline-block rounded-md px-1.5 py-1 text-caption-1-medium',
                    doc.status === 'done'
                      ? 'bg-status-lime-background text-status-lime-text'
                      : doc.status === 'failed'
                        ? 'bg-status-rose-background text-status-rose-text'
                        : 'bg-status-blue-background text-status-blue-text',
                  )}
                >
                  {doc.status === 'done' ? 'Terminé' : doc.status === 'failed' ? 'Échec' : 'En cours'}
                </span>
              </span>
            </div>
          ))
        )}
        <div className="flex items-center gap-2 px-4 py-3 text-caption-1-medium text-text-tertiary">
          <HugeIcon icon={CheckmarkCircle02Icon} size="xs" />
          Chaque import déclenche lecture, extraction, déduplication et détection de contradictions.
        </div>
      </Card>

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-background-secondary-default px-4 py-3 text-caption-1-medium text-text-secondary">
        <HugeIcon icon={Alert02Icon} size="xs" className="shrink-0 text-amber-600" />
        Les connecteurs applicatifs (Drive, Gmail, CRM…) se gèrent depuis Intégrations.
      </div>
    </div>
  )
}

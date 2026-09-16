import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { EmptyState, ErrorState } from '@/components/common/states'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  Alert02Icon,
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
} from '@/lib/icons'
import { INGESTIONS, SOURCES } from '@/data/workspace'
import { api } from '@/services/api'
import { useEffect, useState } from 'react'
import type { IngestionRecord, SourceConnection } from '@/types'
import { useAppStore } from '@/store/app-store'
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

const STATUS_META: Record<
  SourceConnectionStatus,
  { label: string; cls: string }
> = {
  connected: { label: 'Connectée', cls: 'bg-status-lime-background text-status-lime-text' },
  disconnected: { label: 'Déconnectée', cls: 'bg-status-rose-background text-status-rose-text' },
  available: { label: 'Disponible', cls: 'bg-background-tertiary-default text-text-secondary' },
  error: { label: 'Erreur', cls: 'bg-status-yellow-background text-status-yellow-text' },
}

type SourceConnectionStatus = 'connected' | 'disconnected' | 'available' | 'error'

export function SourcesPage() {
  const navigate = useNavigate()
  const [srcList, setSrcList] = useState<SourceConnection[]>(SOURCES)
  const [ingestions, setIngestions] = useState<IngestionRecord[]>(INGESTIONS)
  useEffect(() => {
    api.sources().then((res) => {
      if (!res) return
      if (res.sources.length > 0) {
        setSrcList(
          res.sources.map((s) => ({
            id: String(s.id),
            kind: String(s.kind) as SourceConnection['kind'],
            name: String(s.name),
            status: String(s.status) as SourceConnection['status'],
            detail: 'Connecteur local',
            lastSync: '—',
          })),
        )
      }
      if (res.documents.length > 0) {
        setIngestions(res.documents.map((d) => ({
          id: String(d.id),
          sourceName: String(d.title),
          type: String(d.mime_type),
          ownerName: String(d.source_name ?? 'Import manuel'),
          imported: String(d.uploaded_at ?? '').slice(0, 10),
          memoriesExtracted: 0,
          status: d.status === 'done' ? 'complete' : d.status === 'failed' ? 'failed' : 'processing',
        })))
      }
    })
  }, [])
  const { pushToast } = useAppStore()

  function syncAll() {
    pushToast('Synchronisation lancée sur toutes les sources actives.')
  }

  return (
    <div>
      <PageHeader
        title="Sources"
        subtitle="D'où vient la mémoire de votre entreprise."
        actions={
          <>
            <Button variant="secondary" leadingIcon={adaptIcon(RefreshIcon, 20)} onClick={syncAll}>
              Tout synchroniser
            </Button>
            <Button leadingIcon={adaptIcon(PlusSignIcon, 20)} onClick={() => navigate('/sources/new')}>
              Ajouter une source
            </Button>
          </>
        }
      />

      {/* Sync error banner (Google Drive demo state) */}
      <div className="mb-4">
        <ErrorState
          title="La synchronisation Google Drive a échoué."
          detail="Le jeton d'accès a expiré. Nouvelle tentative programmée dans 15 minutes."
          actions={
            <>
              <Button size="xs" variant="secondary" leadingIcon={adaptIcon(RefreshIcon, 16)} onClick={() => pushToast('Nouvelle tentative lancée…')}>
                Réessayer
              </Button>
              <Button size="xs" variant="ghost" onClick={() => pushToast('Détails techniques affichés dans le journal.', 'info')}>
                Voir les détails
              </Button>
            </>
          }
        />
      </div>

      {/* Source cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {srcList.map((s) => {
          const Icon = SOURCE_ICONS[s.kind]
          const meta = STATUS_META[s.status]
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
              <p className="mt-0.5 flex-1 text-caption-1-medium text-text-secondary">{s.detail}</p>
              <p className="mt-2 text-caption-1-medium text-text-tertiary">
                {s.files ? `${s.files} fichiers · ` : ''}
                {s.lastSync !== '—' ? `Sync ${s.lastSync}` : 'Jamais synchronisée'}
              </p>
              <div className="mt-3">
                <Button
                  variant={s.status === 'connected' ? 'secondary' : 'primary'}
                  size="xs"
                  className="w-full justify-center"
                  onClick={() =>
                    s.status === 'connected'
                      ? pushToast(`${s.name} resynchronisée.`)
                      : navigate('/sources/new')
                  }
                >
                  {s.status === 'connected' ? 'Gérer' : s.status === 'error' ? 'Reconnecter' : 'Connecter'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent ingestion */}
      <Card title="Importations récentes" className="mt-5" bodyClassName="p-0">
        <div className="grid grid-cols-[1fr_140px_150px_110px_120px_110px] items-center gap-3 border-b border-border-table bg-background-secondary-default px-4 py-2.5 text-caption-1-semibold text-text-secondary max-lg:hidden">
          <span>Source</span>
          <span>Type</span>
          <span>Propriétaire</span>
          <span>Importé</span>
          <span>Mémoires extraites</span>
          <span>Statut</span>
        </div>
        {ingestions.length === 0 ? (
          <EmptyState title="Aucune source connectée." action={<Button onClick={() => navigate('/sources/new')}>Connecter une source</Button>} />
        ) : (
          ingestions.map((ing) => (
            <div
              key={ing.id}
              className="grid grid-cols-[1fr_140px_150px_110px_120px_110px] items-center gap-3 border-b border-separator-border px-4 py-3 last:border-b-0 max-lg:grid-cols-[1fr_auto]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <HugeIcon icon={File01Icon} size="sm" className="shrink-0 text-foreground-icon-tertiary" />
                <span className="min-w-0">
                  <span className="block truncate text-body-2-medium text-text-primary">{ing.sourceName}</span>
                  <span className="block truncate text-caption-1-medium text-text-tertiary lg:hidden">
                    {ing.type} · {ing.ownerName} · {ing.imported}
                  </span>
                </span>
              </span>
              <span className="text-body-2-regular text-text-secondary max-lg:hidden">{ing.type}</span>
              <span className="text-body-2-regular text-text-secondary max-lg:hidden">{ing.ownerName}</span>
              <span className="text-body-2-regular text-text-secondary max-lg:hidden">{ing.imported}</span>
              <span className="text-body-2-medium text-text-primary tabular-nums max-lg:hidden">
                {ing.memoriesExtracted > 0 ? `${ing.memoriesExtracted} candidates` : '—'}
              </span>
              <span className="max-lg:hidden">
                <span
                  className={cx(
                    'inline-block rounded-md px-1.5 py-1 text-caption-1-medium',
                    ing.status === 'complete'
                      ? 'bg-status-lime-background text-status-lime-text'
                      : ing.status === 'partial'
                        ? 'bg-status-yellow-background text-status-yellow-text'
                        : ing.status === 'failed'
                          ? 'bg-status-rose-background text-status-rose-text'
                          : 'bg-status-blue-background text-status-blue-text',
                  )}
                >
                  {ing.status === 'complete'
                    ? 'Terminé'
                    : ing.status === 'partial'
                      ? 'Partiel'
                      : ing.status === 'failed'
                        ? 'Échec'
                        : 'En cours'}
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
        Les sources WhatsApp Business et ERP seront disponibles prochainement.
      </div>
    </div>
  )
}

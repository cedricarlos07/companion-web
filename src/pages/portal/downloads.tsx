import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { useAppStore } from '@/store/app-store'
import { portalGet, type PortalMe, type PortalRelease, type PortalSession } from '@/services/portal'

interface PortalContext {
  me: PortalMe
  session: PortalSession
}

/** Portail client — téléchargements : versions publiées par KamaLoka. */
export function PortalDownloadsPage() {
  const { session } = useOutletContext<PortalContext>()
  const { pushToast } = useAppStore()
  const [releases, setReleases] = useState<PortalRelease[] | null>(null)

  useEffect(() => {
    portalGet<{ releases: PortalRelease[] }>(session, '/portal/api/releases').then((r) => {
      setReleases(r?.releases ?? [])
    })
  }, [session])

  if (releases === null) {
    return (
      <div className="space-y-4">
        <PageHeader title="Téléchargements" subtitle="Packages signés — réservés aux instances sous licence valide." />
        <Card><p className="text-body-2-medium text-text-tertiary">Chargement des versions…</p></Card>
      </div>
    )
  }

  if (releases.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Téléchargements" subtitle="Packages signés — réservés aux instances sous licence valide." />
        <Card>
          <p className="text-body-2-medium text-text-secondary">
            Aucune version publiée pour le moment — votre contact KamaLoka fournit les packages.
          </p>
        </Card>
      </div>
    )
  }

  const [current, ...older] = releases

  function download(release: PortalRelease) {
    if (release.url) {
      window.open(release.url, '_blank', 'noopener')
      pushToast(`Companion ${release.version} — téléchargement démarré.`, 'success')
    } else {
      pushToast('Package distribué par votre contact KamaLoka — aucun lien de téléchargement configuré.', 'info')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Téléchargements"
        subtitle="Packages signés (SHA256 + signature KamaLoka) — réservés aux instances sous licence valide."
      />

      <Card title={`Companion v${current.version}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Chip variant="subtle" color="lime">{current.channel}</Chip>
          <span className="text-caption-1-medium text-text-tertiary">
            publiée le {new Date(current.date).toLocaleDateString('fr-FR')}
          </span>
        </div>
        <ul className="mt-3 space-y-1">
          {current.notes.map((note) => (
            <li key={note} className="text-body-2-medium text-text-secondary">· {note}</li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="small" onClick={() => download(current)}>
            Télécharger Companion
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => pushToast('Procédure d\u2019installation fournie avec le package — voir la documentation.', 'info')}
          >
            Installer avec install.sh
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => pushToast('Stack Docker (PostgreSQL, Redis, Activepieces) fournie avec le package.', 'info')}
          >
            Docker Compose
          </Button>
        </div>
      </Card>

      {older.length > 0 && (
        <Card title="Versions précédentes">
          <ul className="space-y-3">
            {older.map((release) => (
              <li key={release.version} className="flex flex-wrap items-center justify-between gap-2 border-b border-separator-border pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-body-medium text-text-primary">
                    v{release.version}{' '}
                    <span className="text-caption-1-medium text-text-tertiary">
                      · {release.channel} · {new Date(release.date).toLocaleDateString('fr-FR')}
                    </span>
                  </p>
                  <p className="mt-0.5 text-caption-1-medium text-text-tertiary">
                    {release.notes.join(' · ')}
                  </p>
                </div>
                <Button variant="secondary" size="xs" onClick={() => download(release)}>
                  Télécharger
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

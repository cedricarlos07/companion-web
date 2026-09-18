import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { useAppStore } from '@/store/app-store'
import { PORTAL_RELEASES } from '@/data/portal'

/** Portail client — téléchargements : packages signés, réservés aux clients. */
export function PortalDownloadsPage() {
  const { pushToast } = useAppStore()
  const [current, ...older] = PORTAL_RELEASES

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
          <Button
            size="small"
            onClick={() => pushToast(`companion-${current.version}.tar.gz — téléchargement démarré.`, 'success')}
          >
            Télécharger Companion
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => pushToast('install.sh copié — curl -fsSL https://get.companion.kamaloka.ai | bash', 'info')}
          >
            Installer avec install.sh
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => pushToast('docker-compose.yml téléchargé (pglite, Mem0, Activepieces).', 'success')}
          >
            Docker Compose
          </Button>
          <Button variant="ghost" size="small" onClick={() => pushToast('SHA256 + signature KamaLoka copiés.', 'info')}>
            Checksums
          </Button>
          <Button variant="ghost" size="small" onClick={() => pushToast('Notes de version v' + current.version + ' ouvertes.', 'info')}>
            Notes de version
          </Button>
        </div>
      </Card>

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
              <Button
                variant="secondary"
                size="xs"
                onClick={() => pushToast(`companion-${release.version}.tar.gz — téléchargement démarré.`, 'success')}
              >
                Télécharger
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

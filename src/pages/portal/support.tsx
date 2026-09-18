import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Button } from '@/components/base/buttons/button'
import { useAppStore } from '@/store/app-store'
import { adaptIcon } from '@/components/ui/huge-icon'
import { BookIcon, RefreshIcon, Message01Icon } from '@/lib/icons'
import { PORTAL_INSTANCES, INSTALLED_VERSION } from '@/data/portal'

/** Portail client — support : ticket, documentation, diagnostic technique. */
export function PortalSupportPage() {
  const { pushToast } = useAppStore()
  const instance = PORTAL_INSTANCES[0]

  const diagnostics = [
    ['Version Companion', INSTALLED_VERSION],
    ['Instance', instance.id],
    ['Base de données', 'OK'],
    ['Redis / files', 'OK'],
    ['Moteur mémoire (Mem0)', 'OK'],
    ['Activepieces', 'OK'],
  ] as const

  return (
    <div className="space-y-4">
      <PageHeader
        title="Support"
        subtitle="Une équipe, un canal — sans jamais joindre vos documents internes."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Ouvrir un ticket">
          <p className="text-body-2-medium text-text-secondary">
            Décrivez votre problème : l'équipe Companion vous répond sous 1 jour ouvré (SLA
            étendu pour Enterprise).
          </p>
          <div className="mt-3">
            <Button size="small" onClick={() => pushToast('Ticket ouvert — référence SUP-2026-0114.', 'success')}>
              Ouvrir un ticket
            </Button>
          </div>
        </Card>

        <Card title="Diagnostic automatique">
          <p className="text-body-2-medium text-text-secondary">
            Joint à votre ticket — uniquement des indicateurs techniques :
          </p>
          <dl className="mt-2 space-y-1">
            {diagnostics.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="text-caption-1-medium text-text-tertiary">{label}</dt>
                <dd className="text-body-2-medium text-text-primary tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-caption-1-medium text-text-tertiary">
            Vos documents, mémoires et conversations ne sont jamais inclus.
          </p>
        </Card>

        <Card title="Documentation">
          <p className="text-body-2-medium text-text-secondary">
            Installation, mises à jour, sauvegardes, intégrations et bonnes pratiques.
          </p>
          <div className="mt-3">
            <Button variant="secondary" size="small" leadingIcon={adaptIcon(BookIcon, 20)} onClick={() => pushToast('Documentation Companion — docs.companion.kamaloka.ai', 'info')}>
              Ouvrir la documentation
            </Button>
          </div>
        </Card>

        <Card title="Contacter KamaLoka">
          <p className="text-body-2-medium text-text-secondary">
            Abidjan · support@kamaloka.ai — pour toute question commerciale ou technique.
          </p>
          <div className="mt-3">
            <Button
              variant="secondary"
              size="small"
              leadingIcon={adaptIcon(Message01Icon, 20)}
              onClick={() => pushToast('Un agent KamaLoka va vous répondre sur votre canal habituel.', 'info')}
            >
              Nous écrire
            </Button>
          </div>
        </Card>
      </div>

      <Card title="Auto-diagnostic">
        <p className="text-body-2-medium text-text-secondary">
          Relancer un contrôle complet de votre instance (santé des services, connexions,
          derniers heartbeats) sans ouvrir de ticket.
        </p>
        <div className="mt-3">
          <Button
            variant="ghost"
            size="small"
            leadingIcon={adaptIcon(RefreshIcon, 20)}
            onClick={() => pushToast('Diagnostic relancé — tous les services répondent normalement.', 'success')}
          >
            Relancer un diagnostic
          </Button>
        </div>
      </Card>
    </div>
  )
}

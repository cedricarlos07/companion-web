import { useOutletContext } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Button } from '@/components/base/buttons/button'
import { useAppStore } from '@/store/app-store'
import { adaptIcon } from '@/components/ui/huge-icon'
import { BookIcon, Message01Icon } from '@/lib/icons'
import type { PortalMe } from '@/services/portal'

/** Portail client — support : ticket, documentation, diagnostic réel. */
export function PortalSupportPage() {
  const { pushToast } = useAppStore()
  const me = useOutletContext<{ me: PortalMe }>().me
  const instance = me.instances[0]

  const diagnostics: [string, string][] = instance
    ? [
        ['Version Companion', instance.version ?? '—'],
        ['Instance', instance.instanceId],
        ['Dernier contact (heartbeat)', instance.lastSeen ? new Date(instance.lastSeen).toLocaleString('fr-FR') : '—'],
        ['Mode remonté', instance.lastMode ?? '—'],
      ]
    : [['Instance', 'aucune instance activée sur cette licence']]

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
            <Button
              size="small"
              onClick={() => {
                window.location.href =
                  'mailto:support@kamaloka.ai?subject=' +
                  encodeURIComponent(`Support Companion — ${me.customer} (${me.licenseId})`)
              }}
            >
              Ouvrir un ticket
            </Button>
          </div>
        </Card>

        <Card title="Diagnostic de votre instance">
          <p className="text-body-2-medium text-text-secondary">
            Indicateurs techniques remontés par le heartbeat de votre instance :
          </p>
          <dl className="mt-2 space-y-1">
            {diagnostics.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="text-caption-1-medium text-text-tertiary">{label}</dt>
                <dd className="max-w-[55%] truncate text-body-2-medium text-text-primary tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-caption-1-medium text-text-tertiary">
            Vos documents, mémoires et conversations ne sont jamais inclus.
          </p>
        </Card>

        <Card title="Documentation">
          <p className="text-body-2-medium text-text-secondary">
            Installation, mises à jour, sauvegardes, intégrations et bonnes pratiques — fournie
            avec votre package Companion.
          </p>
          <div className="mt-3">
            <Button
              variant="secondary"
              size="small"
              leadingIcon={adaptIcon(BookIcon, 20)}
              onClick={() => pushToast('Documentation incluse dans le package (répertoire docs/) — et support@kamaloka.ai pour toute question.', 'info')}
            >
              Documentation
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
              onClick={() => { window.location.href = 'mailto:support@kamaloka.ai' }}
            >
              Nous écrire
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

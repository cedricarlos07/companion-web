import { useOutletContext } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { useAppStore } from '@/store/app-store'
import { portalGet, type PortalMe, type PortalSession } from '@/services/portal'

interface PortalContext {
  me: PortalMe
  session: PortalSession
}

/** Portail client — licence : plan, limites, fichier .lic, renouvellement. */
export function PortalLicensePage() {
  const { me, session } = useOutletContext<PortalContext>()
  const { pushToast } = useAppStore()

  const limits: [string, number][] = [
    ['Utilisateurs', Number(me.entitlements.users ?? 0)],
    ['Agents', Number(me.entitlements.agents ?? 0)],
    ['Intégrations', Number(me.entitlements.integrations ?? 0)],
    ['Instances autorisées', me.maxInstances],
  ]

  async function downloadLicense() {
    const res = await portalGet<{ licenseFile: string; expiresAt: string | null }>(session, '/portal/api/license-file')
    if (!res?.licenseFile) {
      pushToast('Fichier de licence indisponible — contactez KamaLoka.', 'error')
      return
    }
    const blob = new Blob([res.licenseFile], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `companion-${me.licenseId}.lic`
    a.click()
    URL.revokeObjectURL(url)
    pushToast(`${a.download} téléchargé — importez-le dans Companion → Facturation.`, 'success')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Licence" subtitle="Votre droit d'usage de Companion, signé par KamaLoka." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Companion ${me.plan.charAt(0).toUpperCase()}${me.plan.slice(1)}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Chip variant="subtle" color={me.licenseStatus === 'active' ? 'lime' : 'yellow'}>
              {me.licenseStatus === 'active' ? 'Active' : me.licenseStatus}
            </Chip>
            <span className="text-caption-1-medium text-text-tertiary tabular-nums">
              {me.licenseId}
            </span>
          </div>
          <dl className="mt-3 space-y-1.5">
            {limits.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="text-body-2-medium text-text-secondary">{label}</dt>
                <dd className="text-body-2-semibold text-text-primary tabular-nums">{value}</dd>
              </div>
            ))}
            {me.expiresAt && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-body-2-medium text-text-secondary">Expiration</dt>
                <dd className="text-body-2-semibold text-text-primary tabular-nums">
                  {new Date(me.expiresAt).toLocaleDateString('fr-FR')}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="small" onClick={() => void downloadLicense()}>
              Télécharger la licence
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={() => { window.location.href = 'mailto:support@kamaloka.ai?subject=Renouvellement%20licence%20Companion' }}
            >
              Renouveler
            </Button>
          </div>
        </Card>

        <Card title="Renouvellement">
          <p className="text-body-2-medium text-text-secondary">
            {me.expiresAt ? (
              <>Votre licence expire le{' '}
                {new Date(me.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.</>
            ) : (
              'Licence sans date d\u2019expiration (Enterprise hors-ligne).'
            )}
          </p>
          <p className="mt-2 text-body-2-medium text-text-secondary">
            Cycle {me.cycle} · facturation en {me.currency}.
          </p>
          <p className="mt-2 text-caption-1-medium text-text-tertiary">
            L'engagement annuel est la formule par défaut (alignée sur la licence 12 mois) ; une
            formule mensuelle plus souple existe à un tarif majoré. Un renouvellement vous est
            proposé quelques semaines avant l'échéance et le nouveau fichier de licence apparaît
            ici dès son émission.
          </p>
          <div className="mt-4">
            <Button
              variant="secondary"
              size="small"
              onClick={() => { window.location.href = 'mailto:support@kamaloka.ai?subject=Renouvellement%20licence%20Companion' }}
            >
              Demander le renouvellement
            </Button>
          </div>
        </Card>
      </div>

      <Card title="Comment ça marche">
        <p className="text-body-2-medium text-text-secondary">
          Le fichier <span className="text-body-semibold text-text-primary">.lic</span> est signé par
          KamaLoka (Ed25519) et vérifié localement par votre instance. En offre standard, un lease
          renouvelé automatiquement confirme la licence tous les 7 jours ; en Enterprise
          hors-ligne, la licence longue durée fait foi sans aucune connexion.
        </p>
        <p className="mt-2 text-caption-1-medium text-text-tertiary">
          Changement de plan : le nouveau fichier de licence remplace l'ancien ici, et vos limites
          sont ajustées automatiquement.
        </p>
      </Card>
    </div>
  )
}

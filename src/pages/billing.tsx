import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { ProgressRow } from '@/components/common/progress'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'

interface UsageReport {
  period: string
  plan: string
  categories: { key: string; label: string; amountFcf: number; included: boolean; detail?: string }[]
  totalFcf: number
  byok: boolean
  limits: {
    users: { current: number; max: number }
    agents: { current: number; max: number }
    integrations: { current: number; max: number }
    mcpClients: { current: number; max: number }
    storageGb: { current: number; max: number }
  }
}

interface LicenseInfo {
  valid: boolean
  status: 'active' | 'expired' | 'invalid' | 'not_configured'
  payload?: { plan?: string; expiresAt?: string | null }
  error?: string
}

const STATUS_LABEL: Record<LicenseInfo['status'], string> = {
  active: 'Actif',
  expired: 'Expiré',
  invalid: 'Invalide',
  not_configured: 'Essai',
}

const PLAN_LABEL: Record<string, string> = {
  pilot: 'Pilot',
  business: 'Business',
  enterprise: 'Enterprise',
}

function pct(current: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.round((current / max) * 100))
}

function toneFor(value: number): 'default' | 'warning' | 'critical' {
  if (value >= 90) return 'critical'
  if (value >= 70) return 'warning'
  return 'default'
}

export function BillingPage() {
  const { pushToast } = useAppStore()
  const [usage, setUsage] = useState<UsageReport | null>(null)
  const [license, setLicense] = useState<LicenseInfo | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      api.request<{ usage: UsageReport }>('/billing/usage'),
      api.request<LicenseInfo>('/license'),
    ]).then(([u, l]) => {
      if (!alive) return
      if (u?.usage) setUsage(u.usage)
      if (l) setLicense(l)
    })
    return () => {
      alive = false
    }
  }, [])

  const planKey = license?.payload?.plan ?? usage?.plan ?? 'pilot'
  const planLabel = PLAN_LABEL[planKey] ?? planKey
  const statusLabel = STATUS_LABEL[license?.status ?? 'not_configured']
  const expiresAt = license?.payload?.expiresAt

  return (
    <div className="space-y-4">
      <PageHeader title="Facturation" subtitle="Plan, usage et consommation de l'instance" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Plan actuel */}
        <Card title="Plan actuel">
          <div className="flex items-center gap-2">
            <span className="text-title-2-semibold text-text-primary">{planLabel}</span>
            <Chip variant="subtle" color={license && !license.valid ? 'rose' : 'lime'}>
              {statusLabel}
            </Chip>
          </div>
          {expiresAt && (
            <p className="mt-1 text-body-2-medium text-text-secondary">
              Renouvellement le {new Date(expiresAt).toLocaleDateString('fr-FR')}
            </p>
          )}
          {license && !license.valid && license.error && (
            <p className="mt-1 text-body-2-medium text-text-error-primary">{license.error}</p>
          )}
          <p className="mt-3 text-caption-1-medium text-text-tertiary">
            Licence auto-hébergée signée · vérification hors-ligne · clé installée via Paramètres → Avancé.
          </p>
          <div className="mt-3">
            <Button
              variant="secondary"
              size="small"
              onClick={() => pushToast('Contactez votre interlocuteur KamaLoka pour changer de plan.', 'info')}
            >
              Changer de plan
            </Button>
          </div>
        </Card>

        {/* Mode de facturation IA */}
        <Card title="Consommation IA">
          <div className="rounded-xl border border-separator-border bg-background-secondary-default p-3">
            <p className="text-body-2-medium text-text-primary">
              Mode BYOK — vos clés API, facturées directement par vos fournisseurs.
            </p>
            <p className="mt-1 text-caption-1-medium text-text-tertiary">
              Companion n'ajoute aucune marge sur la consommation IA. Le passage en Managed AI
              (enveloppe facturée par KamaLoka) se fait à la commande.
            </p>
          </div>
          {usage && usage.categories.length > 0 && (
            <dl className="mt-3 space-y-1.5">
              {usage.categories.map((c) => (
                <div key={c.key} className="flex items-baseline justify-between gap-3">
                  <dt className="text-body-2-medium text-text-secondary">
                    {c.label}
                    {c.detail && <span className="text-caption-1-medium text-text-tertiary"> · {c.detail}</span>}
                  </dt>
                  <dd className="text-body-2-semibold text-text-primary tabular-nums">
                    {c.included ? 'Inclus' : `${c.amountFcf.toLocaleString('fr-FR')} F (estimé)`}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-3 text-caption-1-medium text-text-tertiary">
            Estimation indicative basée sur l'usage de la période en cours ({usage?.period ?? '—'}).
          </p>
        </Card>
      </div>

      {/* Usage vs limites du plan */}
      <Card title="Utilisation vs limites du plan">
        {usage ? (
          <div className="space-y-3">
            <ProgressRow
              label={`Utilisateurs · ${usage.limits.users.current}/${usage.limits.users.max}`}
              value={pct(usage.limits.users.current, usage.limits.users.max)}
              tone={toneFor(pct(usage.limits.users.current, usage.limits.users.max))}
            />
            <ProgressRow
              label={`Agents actifs · ${usage.limits.agents.current}/${usage.limits.agents.max}`}
              value={pct(usage.limits.agents.current, usage.limits.agents.max)}
              tone={toneFor(pct(usage.limits.agents.current, usage.limits.agents.max))}
            />
            <ProgressRow
              label={`Intégrations connectées · ${usage.limits.integrations.current}/${usage.limits.integrations.max}`}
              value={pct(usage.limits.integrations.current, usage.limits.integrations.max)}
              tone={toneFor(pct(usage.limits.integrations.current, usage.limits.integrations.max))}
            />
            <ProgressRow
              label={`Clients MCP · ${usage.limits.mcpClients.current}/${usage.limits.mcpClients.max}`}
              value={pct(usage.limits.mcpClients.current, usage.limits.mcpClients.max)}
              tone={toneFor(pct(usage.limits.mcpClients.current, usage.limits.mcpClients.max))}
            />
            <ProgressRow
              label={`Stockage · ${usage.limits.storageGb.current}/${usage.limits.storageGb.max} Go`}
              value={pct(usage.limits.storageGb.current, usage.limits.storageGb.max)}
              tone={toneFor(pct(usage.limits.storageGb.current, usage.limits.storageGb.max))}
            />
          </div>
        ) : (
          <p className="text-body-2-medium text-text-tertiary">Chargement de l'usage…</p>
        )}
      </Card>
    </div>
  )
}

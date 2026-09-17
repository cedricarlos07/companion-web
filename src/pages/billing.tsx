import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { ProgressRow } from '@/components/common/progress'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import { cx } from '@/utils/cx'

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
  mode?: 'active' | 'grace' | 'restricted'
  plan?: string
  licenseId?: string | null
  expiresAt?: string | null
  graceUntil?: string | null
  daysLeft?: number | null
  message?: string
  instanceId?: string
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
  const [importOpen, setImportOpen] = useState(false)
  const [licenseContent, setLicenseContent] = useState('')
  const [importing, setImporting] = useState(false)

  const loadLicense = () => {
    api.request<LicenseInfo>('/license').then((l) => {
      if (l) setLicense(l)
    })
  }

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

  async function importLicense() {
    if (!licenseContent.trim()) return
    setImporting(true)
    try {
      const res = await fetch('/api/license/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license: licenseContent.trim() }),
      })
      const data = await res.json().catch(() => null) as { error?: string; plan?: string } | null
      if (!res.ok) {
        pushToast(data?.error ?? 'Import impossible — licence refusée.', 'error')
        return
      }
      pushToast(`Licence installée — plan ${data?.plan ?? ''} activé.`)
      setImportOpen(false)
      setLicenseContent('')
      loadLicense()
    } finally {
      setImporting(false)
    }
  }

  const planKey = license?.plan ?? usage?.plan ?? 'pilot'
  const planLabel = PLAN_LABEL[planKey] ?? planKey
  const statusLabel = STATUS_LABEL[license?.status ?? 'not_configured']
  const expiresAt = license?.expiresAt
  const mode = license?.mode ?? 'active'

  return (
    <div className="space-y-4">
      <PageHeader title="Facturation" subtitle="Plan, usage et consommation de l'instance" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Plan actuel */}
        <Card title="Plan actuel">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-title-2-semibold text-text-primary">{planLabel}</span>
            <Chip
              variant="subtle"
              color={mode === 'restricted' ? 'rose' : mode === 'grace' ? 'yellow' : 'lime'}
            >
              {mode === 'restricted' ? 'Mode restreint' : mode === 'grace' ? 'Période de grâce' : statusLabel}
            </Chip>
          </div>
          {license?.message && (
            <p className={cx('mt-2 text-body-2-medium', mode === 'restricted' ? 'text-text-error-primary' : 'text-text-secondary')}>
              {license.message}
            </p>
          )}
          {expiresAt && (
            <p className="mt-1 text-body-2-medium text-text-secondary">
              Expire le {new Date(expiresAt).toLocaleDateString('fr-FR')}
              {license?.graceUntil && mode !== 'active' && (
                <> · grâce jusqu'au {new Date(license.graceUntil).toLocaleDateString('fr-FR')}</>
              )}
            </p>
          )}
          {license?.licenseId && (
            <p className="mt-1 text-caption-1-medium text-text-tertiary">Licence {license.licenseId}</p>
          )}
          {license?.instanceId && (
            <p className="mt-1 text-caption-1-medium text-text-tertiary">
              Instance <span className="tabular-nums">{license.instanceId}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="small" onClick={() => setImportOpen((o) => !o)}>
              {importOpen ? 'Annuler' : 'Importer une licence'}
            </Button>
            <Button
              variant="ghost"
              size="small"
              onClick={() => pushToast('Contactez votre interlocuteur Kamaloka pour changer de plan.', 'info')}
            >
              Changer de plan
            </Button>
          </div>
          {importOpen && (
            <div className="mt-3 space-y-2">
              <textarea
                aria-label="Contenu de la licence"
                value={licenseContent}
                onChange={(e) => setLicenseContent(e.target.value)}
                rows={5}
                placeholder="Collez ici le contenu du fichier companion-license.lic…"
                className="w-full rounded-xl border border-border-button-default bg-background-primary-default p-3 font-mono text-caption-1-medium text-text-primary outline-none focus:ring-2 focus:ring-border-focus-ring"
              />
              <Button size="small" onClick={importLicense} disabled={importing || !licenseContent.trim()}>
                {importing ? 'Vérification…' : 'Vérifier et activer'}
              </Button>
            </div>
          )}
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

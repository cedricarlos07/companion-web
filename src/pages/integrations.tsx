import { useState } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { Card, StatCard } from '@/components/common/stat-card'
import { Button } from '@/components/base/buttons/button'
import { Tabs, TabList, Tab, TabPanel } from '@/components/base/tabs/tabs'
import { HugeIcon } from '@/components/ui/huge-icon'
import {
  ApiIcon,
  BotIcon,
  ClaudeIcon,
  CloudIcon,
  CodeIcon,
  ConnectIcon,
  Database01Icon,
  File01Icon,
  GoogleDriveIcon,
  GoogleGeminiIcon,
  HardDriveIcon,
  Mail01Icon,
  NotionIcon,
  PlugIcon,
  ServerStack01Icon,
  ShieldKeyIcon,
  SlackIcon,
  SparklesIcon,
  Video01Icon,
  WhatsappIcon,
} from '@/lib/icons'
import { INTEGRATIONS, MCP_CLIENT_SERVERS, MCP_STATS, MCP_TOOLS } from '@/data/workspace'
import { useAppStore } from '@/store/app-store'
import { formatNumber } from '@/lib/format'
import { cx } from '@/utils/cx'
import type { IntegrationCategory } from '@/types'

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  communication: 'Communication',
  knowledge: 'Connaissances',
  business: 'Métier',
  ai: 'Intelligence',
  protocol: 'Protocole agent',
}

const CATEGORY_ICONS: Record<IntegrationCategory, typeof PlugIcon> = {
  communication: Mail01Icon,
  knowledge: HardDriveIcon,
  business: Database01Icon,
  ai: SparklesIcon,
  protocol: PlugIcon,
}

const ICONS: Record<string, typeof PlugIcon> = {
  Gmail: Mail01Icon,
  Outlook: Mail01Icon,
  Slack: SlackIcon,
  Teams: Video01Icon,
  'WhatsApp Business': WhatsappIcon,
  'Google Drive': GoogleDriveIcon,
  OneDrive: CloudIcon,
  Notion: NotionIcon,
  SharePoint: File01Icon,
  'Fichiers locaux': HardDriveIcon,
  CRM: Database01Icon,
  ERP: ServerStack01Icon,
  HRIS: File01Icon,
  Ollama: ServerStack01Icon,
  OpenAI: SparklesIcon,
  Anthropic: ClaudeIcon,
  Gemini: GoogleGeminiIcon,
  'OpenAI Compatible': CodeIcon,
  MCP: PlugIcon,
}

const STATUS_CLS: Record<string, string> = {
  connected: 'bg-status-lime-background text-status-lime-text',
  disconnected: 'bg-status-rose-background text-status-rose-text',
  available: 'bg-background-tertiary-default text-text-secondary',
}

const STATUS_LABEL: Record<string, string> = {
  connected: 'Connectée',
  disconnected: 'Déconnectée',
  available: 'Disponible',
}

export function IntegrationsPage() {
  const { pushToast } = useAppStore()
  const [copied, setCopied] = useState(false)

  const categories = Object.keys(CATEGORY_LABELS) as IntegrationCategory[]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Intégrations"
        subtitle="Connectez vos outils — Companion transforme leurs données en mémoire."
      />

      {categories.map((cat) => (
        <section key={cat}>
          <h2 className="mb-2.5 flex items-center gap-2 text-caption-1-semibold tracking-wide text-text-tertiary uppercase">
            <HugeIcon icon={CATEGORY_ICONS[cat]} size="xs" />
            {CATEGORY_LABELS[cat]}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {INTEGRATIONS.filter((i) => i.category === cat).map((integration) => {
              const Icon = ICONS[integration.name] ?? PlugIcon
              return (
                <div
                  key={integration.id}
                  className="flex items-start gap-3 rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-card"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background-secondary-default">
                    <HugeIcon icon={Icon} size="md" className="text-foreground-icon-secondary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-body-medium font-medium text-text-primary">{integration.name}</p>
                      <span className={cx('shrink-0 rounded-md px-1.5 py-0.5 text-caption-2-medium', STATUS_CLS[integration.status])}>
                        {STATUS_LABEL[integration.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-caption-1-medium text-text-secondary">{integration.description}</p>
                    <Button
                      variant={integration.status === 'connected' ? 'secondary' : 'primary'}
                      size="xs"
                      className="mt-2"
                      onClick={() =>
                        pushToast(
                          integration.status === 'connected'
                            ? `${integration.name} — configuration ouverte (démo).`
                            : `${integration.name} : connexion simulée (démo).`,
                          integration.status === 'connected' ? 'info' : 'success',
                        )
                      }
                    >
                      {integration.cta}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      {/* MCP section */}
      <section>
        <h2 className="mb-2.5 flex items-center gap-2 text-caption-1-semibold tracking-wide text-text-tertiary uppercase">
          <HugeIcon icon={PlugIcon} size="xs" />
          MCP — Model Context Protocol
        </h2>
        <Tabs defaultSelectedKey="server">
          <TabList aria-label="MCP">
            <Tab id="server">Companion comme serveur MCP</Tab>
            <Tab id="client">Companion comme client MCP</Tab>
          </TabList>

          <TabPanel id="server" className="pt-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <Card title="Point de terminaison">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-background-secondary-default px-3 py-2 font-mono text-body-2-medium text-text-primary">
                    https://brain.kamaloka.local/mcp
                  </code>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      navigator.clipboard?.writeText('https://brain.kamaloka.local/mcp')
                      setCopied(true)
                      pushToast('Point de terminaison copié.')
                      window.setTimeout(() => setCopied(false), 2000)
                    }}
                  >
                    {copied ? 'Copié' : 'Copier'}
                  </Button>
                </div>

                <p className="mt-4 mb-2 flex items-center gap-1.5 text-caption-1-semibold text-text-secondary">
                  <HugeIcon icon={ApiIcon} size="xs" />
                  Outils exposés
                </p>
                <ul className="space-y-2">
                  {MCP_TOOLS.map((t) => (
                    <li
                      key={t.name}
                      className="flex items-start gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5"
                    >
                      <code className="shrink-0 rounded-md bg-background-secondary-default px-2 py-1 font-mono text-caption-1-medium text-accent-700">
                        {t.name}
                      </code>
                      <span className="min-w-0 text-body-2-regular text-text-secondary">{t.description}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
                  <HugeIcon icon={ShieldKeyIcon} size="xs" />
                  Chaque session MCP est authentifiée et journalisée dans l'audit.
                </p>
              </Card>

              <div className="grid content-start gap-3">
                <StatCard label="Sessions actives" value={String(MCP_STATS.activeSessions)} icon={ConnectIcon} />
                <StatCard label="Requêtes aujourd'hui" value={formatNumber(MCP_STATS.requestsToday)} icon={ApiIcon} />
                <StatCard label="Agents autorisés" value={String(MCP_STATS.authorizedAgents)} icon={BotIcon} />
              </div>
            </div>
          </TabPanel>

          <TabPanel id="client" className="pt-4">
            <Card title="Serveurs MCP externes">
              <ul className="space-y-2">
                {MCP_CLIENT_SERVERS.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-3"
                  >
                    <HugeIcon icon={PlugIcon} size="md" className="shrink-0 text-foreground-icon-tertiary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-body-2-medium text-text-primary">{s.name}</p>
                      <p className="text-caption-1-medium text-text-tertiary">{s.detail}</p>
                    </div>
                    <span
                      className={cx(
                        'rounded-md px-1.5 py-1 text-caption-1-medium',
                        s.status === 'connected'
                          ? 'bg-status-lime-background text-status-lime-text'
                          : 'bg-status-rose-background text-status-rose-text',
                      )}
                    >
                      {s.status === 'connected' ? 'Connecté' : 'Hors ligne'}
                    </span>
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => pushToast(`${s.name} — reconnexion simulée (démo).`, 'info')}
                    >
                      {s.status === 'connected' ? 'Gérer' : 'Reconnecter'}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          </TabPanel>
        </Tabs>
      </section>
    </div>
  )
}

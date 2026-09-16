import { useState, type Key } from 'react'
import { useNavigate } from 'react-router-dom'
import { setTheme, useTheme } from '@/lib/theme'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { ProgressRow } from '@/components/common/progress'
import { PersonAvatar } from '@/components/common/person-avatar'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Select, SelectItem } from '@/components/base/select/select'
import { Tabs, TabList, Tab, TabPanel } from '@/components/base/tabs/tabs'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  BotIcon,
  CheckmarkCircle02Icon,
  CloudIcon,
  Database01Icon,
  File01Icon,
  GlobeIcon,
  KeyIcon,
  LockIcon,
  Notification01Icon,
  Settings01Icon,
  Shield01Icon,
  ShieldKeyIcon,
  SunIcon,
  ToolsIcon,
  UserGroupIcon,
  UserAdd01Icon,
  ArchiveIcon,
  CpuIcon,
  ServerStack01Icon,
  Building01Icon,
} from '@/lib/icons'
import { ORG } from '@/data/org'
import { EMPLOYEES, fullName } from '@/data/employees'
import { useAppStore } from '@/store/app-store'
import { cx } from '@/utils/cx'

const SECTIONS = [
  { id: 'general', label: 'Général', icon: Settings01Icon },
  { id: 'organization', label: 'Organisation', icon: Building01Icon },
  { id: 'members', label: 'Membres', icon: UserGroupIcon },
  { id: 'ai', label: 'Fournisseurs IA', icon: CpuIcon },
  { id: 'memory', label: 'Mémoire', icon: Database01Icon },
  { id: 'agents', label: 'Agents', icon: BotIcon },
  { id: 'security', label: 'Sécurité', icon: Shield01Icon },
  { id: 'permissions', label: 'Permissions', icon: ShieldKeyIcon },
  { id: 'storage', label: 'Stockage', icon: CloudIcon },
  { id: 'backup', label: 'Sauvegardes', icon: ArchiveIcon },
  { id: 'notifications', label: 'Notifications', icon: Notification01Icon },
  { id: 'appearance', label: 'Apparence', icon: SunIcon },
  { id: 'advanced', label: 'Avancé', icon: ToolsIcon },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export function SettingsPage() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [section, setSection] = useState<SectionId>('general')
  const themeChoice = useTheme()

  return (
    <div>
      <PageHeader title="Paramètres" subtitle={`Instance ${ORG.instance} · ${ORG.workspace}`} />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        {/* Left nav */}
        <nav aria-label="Sections des paramètres" className="lg:sticky lg:top-2 lg:self-start">
          <ul className="flex flex-wrap gap-1.5 lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSection(s.id)}
                  aria-current={section === s.id ? 'true' : undefined}
                  className={cx(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-body-2-medium transition-colors',
                    section === s.id
                      ? 'bg-background-primary-default text-text-primary shadow-card'
                      : 'text-text-secondary hover:bg-background-primary-default hover:text-text-primary',
                  )}
                >
                  <HugeIcon icon={s.icon} size="sm" className="shrink-0" />
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Section content */}
        <div className="min-w-0 space-y-4">
          {section === 'general' && (
            <Tabs defaultSelectedKey="instance">
              <TabList aria-label="Paramètres généraux">
                <Tab id="instance">Instance</Tab>
                <Tab id="profile">Profil</Tab>
              </TabList>
              <TabPanel id="instance" className="pt-4">
                <SettingsCard title="Général">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Nom de l'espace" defaultValue={ORG.workspace} />
                    <Input label="Instance" defaultValue={ORG.instance} />
                    <Selectled label="Langue de l'interface" defaultValue="Français" items={['Français', 'English']} />
                    <Selectled label="Fuseau horaire" defaultValue="Africa/Abidjan (GMT)" items={['Africa/Abidjan (GMT)', 'Europe/Paris (UTC+1)']} />
                  </div>
                  <div className="mt-4">
                    <Button onClick={() => pushToast('Modification enregistrée.')}>Enregistrer</Button>
                  </div>
                </SettingsCard>
              </TabPanel>
              <TabPanel id="profile" className="pt-4">
                <SettingsCard title="Votre profil">
                  <div className="flex items-center gap-4">
                    <PersonAvatar name={ORG.currentUser} size="lg" />
                    <div>
                      <p className="text-headline-medium text-text-primary">{ORG.currentUser}</p>
                      <p className="text-caption-1-medium text-text-secondary">{ORG.currentUserRole}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Input label="Nom complet" defaultValue={ORG.currentUser} />
                    <Input label="Email" defaultValue="ange.niamke@kamaloka.ci" />
                  </div>
                  <div className="mt-4">
                    <Button onClick={() => pushToast('Profil mis à jour.')}>Enregistrer</Button>
                  </div>
                </SettingsCard>
              </TabPanel>
            </Tabs>
          )}

          {section === 'organization' && (
            <SettingsCard title="Organisation">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Entreprise" defaultValue={ORG.workspace} />
                <Input label="Secteur" defaultValue={ORG.sector} />
                <Input label="Pays" defaultValue={ORG.country} />
                <Input label="Nombre d'employés" defaultValue={String(ORG.employees)} />
              </div>
              <p className="mt-3 text-caption-1-medium text-text-tertiary">
                Ces informations contextualisent la mémoire (terminologie, conformité locale).
              </p>
              <div className="mt-4">
                <Button onClick={() => pushToast('Modification enregistrée.')}>Enregistrer</Button>
              </div>
            </SettingsCard>
          )}

          {section === 'members' && (
            <SettingsCard title="Membres" bodyClassName="p-0">
              <div className="grid grid-cols-[1fr_140px_130px_120px_100px_90px] items-center gap-3 border-b border-border-table bg-background-secondary-default px-4 py-2.5 text-caption-1-semibold text-text-secondary max-lg:hidden">
                <span>Nom</span>
                <span>Rôle</span>
                <span>Département</span>
                <span>Accès</span>
                <span>Actif</span>
                <span>Actions</span>
              </div>
              <ul>
                {EMPLOYEES.slice(0, 6).map((e) => (
                  <li
                    key={e.id}
                    className="grid grid-cols-[1fr_140px_130px_120px_100px_90px] items-center gap-3 border-b border-separator-border px-4 py-3 last:border-b-0 max-lg:grid-cols-[1fr_auto]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <PersonAvatar name={fullName(e)} size="xs" />
                      <span className="min-w-0 truncate text-body-2-medium text-text-primary">{fullName(e)}</span>
                    </span>
                    <span className="truncate text-caption-1-medium text-text-secondary max-lg:hidden">{e.roleTitle}</span>
                    <span className="text-caption-1-medium text-text-secondary max-lg:hidden">{e.department}</span>
                    <span className="text-caption-1-medium text-text-secondary max-lg:hidden">
                      {e.companionAccess === 'full' ? 'Complet' : e.companionAccess === 'limited' ? 'Limité' : 'Aucun'}
                    </span>
                    <span className="text-caption-1-medium text-text-tertiary max-lg:hidden">{e.lastActive}</span>
                    <span className="flex gap-1.5 max-lg:hidden">
                      <Button variant="ghost" size="xs" onClick={() => pushToast('Permissions ouvertes (démo).', 'info')}>
                        Permissions
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          pushToast(`Transfert préparé pour ${fullName(e)}.`)
                          navigate(`/handovers/new/${e.id}`)
                        }}
                      >
                        Départ
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-caption-1-medium text-text-tertiary">
                  {ORG.employees} membres au total — 42 comptes actifs.
                </p>
                <Button size="xs" leadingIcon={adaptIcon(UserAdd01Icon, 16)} onClick={() => pushToast('Invitation envoyée (démo).')}>
                  Inviter
                </Button>
              </div>
            </SettingsCard>
          )}

          {section === 'ai' && <AiProvidersCard />}

          {section === 'memory' && (
            <SettingsCard title="Mémoire">
              <div className="space-y-1">
                <SettingRow
                  label="Seuil de confiance des candidates"
                  detail="En dessous de ce score, une mémoire reste candidate jusqu'à validation humaine."
                  control={
                    <SelectledSmall defaultValue="70 %" items={['50 %', '60 %', '70 %', '85 %']} ariaLabel="Seuil de confiance" />
                  }
                />
                <SettingRow
                  label="Vérification automatique"
                  detail="Confirmer les mémoires lorsqu'elles sont corroborées par plusieurs sources."
                  control={<SwitchCardInline defaultOn />}
                />
                <SettingRow
                  label="Détection des doublons"
                  detail="Fusionner les connaissances identiques détectées dans plusieurs sources."
                  control={<SwitchCardInline defaultOn />}
                />
                <SettingRow
                  label="Détection des contradictions"
                  detail="Signaler les versions contradictoires d'une même connaissance."
                  control={<SwitchCardInline defaultOn />}
                />
                <SettingRow
                  label="Vieillissement des mémoires"
                  detail="Signaler les procédures non mises à jour depuis plus de 12 mois."
                  control={<SwitchCardInline defaultOn />}
                />
                <SettingRow
                  label="Archivage des connaissances obsolètes"
                  detail="Conserver les anciennes versions pour audit, hors des réponses."
                  control={<SwitchCardInline defaultOn />}
                />
              </div>
            </SettingsCard>
          )}

          {section === 'agents' && (
            <SettingsCard title="Agents">
              <div className="space-y-1">
                <SettingRow
                  label="Budget d'exécution par agent"
                  detail="Nombre maximal d'actions par jour et par agent."
                  control={<SelectledSmall defaultValue="200 / jour" items={['50 / jour', '100 / jour', '200 / jour']} ariaLabel="Budget d'exécution" />}
                />
                <SettingRow
                  label="Validation humaine obligatoire pour les emails"
                  detail="Aucun agent ne peut envoyer un email sans approbation."
                  control={<SwitchCardInline defaultOn />}
                />
                <SettingRow
                  label="Journalisation détaillée"
                  detail="Enregistrer chaque étape de raisonnement et d'outil utilisé."
                  control={<SwitchCardInline defaultOn />}
                />
              </div>
              <div className="mt-4">
                <Button variant="secondary" size="small" onClick={() => navigate('/agents')}>
                  Gérer les agents
                </Button>
              </div>
            </SettingsCard>
          )}

          {section === 'security' && (
            <SettingsCard title="Sécurité">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: ServerStack01Icon, label: 'Hébergement', value: 'Auto-hébergé — brain.kamaloka.local', ok: true },
                  { icon: GlobeIcon, label: 'Résidence des données', value: "Côte d'Ivoire — région Abidjan", ok: true },
                  { icon: LockIcon, label: 'Chiffrement de la base', value: 'AES-256 au repos', ok: true },
                  { icon: UserGroupIcon, label: 'Utilisateurs connectés', value: '12 actuellement', ok: true },
                  { icon: Shield01Icon, label: 'Sessions actives', value: '18 sessions', ok: true },
                  { icon: ShieldKeyIcon, label: 'MFA', value: 'Obligatoire pour les administrateurs', ok: true },
                  { icon: KeyIcon, label: 'SSO', value: 'SAML — configuré', ok: true },
                  { icon: File01Icon, label: "Rétention de l'audit", value: '24 mois', ok: true },
                  { icon: BotIcon, label: 'Permissions des agents', value: 'Par agent, validées par un admin', ok: true },
                  { icon: GlobeIcon, label: 'Accès réseau externe', value: 'Désactivé — VPN uniquement', ok: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 rounded-xl border border-border-button-default p-3.5">
                    <HugeIcon icon={item.icon} size="md" className="mt-0.5 shrink-0 text-foreground-icon-tertiary" />
                    <div className="min-w-0">
                      <p className="text-caption-1-medium text-text-tertiary">{item.label}</p>
                      <p className="text-body-2-medium text-text-primary">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SettingsCard>
          )}

          {section === 'permissions' && (
            <SettingsCard title="Permissions">
              <div className="space-y-1">
                <SettingRow
                  label="Qui peut valider les mémoires"
                  detail="Managers et administrateurs uniquement."
                  control={<SelectledSmall defaultValue="Managers +" items={['Admins', 'Managers +', 'Tous']} ariaLabel="Validation des mémoires" />}
                />
                <SettingRow
                  label="Qui peut créer des agents"
                  detail="Réservé aux administrateurs."
                  control={<SelectledSmall defaultValue="Admins" items={['Admins', 'Managers +']} ariaLabel="Création d'agents" />}
                />
                <SettingRow
                  label="Qui peut voir le Knowledge Risk"
                  detail="Direction et managers."
                  control={<SelectledSmall defaultValue="Direction +" items={['Admins', 'Direction +', 'Tous']} ariaLabel="Visibilité du risque" />}
                />
              </div>
            </SettingsCard>
          )}

          {section === 'storage' && (
            <SettingsCard title="Stockage">
              <div className="space-y-3">
                <ProgressRow label="Base de connaissances" value={62} />
                <ProgressRow label="Documents sources" value={44} />
                <ProgressRow label="Index de recherche" value={28} />
                <ProgressRow label="Sauvegardes" value={71} />
              </div>
              <p className="mt-3 text-caption-1-medium text-text-tertiary">
                Volume total : 1,2 To sur 2 To alloués — disque local chiffré.
              </p>
            </SettingsCard>
          )}

          {section === 'backup' && (
            <SettingsCard title="Sauvegardes">
              <div className="space-y-1">
                <SettingRow
                  label="Sauvegarde automatique"
                  detail="Quotidienne à 02:00, conservée 30 jours."
                  control={<SwitchCardInline defaultOn />}
                />
                <SettingRow
                  label="Export chiffré hors site"
                  detail="Copie chiffrée vers un stockage externe."
                  control={<SwitchCardInline />}
                />
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" size="small" onClick={() => pushToast('Sauvegarde lancée (démo).')}>
                  Sauvegarder maintenant
                </Button>
                <Button variant="ghost" size="small" onClick={() => pushToast('Dernière sauvegarde : cette nuit, 02:00 — succès.', 'info')}>
                  Dernière sauvegarde
                </Button>
              </div>
            </SettingsCard>
          )}

          {section === 'notifications' && (
            <SettingsCard title="Notifications">
              <div className="space-y-1">
                <SettingRow label="Conflits de connaissances" detail="Email + centre de notifications." control={<SwitchCardInline defaultOn />} />
                <SettingRow label="Approbations en attente" detail="Notification immédiate." control={<SwitchCardInline defaultOn />} />
                <SettingRow label="Échecs de synchronisation" detail="Email à l'administrateur." control={<SwitchCardInline defaultOn />} />
                <SettingRow label="Résumé hebdomadaire" detail="Chaque lundi : activité et risques." control={<SwitchCardInline />} />
              </div>
            </SettingsCard>
          )}

          {section === 'appearance' && (
            <SettingsCard title="Apparence">
              <div className="grid gap-3 sm:grid-cols-2">
                <Selectled
                  label="Thème"
                  items={['Clair', 'Sombre', 'Système']}
                  selectedKey={themeChoice === 'light' ? 'Clair' : themeChoice === 'dark' ? 'Sombre' : 'Système'}
                  onSelectionChange={(k) =>
                    setTheme(k === 'Clair' ? 'light' : k === 'Sombre' ? 'dark' : 'system')
                  }
                />
                <Selectled label="Densité" defaultValue="Confortable" items={['Confortable', 'Compact']} />
              </div>
              <p className="mt-3 text-caption-1-medium text-text-tertiary">
                Clair, sombre ou synchronisé avec votre système — le vert Companion reste l'accent
                dans les deux modes.
              </p>
            </SettingsCard>
          )}

          {section === 'advanced' && (
            <SettingsCard title="Avancé">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Modèle d'embedding" defaultValue="nomic-embed-text (local)" />
                <Input label="Dimension d'embedding" defaultValue="768" />
                <Input label="URL de l'API d'inférence" defaultValue="http://localhost:11434" />
                <Input label="Seuil de similarité" defaultValue="0.82" />
              </div>
              <p className="mt-3 text-caption-1-medium text-text-tertiary">
                Réglages techniques — modifiez-les seulement avec l'appui de l'équipe informatique.
              </p>
            </SettingsCard>
          )}
        </div>
      </div>
    </div>
  )
}

function SettingsCard({
  title,
  children,
  bodyClassName,
}: {
  title: string
  children: React.ReactNode
  bodyClassName?: string
}) {
  return (
    <Card title={title} bodyClassName={bodyClassName}>
      {children}
    </Card>
  )
}

function SettingRow({
  label,
  detail,
  control,
}: {
  label: string
  detail: string
  control: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-separator-border py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-body-2-medium text-text-primary">{label}</p>
        <p className="text-caption-1-regular text-text-tertiary">{detail}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

function SwitchCardInline({ defaultOn = false }: { defaultOn?: boolean }) {
  const { pushToast } = useAppStore()
  return (
    <SimpleSwitch
      defaultOn={defaultOn}
      onChange={(v) => pushToast(v ? 'Activé.' : 'Désactivé.', v ? 'success' : 'info')}
    />
  )
}

function SimpleSwitch({ defaultOn, onChange }: { defaultOn: boolean; onChange: (v: boolean) => void }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        setOn(!on)
        onChange(!on)
      }}
      className={cx(
        'relative h-5.5 w-10 rounded-full transition-colors',
        on ? 'bg-accent-500' : 'bg-background-tertiary-default',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 size-4.5 rounded-full bg-white shadow-xs transition-[left]',
          on ? 'left-[calc(100%-1.25rem)]' : 'left-0.5',
        )}
      />
    </button>
  )
}

function AiProvidersCard() {
  const { pushToast } = useAppStore()
  const [selected, setSelected] = useState('ollama')
  const providers = [
    { id: 'ollama', name: 'Ollama', detail: 'Local — llama3.2, nomic-embed-text', icon: ServerStack01Icon, connected: true },
    { id: 'openai', name: 'OpenAI', detail: 'Non configuré', icon: CpuIcon, connected: false },
    { id: 'anthropic', name: 'Anthropic', detail: 'Non configuré', icon: CloudIcon, connected: false },
    { id: 'gemini', name: 'Gemini', detail: 'Non configuré', icon: CloudIcon, connected: false },
    { id: 'compatible', name: 'OpenAI Compatible', detail: 'Non configuré', icon: ToolsIcon, connected: false },
  ]

  return (
    <SettingsCard title="Fournisseurs d'intelligence">
      <div className="grid gap-2 sm:grid-cols-2">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p.id)}
            aria-pressed={selected === p.id}
            className={cx(
              'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
              selected === p.id
                ? 'border-accent-500 bg-accent-50/50 ring-1 ring-accent-500'
                : 'border-border-button-default hover:bg-background-primary-hover',
            )}
          >
            <HugeIcon icon={p.icon} size="md" className="mt-0.5 shrink-0 text-foreground-icon-secondary" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-body-2-medium font-medium text-text-primary">{p.name}</span>
                {p.connected ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-status-lime-background px-1.5 py-0.5 text-caption-2-medium text-status-lime-text">
                    <HugeIcon icon={CheckmarkCircle02Icon} size="xs" />
                    Connecté
                  </span>
                ) : (
                  <span className="rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-caption-2-medium text-text-tertiary">
                    Non configuré
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-caption-1-medium text-text-tertiary">{p.detail}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input label="Clé API" type="password" defaultValue="sk-••••••••••••••••••••" />
        <Input label="URL de base" defaultValue="http://localhost:11434/v1" />
        <Input label="Modèle" defaultValue="llama3.2" />
        <Input label="Modèle d'embedding" defaultValue="nomic-embed-text" />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
        <HugeIcon icon={LockIcon} size="xs" />
        Les secrets sont chiffrés et ne quittent jamais votre instance.
      </p>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => pushToast('Connexion réussie — modèle llama3.2 répond.', 'success')}>
          Tester la connexion
        </Button>
        <Button variant="secondary" onClick={() => pushToast('Configuration enregistrée.')}>
          Enregistrer
        </Button>
      </div>
    </SettingsCard>
  )
}

function Selectled({
  label,
  defaultValue,
  items,
  selectedKey,
  onSelectionChange,
}: {
  label: string
  defaultValue: string
  items: string[]
  /** Contrôlé : value + callback (sinon le select reste sur defaultValue). */
  selectedKey?: string
  onSelectionChange?: (key: string) => void
}) {
  return (
    <div>
      <p className="mb-1 text-body-2-medium text-text-primary">{label}</p>
      <Select
        aria-label={label}
        {...(selectedKey !== undefined
          ? {
              selectedKey,
              onSelectionChange: (k: Key) => onSelectionChange?.(String(k)),
            }
          : { defaultSelectedKey: defaultValue })}
        items={items.map((i) => ({ id: i, label: i }))}
        className="w-full"
        renderValue={<span className="truncate text-body-medium">{selectedKey ?? defaultValue}</span>}
      >
        {items.map((i) => (
          <SelectItem key={i} id={i} textValue={i}>
            {i}
          </SelectItem>
        ))}
      </Select>
    </div>
  )
}

function SelectledSmall({
  defaultValue,
  items,
  ariaLabel,
}: {
  defaultValue: string
  items: string[]
  ariaLabel: string
}) {
  return (
    <Select
      aria-label={ariaLabel}
      defaultSelectedKey={defaultValue}
      items={items.map((i) => ({ id: i, label: i }))}
      size="sm"
      renderValue={<span className="text-body-2-medium">{defaultValue}</span>}
    >
      {items.map((i) => (
        <SelectItem key={i} id={i} textValue={i}>
          {i}
        </SelectItem>
      ))}
    </Select>
  )
}

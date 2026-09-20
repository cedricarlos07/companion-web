import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setTheme, useTheme } from '@/lib/theme'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Select, SelectItem } from '@/components/base/select/select'
import { HugeIcon } from '@/components/ui/huge-icon'
import {
  BotIcon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
  Database01Icon,
  Building01Icon,
  WalletIcon,
  UserGroupIcon,
  CpuIcon,
  ServerStack01Icon,
  Shield01Icon,
  SunIcon,
  ArchiveIcon,
  BoltIcon,
} from '@/lib/icons'
import { api } from '@/services/api'
import type { SessionUser } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import { cx } from '@/utils/cx'

const SECTIONS = [
  { id: 'general', label: 'Général', icon: Building01Icon },
  { id: 'billing', label: 'Facturation', icon: WalletIcon },
  { id: 'members', label: 'Membres', icon: UserGroupIcon },
  { id: 'ai', label: 'Fournisseurs IA', icon: CpuIcon },
  { id: 'memory', label: 'Mémoire', icon: Database01Icon },
  { id: 'agents', label: 'Agents & triggers', icon: BotIcon },
  { id: 'security', label: 'Sécurité', icon: Shield01Icon },
  { id: 'backup', label: 'Sauvegardes', icon: ArchiveIcon },
  { id: 'appearance', label: 'Apparence', icon: SunIcon },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Employé',
  auditor: 'Auditeur',
  agent: 'Agent',
}

const INVITE_ROLES = ['employee', 'manager', 'admin', 'auditor'] as const

export function SettingsPage() {
  const navigate = useNavigate()
  const [section, setSection] = useState<SectionId>('general')
  const themeChoice = useTheme()

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configuration réelle de l'instance — chaque action est persistée et auditée." />

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        {/* Left nav */}
        <nav aria-label="Sections des paramètres" className="lg:sticky lg:top-2 lg:self-start">
          <ul className="flex flex-wrap gap-1.5 lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => (s.id === 'billing' ? navigate('/billing') : setSection(s.id))}
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
          {section === 'general' && <GeneralSection />}
          {section === 'members' && <MembersSection />}
          {section === 'ai' && <AiSection />}
          {section === 'memory' && <MemorySection />}
          {section === 'agents' && <AgentsSection />}
          {section === 'security' && <SecuritySection />}
          {section === 'backup' && <BackupSection />}
          {section === 'appearance' && (
            <Card title="Apparence">
              <Selectled
                label="Thème"
                items={['Clair', 'Sombre', 'Système']}
                selectedKey={themeChoice === 'light' ? 'Clair' : themeChoice === 'dark' ? 'Sombre' : 'Système'}
                onSelectionChange={(k) =>
                  setTheme(k === 'Clair' ? 'light' : k === 'Sombre' ? 'dark' : 'system')
                }
              />
              <p className="mt-3 text-caption-1-medium text-text-tertiary">
                Clair, sombre ou synchronisé avec votre système — le vert Companion reste l'accent
                dans les deux modes.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ Général ----------------------------------- */

function GeneralSection() {
  const { pushToast } = useAppStore()
  const [me, setMe] = useState<SessionUser | null>(null)
  const [name, setName] = useState('')
  const [sector, setSector] = useState('')
  const [country, setCountry] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.me().then((res) => {
      if (!res) {
        setError('Session introuvable — rechargez la page.')
        return
      }
      setMe(res.user)
      setName(res.user.org_name ?? '')
      setSector(res.user.sector ?? '')
      setCountry(res.user.country ?? '')
    })
  }, [])

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    const res = await api.updateOrganization({ name: name.trim(), sector, country })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    pushToast('Organisation mise à jour.', 'success')
    setMe((m) => (m ? { ...m, org_name: res.data.organization.name } : m))
  }

  return (
    <>
      {error && (
        <div role="alert" className="rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}
      <Card title="Organisation">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nom de l'entreprise" value={name} onChange={setName} />
          <Input label="Instance" value={me?.instance_url ?? '—'} onChange={() => {}} />
          <Input label="Secteur" value={sector} onChange={setSector} placeholder="ex. Services B2B" />
          <Input label="Pays" value={country} onChange={setCountry} placeholder="ex. Côte d'Ivoire" />
        </div>
        <p className="mt-3 text-caption-1-medium text-text-tertiary">
          Ces informations contextualisent la mémoire (terminologie, conformité locale). L'instance est
          fixée au provisionnement.
        </p>
        <div className="mt-4">
          <Button onClick={() => void save()} disabled={saving || name.trim().length < 2}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </Card>
      <Card title="Votre profil">
        <div className="flex items-center gap-4">
          <PersonAvatar name={me?.name ?? '—'} size="lg" />
          <div>
            <p className="text-headline-medium text-text-primary">{me?.name ?? '…'}</p>
            <p className="text-caption-1-medium text-text-secondary">
              {me ? ROLE_LABELS[me.app_role] ?? me.app_role : ''} · {me?.email ?? ''}
            </p>
          </div>
        </div>
        <p className="mt-3 text-caption-1-medium text-text-tertiary">
          Le compte et son rôle sont gérés par l'organisation — contactez un administrateur pour toute
          modification.
        </p>
      </Card>
    </>
  )
}

/* ------------------------------- Membres ---------------------------------- */

function MembersSection() {
  const { pushToast } = useAppStore()
  const [users, setUsers] = useState<NonNullable<Awaited<ReturnType<typeof api.users>>>['users'] | null>(null)
  const [invitations, setInvitations] = useState<NonNullable<Awaited<ReturnType<typeof api.invitations>>>['invitations']>([])
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>('employee')
  const [inviting, setInviting] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const [u, i] = await Promise.all([api.users(), api.invitations()])
    if (u === null) {
      setError(u === null && i === null ? 'Backend indisponible.' : 'Liste des comptes réservée aux administrateurs.')
    }
    if (u) setUsers(u.users)
    if (i) setInvitations(i.invitations)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function invite() {
    if (inviting) return
    setInviting(true)
    const res = await api.createInvitation(email.trim(), role)
    setInviting(false)
    if (!res.ok) {
      pushToast(res.error, 'error')
      return
    }
    pushToast(
      res.data.devToken
        ? `Invitation créée — lien de dev : /invitations/accept?token=${res.data.devToken.slice(0, 12)}…`
        : 'Invitation créée — email envoyé.',
      'success',
    )
    setEmail('')
    void load()
  }

  return (
    <>
      {error && (
        <div role="alert" className="rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}
      <Card title="Comptes" bodyClassName="p-0">
        <ul>
          {(users ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 border-b border-separator-border px-4 py-3 last:border-b-0">
              <PersonAvatar name={u.name} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-2-medium text-text-primary">{u.name}</p>
                <p className="truncate text-caption-1-medium text-text-tertiary">{u.email}</p>
              </div>
              <span className="rounded-md bg-background-secondary-default px-1.5 py-0.5 text-caption-1-medium text-text-secondary">
                {ROLE_LABELS[u.app_role] ?? u.app_role}
              </span>
              <span className={`text-caption-1-medium ${u.active ? 'text-status-lime-text' : 'text-text-tertiary'}`}>
                {u.active ? 'Actif' : 'Désactivé'}
              </span>
            </li>
          ))}
          {users !== null && users.length === 0 && (
            <li className="px-4 py-3 text-body-2-medium text-text-secondary">Aucun compte.</li>
          )}
        </ul>
      </Card>
      <Card title="Invitations">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <Input label="Email à inviter" value={email} onChange={setEmail} placeholder="prenom.nom@entreprise.ci" />
          </div>
          <Selectled
            label="Rôle"
            items={INVITE_ROLES.map((r) => ROLE_LABELS[r])}
            selectedKey={ROLE_LABELS[role]}
            onSelectionChange={(k) => setRole(INVITE_ROLES.find((r) => ROLE_LABELS[r] === k) ?? 'employee')}
          />
          <Button onClick={() => void invite()} disabled={inviting || !email.includes('@')}>
            {inviting ? 'Envoi…' : 'Inviter'}
          </Button>
        </div>
        <ul className="mt-4 space-y-2">
          {invitations.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-2-medium text-text-primary">{i.email}</p>
                <p className="text-caption-1-medium text-text-tertiary">
                  {ROLE_LABELS[i.role] ?? i.role} · par {i.invited_by_name ?? '—'} · expire {i.expires_at.slice(0, 10)}
                </p>
              </div>
              <span className={cx('rounded-md px-1.5 py-0.5 text-caption-1-medium',
                i.status === 'pending' ? 'bg-status-yellow-background text-status-yellow-text'
                  : i.status === 'accepted' ? 'bg-status-lime-background text-status-lime-text'
                    : 'bg-background-tertiary-default text-text-tertiary')}>
                {i.status === 'pending' ? 'En attente' : i.status === 'accepted' ? 'Acceptée' : i.status}
              </span>
            </li>
          ))}
          {invitations.length === 0 && (
            <li className="text-body-2-medium text-text-secondary">Aucune invitation en cours.</li>
          )}
        </ul>
      </Card>
    </>
  )
}

/* ---------------------------- Fournisseurs IA ----------------------------- */

type AiHealth = NonNullable<Awaited<ReturnType<typeof api.systemHealth>>>['ai']

function AiSection() {
  const { pushToast } = useAppStore()
  const [settings, setSettings] = useState<{ chatModel: string; embedModel: string; embedDim: number } | null>(null)
  const [health, setHealth] = useState<AiHealth | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadHealth = useCallback(async () => {
    const res = await api.systemHealth()
    if (res === null) {
      setError('État du moteur indisponible.')
      return
    }
    setHealth(res.ai)
    setError(null)
  }, [])

  useEffect(() => {
    api.aiSettings().then((res) => {
      if (res) setSettings(res.settings)
      else setError('Configuration IA indisponible.')
    })
    void loadHealth()
  }, [loadHealth])

  async function save() {
    if (saving || !settings) return
    setSaving(true)
    const res = await api.setAiSettings({ chatModel: settings.chatModel, embedModel: settings.embedModel })
    setSaving(false)
    if (!res.ok) {
      pushToast(res.error, 'error')
      return
    }
    setSettings(res.data.settings)
    pushToast('Modèles épinglés — enregistrés.', 'success')
    void loadHealth()
  }

  return (
    <>
      {error && (
        <div role="alert" className="rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}
      <Card title="Moteur d'inférence — Ollama local">
        <p className="mb-3 text-body-2-regular text-text-secondary">
          Les modèles sont épinglés : aucun basculement silencieux. Un modèle absent de l'instance est
          signalé comme dégradation, jamais remplacé.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Modèle de chat"
            value={settings?.chatModel ?? ''}
            onChange={(v) => setSettings((s) => (s ? { ...s, chatModel: v } : s))}
          />
          <Input
            label="Modèle d'embedding"
            value={settings?.embedModel ?? ''}
            onChange={(v) => setSettings((s) => (s ? { ...s, embedModel: v } : s))}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => void save()} disabled={saving || !settings}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Button variant="secondary" onClick={() => void loadHealth()}>
            Vérifier l'instance
          </Button>
        </div>
      </Card>
      {health && (
        <Card title="État de l'instance">
          <div className="flex items-center gap-2">
            <HugeIcon icon={health.ok ? CheckmarkCircle02Icon : CancelCircleIcon} size="sm" className={health.ok ? 'text-status-lime-text' : 'text-text-error-primary'} />
            <p className="text-body-2-medium text-text-primary">
              {health.ok
                ? `OK — ${health.chatModel} + ${health.embedModel} présents (${health.availableModels.length} modèles disponibles).`
                : 'Dégradation détectée :'}
            </p>
          </div>
          {!health.ok && (
            <ul className="mt-2 space-y-1">
              {health.issues.map((issue) => (
                <li key={issue} className="text-caption-1-medium text-text-error-primary">· {issue}</li>
              ))}
            </ul>
          )}
          {settings && (
            <p className="mt-2 text-caption-1-medium text-text-tertiary">
              Dimension d'embedding : {settings.embedDim} · provider : {health.provider}
            </p>
          )}
        </Card>
      )}
    </>
  )
}

/* -------------------------------- Mémoire --------------------------------- */

function MemorySection() {
  const [health, setHealth] = useState<Awaited<ReturnType<typeof api.systemHealth>> | null>(null)

  useEffect(() => {
    api.systemHealth().then(setHealth)
  }, [])

  if (health === null) {
    return <Card><p className="text-body-2-medium text-text-tertiary">Chargement de l'état mémoire…</p></Card>
  }

  const providerOk = health.provider?.ok !== false
  return (
    <Card title="Moteur de mémoire">
      <div className="space-y-2.5">
        <p className="flex items-center gap-2 text-body-2-medium text-text-primary">
          <HugeIcon icon={providerOk ? CheckmarkCircle02Icon : CancelCircleIcon} size="sm" className={providerOk ? 'text-status-lime-text' : 'text-text-error-primary'} />
          Moteur : {health.engine} · provider : {String(health.provider?.provider ?? health.provider?.name ?? 'mem0')}
        </p>
        {!health.ai.ok && (
          <p className="text-caption-1-medium text-text-error-primary">
            Embeddings dégradés — {health.ai.issues[0] ?? 'voir Fournisseurs IA'}
          </p>
        )}
        <p className="text-caption-1-medium text-text-tertiary">
          La détection de contradictions, la fusion des doublons et le vieillissement des mémoires sont
          des comportements du moteur — toujours actifs, pas des options. Consultez Company Brain pour
          les mémoires signalées.
        </p>
      </div>
    </Card>
  )
}

/* ------------------------------ Agents & triggers ------------------------- */

function AgentsSection() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [triggers, setTriggers] = useState<NonNullable<Awaited<ReturnType<typeof api.triggers>>>['triggers'] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await api.triggers()
    if (res === null) {
      setError('Déclencheurs indisponibles.')
      return
    }
    setError(null)
    setTriggers(res.triggers)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(id: string) {
    const res = await api.toggleTrigger(id)
    if (!res.ok) {
      pushToast(res.error, 'error')
      return
    }
    setTriggers((list) => (list ? list.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)) : list))
  }

  return (
    <>
      {error && (
        <div role="alert" className="rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}
      <Card title="Déclencheurs automatiques">
        <p className="mb-3 text-body-2-regular text-text-secondary">
          Chaque déclencheur lance le workflow de l'agent concerné, dans la limite de son quota horaire.
        </p>
        <ul className="space-y-2">
          {(triggers ?? []).map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5">
              <HugeIcon icon={BoltIcon} size="sm" className={t.enabled ? 'text-accent-600' : 'text-foreground-icon-tertiary'} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-2-medium text-text-primary">{t.event_type}</p>
                <p className="text-caption-1-medium text-text-tertiary">
                  {t.skill} · agent {t.agent_key} · quota {t.rate_limit_per_hour}/h
                </p>
              </div>
              <Button variant="secondary" size="xs" onClick={() => void toggle(t.id)}>
                {t.enabled ? 'Désactiver' : 'Activer'}
              </Button>
            </li>
          ))}
          {triggers !== null && triggers.length === 0 && (
            <li className="text-body-2-medium text-text-secondary">Aucun déclencheur.</li>
          )}
        </ul>
      </Card>
      <Card title="Budgets & garde-fous">
        <p className="text-body-2-regular text-text-secondary">
          Les budgets (tokens par run, plafond quotidien) sont configurés agent par agent, et la
          validation humaine des envois est imposée par la policy layer — elle ne se désactive pas.
        </p>
        <div className="mt-4">
          <Button variant="secondary" size="small" onClick={() => navigate('/agents')}>
            Gérer les agents
          </Button>
        </div>
      </Card>
    </>
  )
}

/* -------------------------------- Sécurité -------------------------------- */

function SecuritySection() {
  const [check, setCheck] = useState<Awaited<ReturnType<typeof api.securityCheck>> | null>(null)

  useEffect(() => {
    api.securityCheck().then(setCheck)
  }, [])

  if (check === null) {
    return <Card><p className="text-body-2-medium text-text-tertiary">Vérification de sécurité réservée aux administrateurs…</p></Card>
  }

  return (
    <Card title="Vérification de l'instance">
      <div className="flex items-center gap-2">
        <HugeIcon icon={check.ok ? CheckmarkCircle02Icon : CancelCircleIcon} size="sm" className={check.ok ? 'text-status-lime-text' : 'text-text-error-primary'} />
        <p className="text-body-2-medium text-text-primary">
          {check.ok ? 'Aucun problème détecté.' : `${check.issues.length} problème(s) :`}
        </p>
      </div>
      {!check.ok && (
        <ul className="mt-2 space-y-1">
          {check.issues.map((issue) => (
            <li key={issue} className="text-caption-1-medium text-text-error-primary">· {issue}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-caption-1-medium text-text-tertiary">Dernière vérification : {new Date(check.checkedAt).toLocaleString('fr-FR')}</p>
      <div className="mt-4 rounded-xl bg-background-secondary-default p-3.5">
        <p className="text-caption-1-semibold text-text-secondary">Permissions appliquées (server-side)</p>
        <ul className="mt-1.5 space-y-1 text-caption-1-medium text-text-tertiary">
          <li>· Création d'agents & édition IA : propriétaire / admin</li>
          <li>· Statuts, runs, approbations, invitations : propriétaire / admin / manager</li>
          <li>· Restauration d'une sauvegarde : propriétaire uniquement</li>
          <li>· Les agents ne peuvent jamais élargir leurs propres permissions</li>
        </ul>
      </div>
    </Card>
  )
}

/* ------------------------------ Sauvegardes ------------------------------- */

function BackupSection() {
  const { pushToast } = useAppStore()
  const [backups, setBackups] = useState<NonNullable<Awaited<ReturnType<typeof api.backups>>>['backups'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    const res = await api.backups()
    if (res === null) {
      setError('Sauvegardes réservées aux administrateurs ou backend indisponible.')
      return
    }
    setError(null)
    setBackups(res.backups)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function run() {
    if (running) return
    setRunning(true)
    const res = await api.createBackup()
    setRunning(false)
    if (!res.ok) {
      pushToast(res.error, 'error')
      return
    }
    pushToast(`Sauvegarde créée : ${res.data.backupDir}`, 'success')
    void load()
  }

  return (
    <>
      {error && (
        <div role="alert" className="rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}
      <Card title="Sauvegardes">
        <div className="flex items-center justify-between gap-3">
          <p className="text-body-2-regular text-text-secondary">
            Sauvegarde complète (base + fichiers) — chaque création est auditée.
          </p>
          <Button onClick={() => void run()} disabled={running}>
            {running ? 'Sauvegarde…' : 'Sauvegarder maintenant'}
          </Button>
        </div>
        <ul className="mt-4 space-y-2">
          {(backups ?? []).map((b) => {
            const tables = b.manifest ? Object.values(b.manifest.tables).reduce((s, n) => s + n, 0) : 0
            return (
              <li key={b.dir} className="flex flex-wrap items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5">
                <HugeIcon icon={ServerStack01Icon} size="sm" className="text-foreground-icon-tertiary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-2-medium text-text-primary">{b.dir}</p>
                  <p className="text-caption-1-medium text-text-tertiary">
                    {b.manifest
                      ? `${new Date(b.manifest.createdAt).toLocaleString('fr-FR')} · ${tables.toLocaleString('fr-FR')} lignes · ${b.manifest.uploadsCount} fichiers`
                      : 'manifeste illisible'}
                  </p>
                </div>
              </li>
            )
          })}
          {backups !== null && backups.length === 0 && (
            <li className="text-body-2-medium text-text-secondary">Aucune sauvegarde — lancez la première.</li>
          )}
        </ul>
      </Card>
    </>
  )
}

/* --------------------------------- Communs -------------------------------- */

function Selectled({
  label,
  items,
  selectedKey,
  onSelectionChange,
}: {
  label: string
  items: string[]
  selectedKey: string
  onSelectionChange?: (key: string) => void
}) {
  return (
    <div>
      <p className="mb-1 text-body-2-medium text-text-primary">{label}</p>
      <Select
        aria-label={label}
        selectedKey={selectedKey}
        onSelectionChange={(k) => onSelectionChange?.(k == null ? '' : String(k))}
        items={items.map((i) => ({ id: i, label: i }))}
        className="w-full"
        renderValue={<span className="truncate text-body-medium">{selectedKey}</span>}
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

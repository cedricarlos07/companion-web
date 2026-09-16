import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { ProgressRow, ScoreRing } from '@/components/common/progress'
import { Tabs, TabList, Tab, TabPanel } from '@/components/base/tabs/tabs'
import { Button } from '@/components/base/buttons/button'
import { EmptyState } from '@/components/common/states'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  DownloadIcon,
  GavelIcon,
  UserAdd01Icon,
  BotIcon,
} from '@/lib/icons'
import { getHandover } from '@/data/continuity'
import { EMPLOYEES, fullName } from '@/data/employees'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'

interface RealHandover {
  id: string
  employee_name: string
  role_title: string | null
  status: string
  readiness: number
  successor_employee_id: string | null
  successor_name: string | null
  human_pack: {
    summary: string[]
    sections: { key: string; title: string; items: string[] }[]
  } | null
  machine_pack: string | null
}

interface RealGap {
  id: string
  kind: string
  question: string
  detail: string | null
  status: string
  answer_text: string | null
  produced_memory_id: string | null
}

export function HandoverDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const mockHandover = id ? getHandover(id) : undefined

  const [real, setReal] = useState<{ handover: RealHandover; gaps: RealGap[]; uniqueKnowledge: { id: string; title: string; type: string; confidence: number }[] } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mockHandover || !id) return
    setLoading(true)
    api.handover(id).then((res) => {
      setLoading(false)
      if (!res?.handover) return
      setReal({
        handover: res.handover as unknown as RealHandover,
        gaps: (res.gaps ?? []) as unknown as RealGap[],
        uniqueKnowledge: res.uniqueKnowledge ?? [],
      })
    })
  }, [id, mockHandover])

  if (!mockHandover && !real) {
    if (loading) return <EmptyState title="Chargement du transfert…" />
    return (
      <EmptyState
        title="Transfert introuvable."
        action={<Button onClick={() => navigate('/handovers')}>Retour aux transferts</Button>}
      />
    )
  }

  return (
    <div>
      {mockHandover ? (
        <MockHandoverDetail handoverId={mockHandover.id} />
      ) : real ? (
        <RealHandoverDetail
          data={real}
          onToast={pushToast}
          onNavigate={navigate}
        />
      ) : null}
    </div>
  )
}

/* --------------------------- Real handover view --------------------------- */

function RealHandoverDetail({
  data,
  onToast,
  onNavigate,
}: {
  data: { handover: RealHandover; gaps: RealGap[]; uniqueKnowledge: { id: string; title: string; type: string; confidence: number }[] }
  onToast: (m: string, t?: 'success' | 'info' | 'error') => void
  onNavigate: (path: string) => void
}) {
  const h = data.handover
  const [pack, setPack] = useState<{ summary: string[]; sections: { key: string; title: string; items: string[] }[] } | null>(h.human_pack ?? null)
  const [busy, setBusy] = useState(false)
  const openGaps = data.gaps.filter((g) => g.status === 'open')
  const yann = EMPLOYEES.find((e) => e.firstName === 'Yann')

  async function generatePack() {
    setBusy(true)
    const res = await api.generatePack(h.id)
    setBusy(false)
    if (res?.humanPack) {
      setPack(res.humanPack as { summary: string[]; sections: { key: string; title: string; items: string[] }[] })
      onToast('Handover Pack généré — prêt pour le successeur.')
    } else {
      onToast('Génération impossible (backend indisponible).', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Handover"
        subtitle={`${h.employee_name} · ${h.role_title ?? ''}`}
        breadcrumb={
          <nav className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary" aria-label="Fil d'ariane">
            <button type="button" onClick={() => onNavigate('/handovers')} className="rounded px-1 py-0.5 hover:bg-background-primary-hover hover:text-text-secondary">
              Transferts
            </button>
            <span aria-hidden>/</span>
            <span className="text-text-secondary">{h.employee_name}</span>
          </nav>
        }
        actions={
          <>
            <Button
              variant="secondary"
              leadingIcon={adaptIcon(DownloadIcon, 20)}
              onClick={() => {
                if (h.machine_pack) {
                  const blob = new Blob([h.machine_pack], { type: 'text/markdown' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `machine-context-pack-${h.id.slice(0, 8)}.md`
                  a.click()
                  URL.revokeObjectURL(url)
                  onToast('Machine Context Pack téléchargé.')
                } else {
                  onToast('Générez d\'abord le pack.', 'info')
                }
              }}
            >
              Exporter
            </Button>
            {yann && (
              <Button
                leadingIcon={adaptIcon(UserAdd01Icon, 20)}
                onClick={async () => {
                  const ok = await api.assignSuccessor(h.id, yann.id)
                  onToast(ok ? `Successeur assigné : ${fullName(yann)}.` : 'Assignation impossible (backend indisponible).', ok ? 'success' : 'error')
                }}
              >
                Assigner le successeur
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <div className="flex flex-col items-center gap-3 py-2">
            <PersonAvatar name={h.employee_name} size="lg" />
            <div className="text-center">
              <p className="text-headline-medium text-text-primary">
                {h.status === 'ready' ? 'Handover prêt' : 'Handover en cours'}
              </p>
              <p className="text-caption-1-medium text-text-secondary">{h.role_title ?? ''}</p>
            </div>
            <ScoreRing value={h.readiness} size={116} tone={h.readiness >= 90 ? 'success' : 'warning'} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card title={`Lacunes détectées (${data.gaps.length})`}>
            <ul className="space-y-2">
              {data.gaps.map((g) => (
                <li key={g.id} className="flex items-start gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5">
                  <HugeIcon
                    icon={g.status !== 'open' ? CheckmarkCircle02Icon : Alert02Icon}
                    size="sm"
                    className={g.status !== 'open' ? 'mt-0.5 shrink-0 text-emerald-500' : 'mt-0.5 shrink-0 text-amber-500'}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-2-medium text-text-primary">{g.question}</p>
                    {g.answer_text && (
                      <p className="mt-0.5 text-caption-1-regular text-text-secondary">Réponse : {g.answer_text}</p>
                    )}
                    {g.detail && !g.answer_text && (
                      <p className="text-caption-1-medium text-text-tertiary">{g.detail}</p>
                    )}
                  </div>
                  {g.status === 'open' && (
                    <Button variant="secondary" size="xs" onClick={() => onNavigate(`/handovers/${h.id}/interview`)}>
                      Interroger
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {openGaps.length > 0 && (
              <Button size="xs" className="mt-3" onClick={() => onNavigate(`/handovers/${h.id}/interview`)}>
                Poursuivre l'entretien ({openGaps.length} en attente)
              </Button>
            )}
          </Card>

          {/* Unique knowledge — what only this person holds */}
          {data.uniqueKnowledge.length > 0 && (
            <Card title={`Connaissances uniques (${data.uniqueKnowledge.length})`}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.uniqueKnowledge.slice(0, 8).map((u) => (
                  <li key={u.id} className="flex items-center gap-2.5 rounded-xl border border-border-button-default px-3.5 py-2.5">
                    <HugeIcon icon={Alert02Icon} size="xs" className="shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary">{u.title}</span>
                    <span className="text-caption-1-semibold text-text-secondary tabular-nums">{u.confidence} %</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {/* Generated pack */}
      {pack ? (
        <div className="space-y-4">
          {(pack.sections ?? []).map((s) => (
            <Card key={s.key} title={s.title}>
              <ul className="space-y-2">
                {s.items.length === 0 && <li className="text-caption-1-medium text-text-tertiary">—</li>}
                {s.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <HugeIcon icon={CheckmarkCircle02Icon} size="sm" className="mt-0.5 shrink-0 text-emerald-500" />
                    <span className="text-body-2-regular text-text-primary">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          {yann && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-body-medium text-text-primary">
                  Prochaine étape : générer l'onboarding de {fullName(yann)} à partir de ce pack.
                </p>
                <Button
                  onClick={async () => {
                    const res = await api.generateOnboarding(yann.id, h.id)
                    onToast(res ? 'Onboarding généré (J1 / J7 / J30).' : 'Génération impossible (backend indisponible).', res ? 'success' : 'error')
                    if (res) onNavigate('/onboarding')
                  }}
                >
                  Créer l'onboarding
                </Button>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-body-medium text-text-primary">Handover Pack</p>
              <p className="text-caption-1-medium text-text-secondary">
                Répondez aux questions ouvertes ({openGaps.length}) puis générez le pack : résumé,
                procédures, clients, décisions et contexte machine pour les agents.
              </p>
            </div>
            <Button onClick={generatePack} disabled={busy}>
              {busy ? 'Génération…' : 'Générer le Handover Pack'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

/* --------------------------- Mock handover view --------------------------- */

const PACK_TABS = [
  { id: 'summary', label: 'Résumé' },
  { id: 'responsibilities', label: 'Responsabilités' },
  { id: 'procedures', label: 'Procédures' },
  { id: 'clients', label: 'Clients' },
  { id: 'projects', label: 'Projets' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'tasks', label: 'Tâches récurrentes' },
  { id: 'decisions', label: 'Décisions' },
  { id: 'risks', label: 'Risques' },
]

const PACK_CONTENT: Record<string, { title: string; items: string[] }> = {
  summary: {
    title: 'Résumé du transfert',
    items: [
      'Poste : Responsable Commercial — portefeuille de 5 comptes majeurs (Orange CI, SOTRA, NSIA, CIE, Ecobank).',
      'Préparation des appels d’offres publics : dossier type, exigences fiscales, cautionnement 2 %.',
      'Forecast mensuel : collecte le 25, pondération par probabilité, revue avec la Direction Financière.',
      '4 projets actifs, dont 1 à risque (extension fibre Abidjan Sud).',
    ],
  },
  responsibilities: {
    title: 'Responsabilités',
    items: [
      'Pilotage du chiffre d’affaires commercial et du pipeline.',
      'Relation contractuelle avec les 5 comptes clés.',
      'Validation première des remises (au-delà de 15 % : escalade).',
      'Reporting mensuel au comité de direction.',
    ],
  },
  procedures: {
    title: 'Procédures transférées',
    items: [
      'Validation des dossiers Orange CI par la Direction Financière (94 %).',
      'Préparation des appels d’offres publics (90 %).',
      'Préparation du forecast commercial mensuel (91 % — nouvelle procédure issue de l’entretien).',
      'Clôture mensuelle du pipeline (79 % — à compléter).',
    ],
  },
  clients: {
    title: 'Clients et comptes clés',
    items: [
      'Orange CI — exigences de conformité, décideurs réels, cautionnement.',
      'SOTRA — engagements informels, facturation trimestrielle, trêve de fin d’année.',
      'NSIA — préférences de communication, cadence de reporting.',
      'CIE — procédure terrain des compteurs prépayés.',
      'Ecobank — conditions cadre 2026.',
    ],
  },
  projects: {
    title: 'Projets en cours',
    items: [
      'Migration ERP SOTRA — phase pilote, comité projet mensuel.',
      'Extension fibre Abidjan Sud — proposition envoyée, relance à jour (à risque).',
      'Déploiement NSIA phase 1 — piloté avec Aïcha Diarra.',
    ],
  },
  contacts: {
    title: 'Contacts clés',
    items: [
      'Orange CI — M. Traoré (direction technique réseau, point d’entrée avant 10 h).',
      'SOTRA — M. Bakayoko (engagements et arbitrages).',
      'NSIA — service achats (email formel obligatoire).',
      'Interne — Ibrahim Diallo (validation financière), Aïcha Diarra (B2B).',
    ],
  },
  tasks: {
    title: 'Tâches récurrentes',
    items: [
      'Forecast commercial : le 25 de chaque mois.',
      'Revue pipeline : chaque lundi matin.',
      'Relances clients : le vendredi.',
      'Mise à jour CRM : continue, après chaque échange client.',
    ],
  },
  decisions: {
    title: 'Contexte de décision',
    items: [
      'Facturation SOTRA au trimestre : escompte 1,5 % en contrepartie (juin 2026).',
      'Seuil de remise : toute remise > 15 % est escaladée (validation à clarifier — conflit détecté).',
      'Calendrier de renouvellement des contrats clés — à consolider avec Moussa (question 7/9).',
    ],
  },
  risks: {
    title: 'Risques résiduels',
    items: [
      '3 questions d’entretien restantes (signes d’alerte client, revue trimestrielle, tâches invisibles).',
      'Conflit sur la validation des remises — à arbitrer avant le départ.',
      '12 relations clients à propriétaire unique au-delà de ce poste.',
    ],
  },
}

function MockHandoverDetail({ handoverId }: { handoverId: string }) {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const handover = getHandover(handoverId)
  if (!handover) {
    return (
      <EmptyState
        title="Transfert introuvable."
        action={<Button onClick={() => navigate('/handovers')}>Retour aux transferts</Button>}
      />
    )
  }
  const packReadiness = 94

  return (
    <div>
      <PageHeader
        title="Handover"
        subtitle={`${handover.employeeName} · ${handover.roleTitle}`}
        actions={
          <>
            <Button variant="secondary" leadingIcon={adaptIcon(DownloadIcon, 20)} onClick={() => pushToast('Export PDF généré (démo).')}>
              Exporter PDF
            </Button>
            <Button
              leadingIcon={adaptIcon(UserAdd01Icon, 20)}
              onClick={() => {
                pushToast('Successeur assigné : Yann Kouamé.')
                navigate('/onboarding')
              }}
            >
              Assigner le successeur
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <div className="flex flex-col items-center gap-3 py-2">
            <PersonAvatar name={handover.employeeName} size="lg" />
            <div className="text-center">
              <p className="text-headline-medium text-text-primary">Handover prêt</p>
              <p className="text-caption-1-medium text-text-secondary">{handover.roleTitle}</p>
            </div>
            <ScoreRing value={packReadiness} size={116} tone="success" />
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Couverture du poste">
            <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {handover.coverage.map((c) => (
                <ProgressRow
                  key={c.label}
                  label={c.label}
                  value={c.value}
                  tone={c.value >= 90 ? 'success' : c.value >= 75 ? 'default' : 'warning'}
                  compact
                />
              ))}
            </div>
          </Card>
          <Card
            title={`Lacunes détectées (${handover.gaps.length})`}
            actions={
              <Button variant="ghost" size="xs" onClick={() => navigate(`/handovers/${handover.id}/interview`)}>
                Poursuivre l'entretien
              </Button>
            }
          >
            <ul className="space-y-2">
              {handover.gaps.map((g) => (
                <li key={g.id} className="flex items-start gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5">
                  <HugeIcon
                    icon={g.kind === 'conflict' ? Alert02Icon : GavelIcon}
                    size="sm"
                    className={g.kind === 'conflict' ? 'shrink-0 text-rose-500' : 'shrink-0 text-amber-500'}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-2-medium text-text-primary">{g.question}</p>
                    <p className="text-caption-1-medium text-text-tertiary">{g.detail}</p>
                  </div>
                  <Button variant="secondary" size="xs" onClick={() => navigate(`/handovers/${handover.id}/interview`)}>
                    {g.cta === 'interview' ? 'Interroger Moussa' : 'Résoudre'}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Tabs defaultSelectedKey="summary">
        <TabList aria-label="Sections du pack de handover">
          {PACK_TABS.map((t) => (
            <Tab key={t.id} id={t.id}>
              {t.label}
            </Tab>
          ))}
        </TabList>
        {PACK_TABS.map((t) => (
          <TabPanel key={t.id} id={t.id} className="pt-4">
            <Card title={PACK_CONTENT[t.id].title}>
              <ul className="space-y-2.5">
                {PACK_CONTENT[t.id].items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <HugeIcon icon={CheckmarkCircle02Icon} size="sm" className="mt-0.5 shrink-0 text-emerald-500" />
                    <span className="text-body-2-regular text-text-primary">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </TabPanel>
        ))}
      </Tabs>

      <div className="grid gap-3 sm:grid-cols-3">
        <ActionCard
          icon={UserAdd01Icon}
          title="Créer l'onboarding"
          detail="Générer le parcours du successeur à partir de ce handover."
          onClick={() => {
            pushToast('Onboarding généré à partir du handover et du Role Brain.')
            navigate('/onboarding/onb-yann')
          }}
        />
        <ActionCard
          icon={BotIcon}
          title="Créer le contexte agent IA"
          detail="Autoriser un agent à hériter du contexte validé du rôle."
          onClick={() => pushToast('Contexte agent IA créé (démo).')}
        />
        <ActionCard
          icon={GavelIcon}
          title="Mettre à jour le Role Brain"
          detail="Fusionner les connaissances validées dans la mémoire du rôle."
          onClick={() => {
            pushToast('Role Brain mis à jour avec les connaissances validées.')
            navigate('/roles/role-commercial')
          }}
        />
      </div>
    </div>
  )
}

function ActionCard({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: typeof GavelIcon
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-2xl border border-border-button-default bg-background-primary-default p-4 text-left shadow-card transition-colors hover:bg-background-primary-hover"
    >
      <HugeIcon icon={icon} size="md" className="mt-0.5 shrink-0 text-foreground-icon-tertiary" />
      <span className="min-w-0">
        <span className="block text-body-medium font-medium text-text-primary">{title}</span>
        <span className="block text-caption-1-medium text-text-secondary">{detail}</span>
      </span>
    </button>
  )
}

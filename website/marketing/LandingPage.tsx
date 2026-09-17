import type { ReactNode } from 'react'
import { ButtonLink } from '@/components/base/buttons/button'
import { Chip } from '@/components/base/badges/chip'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import type { IconSvgElement } from '@hugeicons/react'
import {
  AiBrain01Icon, ArrowRight02Icon, ArrowUpRightIcon, BotIcon, ChartIcon, CloudUploadIcon,
  Database01Icon, DocumentValidationIcon, FileEditIcon, Folder01Icon, GoogleDriveIcon,
  HandshakeIcon, HistoryIcon, HierarchyIcon, Key02Icon, MicrosoftIcon, NetworkIcon,
  RocketIcon, Search01Icon, ServerStack01Icon, Shield01Icon, ShieldAlertIcon, ShieldKeyIcon,
  ShieldUserIcon, SlackIcon, TimeIcon, UserCircleIcon, UserRemoveIcon, WhatsappIcon,
} from '@/lib/icons'

/* Surface marketing — companion.kamaloka.ai.
 * Design system Companion : BoardUI, tokens sémantiques, Hugeicons. Aucun emoji. */

type Icon = IconSvgElement

export function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-12 rounded-2xl' : 'size-10 rounded-xl'
  return (
    <span className={`${box} flex items-center justify-center bg-companion-300 shadow-card`}>
      <HugeIcon icon={AiBrain01Icon} size={size === 'lg' ? 'lg' : 'md'} className="text-brand-black" />
    </span>
  )
}

function Header() {
  const links: [string, string][] = [
    ['#fonctionnement', 'Fonctionnement'],
    ['#agents', 'Agents IA'],
    ['#offres', 'Offres'],
    ['/docs', 'Documentation'],
  ]
  return (
    <header className="sticky top-0 z-10 border-b border-separator-border bg-background-primary-default/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <BrandMark />
          <span className="text-headline-semibold text-text-primary">
            COMPANION <span className="text-text-tertiary">· by KamaLoka</span>
          </span>
        </a>
        <div className="ml-4 hidden items-center gap-5 lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="text-body-2-medium text-text-secondary no-underline hover:text-text-primary">
              {label}
            </a>
          ))}
        </div>
        <span className="flex-1" />
        <ButtonLink variant="secondary" size="small" href="/portal/login">Espace client</ButtonLink>
        <ButtonLink variant="primary" size="small" leadingIcon={adaptIcon(ArrowUpRightIcon, 18)} href="#demo">
          Demander une démo
        </ButtonLink>
      </nav>
    </header>
  )
}

function Section({ id, soft, children }: { id?: string; soft?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={soft ? 'bg-background-secondary-default' : undefined}>
      <div className="mx-auto max-w-6xl px-6 py-20">{children}</div>
    </section>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="mb-4 inline-flex items-center gap-1.5 text-caption-1-medium uppercase tracking-[0.14em] text-accent-600">
      {children}
    </span>
  )
}

function Card({ icon, title, children }: { icon?: Icon; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card">
      {icon && <HugeIcon icon={icon} size="lg" className="mb-3 text-foreground-icon-secondary" />}
      <h3 className="text-headline-medium text-text-primary">{title}</h3>
      <p className="mt-1.5 text-body-2-regular text-text-secondary">{children}</p>
    </div>
  )
}

function FlowStep({ icon, label }: { icon: Icon; label: string }) {
  return (
    <span className="flex items-center gap-2 rounded-xl border border-border-button-default bg-background-primary-default px-4 py-3 shadow-card">
      <HugeIcon icon={icon} size="sm" className="text-foreground-icon-secondary" />
      <span className="text-body-2-semibold text-text-primary">{label}</span>
    </span>
  )
}

function Arrow() {
  return <span aria-hidden className="text-title-2-medium text-text-tertiary">→</span>
}

const RISK_ROWS: [string, number, 'critical' | 'warning' | 'success'][] = [
  ['Dépendance personne clé', 78, 'critical'],
  ['Couverture des rôles', 62, 'warning'],
  ['Fraîcheur', 45, 'warning'],
  ['Préparation handover', 84, 'success'],
]

function RiskBar({ label, value, tone }: { label: string; value: number; tone: 'critical' | 'warning' | 'success' }) {
  const bar = tone === 'critical' ? 'bg-rose-500' : tone === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border-button-default bg-background-primary-default px-4 py-3 shadow-card">
      <span className="w-52 truncate text-body-2-medium text-text-primary">{label}</span>
      <span className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-background-tertiary-default">
        <span className={`block h-full rounded-full ${bar}`} style={{ width: `${value}%` }} />
      </span>
      <span className="w-10 text-right text-body-2-semibold text-text-primary tabular-nums">{value} %</span>
    </div>
  )
}

function AskDemo() {
  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-border-button-default bg-background-primary-default p-5 text-left shadow-card">
      <p className="flex items-center gap-2 text-body-medium font-medium text-text-primary">
        <HugeIcon icon={Search01Icon} size="sm" className="text-foreground-icon-secondary" />
        « Comment traite-t-on un rejet R03 supérieur à 500 000 FCFA ? »
      </p>
      <div className="mt-3 rounded-xl bg-background-secondary-default p-4 text-body-2-regular text-text-secondary">
        Vérifier d'abord le dossier dans le registre, puis escalader au chef de recouvrement sous 24 h avec la
        pièce de rejet jointe. Un R03 &gt; 500 000 FCFA exige une contre-vérification bancaire avant toute relance.
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip variant="caption" color="soft">SOP-042 · Recouvrement</Chip>
        <Chip variant="caption" color="soft">Cas #1287</Chip>
        <Chip variant="caption" color="lime">Validé · Direction</Chip>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-caption-1-medium text-emerald-700">
        <HugeIcon icon={DocumentValidationIcon} size="xs" />
        Réponse vérifiée — sources citées. Contexte insuffisant ? Companion s'abstient, il n'invente jamais.
      </p>
    </div>
  )
}

function Plans() {
  const rows: [string, string, string, string][] = [
    ['Objectif', 'Prouver la valeur sur vos cas réels', "Toute l'entreprise", 'Grands comptes & exigences avancées'],
    ['Utilisateurs', "jusqu'à 25", "jusqu'à 100", 'illimité'],
    ['Agents · intégrations', 'découverte', '20 agents · 15 intégrations', 'sur mesure'],
    ['SSO & branding', '—', 'option', 'inclus'],
  ]
  return (
    <div className="mt-10 overflow-hidden rounded-2xl border border-border-button-default shadow-card">
      <table className="w-full border-collapse bg-background-primary-default text-left">
        <thead>
          <tr className="bg-background-secondary-default">
            <th className="px-5 py-3.5 text-caption-1-medium text-text-tertiary">Plan</th>
            <th className="px-5 py-3.5 text-caption-1-medium text-text-tertiary">Pilot — 30 jours</th>
            <th className="px-5 py-3.5 text-caption-1-medium text-text-tertiary">Business</th>
            <th className="px-5 py-3.5 text-caption-1-medium text-text-tertiary">Enterprise</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b, c]) => (
            <tr key={label} className="border-t border-separator-border">
              <td className="px-5 py-3.5 text-body-2-medium text-text-primary">{label}</td>
              <td className="px-5 py-3.5 text-body-2-regular text-text-secondary">{a}</td>
              <td className="px-5 py-3.5 text-body-2-regular text-text-secondary">{b}</td>
              <td className="px-5 py-3.5 text-body-2-regular text-text-secondary">{c}</td>
            </tr>
          ))}
          <tr className="border-t border-separator-border">
            <td className="px-5 py-4 text-body-2-medium text-text-primary">Tarif</td>
            <td className="px-5 py-4 text-headline-medium text-text-primary">Offert</td>
            <td className="px-5 py-4 text-headline-medium text-text-primary">2 400 000 FCFA / an</td>
            <td className="px-5 py-4 text-headline-medium text-text-primary">Sur devis</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background-full font-sans text-text-primary">
      <Header />

      {/* 1 · Hero */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Chip variant="subtle" color="lime">Self-hosted · vos données restent chez vous</Chip>
          <h1 className="mt-5 text-title-1-medium tracking-tight text-text-primary" style={{ fontSize: 'clamp(40px,6vw,64px)' }}>
            Votre entreprise<br />n'oublie plus.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-headline-medium text-text-secondary">
            Capturez le savoir de vos équipes, réduisez la dépendance aux personnes clés et transmettez
            instantanément le contexte aux nouveaux collaborateurs et aux agents IA.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink variant="primary" size="medium" leadingIcon={adaptIcon(ArrowRight02Icon, 20)} href="#demo">
              Demander une démo
            </ButtonLink>
            <ButtonLink variant="secondary" size="medium" href="#demo">Commencer un pilote</ButtonLink>
          </div>
          <p className="mt-7 text-body-2-medium text-text-tertiary">
            Déjà client ? <a href="/portal/login" className="font-semibold text-accent-600 no-underline">Télécharger Companion</a>
          </p>
        </div>
      </Section>

      {/* 2 · Problème */}
      <Section soft id="probleme">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Le problème</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary" style={{ fontSize: 'clamp(26px,3.6vw,38px)' }}>
            Quand une personne clé part,<br />c'est des années de savoir qui partent avec.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">
            Les procédures vivent dans les têtes, les décisions dans WhatsApp, les contrats dans Drive,
            les échanges dans les emails. Jusqu'au jour où quelqu'un demande :
            « Pourquoi a-t-on fait ça comme ça ? »
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={UserRemoveIcon} title="Départs & turnover">Chaque départ emporte du contexte irremplaçable : gestes, exceptions, relations, historique.</Card>
          <Card icon={NetworkIcon} title="Savoir dispersé">L'information existe, mais personne ne la retrouve au moment décisif.</Card>
          <Card icon={TimeIcon} title="Onboarding lent">Des mois pour être autonome — le contexte se transmet par oral, jamais complètement.</Card>
          <Card icon={BotIcon} title="Agents IA affamés">Sans contexte fiable, vos agents improvisent. Avec Companion, ils agissent avec votre savoir.</Card>
        </div>
      </Section>

      {/* 3 · Fonctionnement */}
      <Section id="fonctionnement">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Comment fonctionne Companion</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary" style={{ fontSize: 'clamp(26px,3.6vw,38px)' }}>
            De vos sources à la transmission,<br />une seule mémoire organisée.
          </h2>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
          <FlowStep icon={Folder01Icon} label="Sources" /><Arrow />
          <FlowStep icon={Database01Icon} label="Company Brain" /><Arrow />
          <FlowStep icon={UserCircleIcon} label="Role Brain" /><Arrow />
          <FlowStep icon={ShieldAlertIcon} label="Knowledge Risk" /><Arrow />
          <FlowStep icon={HandshakeIcon} label="Handover" /><Arrow />
          <FlowStep icon={RocketIcon} label="Onboarding" />
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={Database01Icon} title="Company Brain">Procédures, décisions et faits vérifiés — chacun avec sa source et son niveau de confiance.</Card>
          <Card icon={UserCircleIcon} title="Employee Memory">Ce que chaque collaborateur sait et fait, capturé depuis ses documents et ses entretiens.</Card>
          <Card icon={HierarchyIcon} title="Role Brain">Le savoir du poste, pas de la personne : validé, structuré, prêt à transmettre.</Card>
          <Card icon={ChartIcon} title="Knowledge Risk">Un score clair du risque de perte de savoir, facteur par facteur.</Card>
        </div>
      </Section>

      {/* 4 · Ask */}
      <Section soft>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Ask Companion</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary" style={{ fontSize: 'clamp(26px,3.6vw,38px)' }}>
            La bonne réponse, avec sa source.<br />Ou rien.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">
            Chaque réponse cite son document, son propriétaire et son niveau de validation.
          </p>
        </div>
        <AskDemo />
      </Section>

      {/* 5 · Knowledge Risk */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Knowledge Risk</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary" style={{ fontSize: 'clamp(26px,3.6vw,38px)' }}>
            Mesurez ce que votre entreprise<br />risque d'oublier.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">
            Un score global et des facteurs détaillés qui pointent vers les actions concrètes.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-2xl gap-3">
          {RISK_ROWS.map(([label, value, tone]) => <RiskBar key={label} label={label} value={value} tone={tone} />)}
          <p className="mt-1 text-caption-1-medium text-text-tertiary">
            Score global : <span className="font-semibold text-text-primary">49 / 100 — modéré.</span> Chaque facteur mène aux employés, rôles et documents concernés.
          </p>
        </div>
      </Section>

      {/* 6 · Handover & Onboarding */}
      <Section soft>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Handover & Onboarding</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary" style={{ fontSize: 'clamp(26px,3.6vw,38px)' }}>
            Les départs se préparent.<br />Les arrivées deviennent rapides.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Card icon={HandshakeIcon} title="Handover assisté">
            Companion détecte ce que le partant seul sait, pose les questions manquantes à sa place, puis produit
            un dossier de transmission complet : pack humain lisible + pack machine pour vos agents.
          </Card>
          <Card icon={RocketIcon} title="Onboarding J1 / J7 / J30">
            Le nouveau reçoit un plan de montée en compétence construit depuis le Role Brain de son poste :
            ce qu'il doit savoir, lire et maîtriser — semaine par semaine.
          </Card>
        </div>
      </Section>

      {/* 7 · Agents */}
      <Section id="agents">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Agents IA avec garde-fous</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary" style={{ fontSize: 'clamp(26px,3.6vw,38px)' }}>
            Des agents qui travaillent<br />avec votre savoir — jamais en autonomie sauvage.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">
            Préparer une relance, rédiger un compte-rendu, détecter une contradiction : les agents agissent
            selon vos permissions, avec approbation humaine pour toute action sensible.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card icon={ShieldKeyIcon} title="Permissions propagées">Un agent commercial ne verra jamais un dossier RH. Les droits de chacun s'appliquent aux agents.</Card>
          <Card icon={DocumentValidationIcon} title="Approbations humaines">Envoi d'email, action externe : l'agent prépare, un humain approuve. Toute action est journalisée.</Card>
          <Card icon={FileEditIcon} title="Corrections validées">Chaque correction humaine enrichit la mémoire — jamais d'écrasement silencieux.</Card>
        </div>
      </Section>

      {/* 8 · Intégrations */}
      <Section soft>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Intégrations</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary" style={{ fontSize: 'clamp(26px,3.6vw,38px)' }}>
            Connecté à vos outils du quotidien.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">
            Google, Microsoft, WhatsApp, Odoo, Slack, Notion… plus de 760 applications via notre couche d'intégration.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={GoogleDriveIcon} title="Google Workspace">Drive, Gmail, Docs — ingestion continue et sourcée.</Card>
          <Card icon={MicrosoftIcon} title="Microsoft 365">SharePoint, Teams, Outlook — le contexte de vos échanges.</Card>
          <Card icon={WhatsappIcon} title="WhatsApp Business">Les décisions prises dans les discussions deviennent de la mémoire.</Card>
          <Card icon={SlackIcon} title="Odoo, Slack, Notion…">Vos processus et vos espaces de travail, déjà connectés.</Card>
        </div>
      </Section>

      {/* 9 · Self-hosted */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Chip variant="subtle" color="lime">Self-hosted · confidentialité par architecture</Chip>
          <h2 className="mt-5 text-title-2-medium text-text-primary" style={{ fontSize: 'clamp(26px,3.6vw,38px)' }}>
            Vos données restent chez vous.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">
            Companion s'installe dans votre VPS, votre cloud privé ou votre infrastructure interne.
            Seule la licence logicielle est fournie et maintenue par KamaLoka.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card icon={ShieldUserIcon} title="Installation chez vous">VPS, cloud privé ou on-premise. Fonctionne même avec une connectivité instable.</Card>
          <Card icon={ServerStack01Icon} title="IA locale possible">Modèles exécutés sur votre infrastructure — zéro envoi vers des fournisseurs externes.</Card>
          <Card icon={Key02Icon} title="Licence hors-ligne">Vérification locale signée cryptographiquement. Aucune dépendance quotidienne à KamaLoka.</Card>
        </div>
      </Section>

      {/* 10 · MCP / technique */}
      <Section soft>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Pour les équipes techniques</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary" style={{ fontSize: 'clamp(26px,3.6vw,38px)' }}>
            Vos agents externes parlent à votre mémoire.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">
            Companion expose un serveur MCP standard : vos assistants interrogent la mémoire d'entreprise
            avec les permissions et l'audit de Companion.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card icon={BotIcon} title="Serveur MCP">10 outils : recherche sourcée, contexte entreprise/poste, création candidate, handovers…</Card>
          <Card icon={ShieldKeyIcon} title="Tokens scellés">Clients à portée limitée : scopes, outils autorisés, expiration, révocation.</Card>
          <Card icon={HistoryIcon} title="Audit complet">Chaque appel externe est journalisé — qui, quoi, quelles sources.</Card>
        </div>
      </Section>

      {/* 11 · Offres */}
      <Section id="offres">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Offres</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary" style={{ fontSize: 'clamp(26px,3.6vw,38px)' }}>
            Une licence annuelle.<br />Vos données, votre instance.
          </h2>
        </div>
        <Plans />
        <p className="mt-4 text-center text-caption-1-medium text-text-tertiary">
          Installation accompagnée : 750 000 FCFA (Business). Paiement annuel ≈ 2 mois offerts vs mensuel.
          Consommation IA : vos clés API par défaut (BYOK).
        </p>
      </Section>

      {/* 12 · Sécurité */}
      <Section soft>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Sécurité · Audit · Permissions</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary" style={{ fontSize: 'clamp(26px,3.6vw,38px)' }}>
            Conçu pour les exigences<br />des banques et des institutions.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={Shield01Icon} title="Permissions par rôle">6 rôles applicatifs, portée par département et poste, appliquées jusqu'au retrieval.</Card>
          <Card icon={HistoryIcon} title="Journal d'audit">Connexions, validations, actions d'agents, exports : tout est tracé.</Card>
          <Card icon={CloudUploadIcon} title="Sauvegardes & restauration">Export complet, restauration testée — vos données ne dépendent de personne.</Card>
          <Card icon={ShieldUserIcon} title="Licence signée">Ed25519, vérification hors-ligne, aucune télémétrie imposée.</Card>
        </div>
      </Section>

      {/* 13 · CTA final */}
      <section id="demo" className="bg-brand-black">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <div className="flex justify-center"><BrandMark size="lg" /></div>
          <h2 className="mt-6 text-title-2-medium text-white" style={{ fontSize: 'clamp(28px,4vw,42px)' }}>
            Arrêtez de perdre<br />ce que vos équipes savent.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-white/70">
            Un pilote de 30 jours sur vos vrais cas : Knowledge Risk mesuré, premier handover assisté,
            premier onboarding généré. Vous voyez la valeur avant d'engager l'installation.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink variant="primary" size="medium" href="mailto:contact@kamaloka.ai?subject=Démo%20Companion">
              Demander une démo
            </ButtonLink>
            <ButtonLink variant="secondary" size="medium" href="mailto:contact@kamaloka.ai?subject=Pilote%20Companion%2030j">
              Commencer un pilote
            </ButtonLink>
          </div>
          <p className="mt-6 text-caption-1-medium text-white/50">
            Déjà client ? <a href="/portal/login" className="font-semibold text-white no-underline">Espace client — téléchargements & licences</a>
          </p>
        </div>
      </section>

      <footer className="border-t border-separator-border px-6 py-7">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <span className="text-caption-1-medium text-text-tertiary">
            <span className="font-semibold text-text-secondary">KamaLoka AI Technologies</span> · Companion — la mémoire opérationnelle d'entreprise
          </span>
          <span className="flex gap-4 text-caption-1-medium text-text-secondary">
            <a href="/docs" className="no-underline hover:text-text-primary">Documentation</a>
            <a href="/portal/login" className="no-underline hover:text-text-primary">Portail client</a>
            <a href="mailto:contact@kamaloka.ai" className="no-underline hover:text-text-primary">contact@kamaloka.ai</a>
          </span>
        </div>
      </footer>
    </div>
  )
}

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

import askImg from './assets/ask.png'
import riskImg from './assets/knowledge-risk.png'
import handoversImg from './assets/handovers.png'
import brainImg from './assets/brain.png'
import approvalsImg from './assets/approvals.png'

/* Surface marketing — companion.kamaloka.ai. Style bento (réf. lattice.com) :
 * vraies captures produit, grille de cartes variées, design system Companion.
 * Règle anti-chevauchement : jamais de font-size sans line-height assorti. */

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
    ['#produit', 'Produit'],
    ['#agents', 'Agents IA'],
    ['#offres', 'Offres'],
    ['/docs', 'Documentation'],
  ]
  return (
    <header className="sticky top-0 z-20 border-b border-separator-border bg-background-primary-default/95 backdrop-blur">
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

/** Capture produit encadrée façon navigateur. */
function Shot({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-border-button-default bg-background-primary-default shadow-card ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-separator-border bg-background-secondary-default px-3.5 py-2">
        <span className="size-2.5 rounded-full bg-rose-400" />
        <span className="size-2.5 rounded-full bg-amber-400" />
        <span className="size-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 flex-1 truncate rounded-md bg-background-primary-default px-2.5 py-1 text-caption-2-medium text-text-tertiary">
          companion.votreentreprise.com
        </span>
      </div>
      <img src={src} alt={alt} className="block w-full" loading="lazy" />
    </div>
  )
}

function Card({ icon, title, children, className = '' }: { icon?: Icon; title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border-button-default bg-background-primary-default p-5 shadow-card ${className}`}>
      {icon && <HugeIcon icon={icon} size="lg" className="mb-3 text-foreground-icon-secondary" />}
      <h3 className="text-headline-medium text-text-primary">{title}</h3>
      <p className="mt-1.5 text-body-2-regular text-text-secondary">{children}</p>
    </div>
  )
}

/** Carte bento : capture produit + légende. */
function BentoShot({ src, alt, title, children, wide = false }: {
  src: string; alt: string; title: string; children: ReactNode; wide?: boolean
}) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default shadow-card ${wide ? 'lg:col-span-2' : ''}`}>
      <div className="p-5 pb-4">
        <h3 className="text-headline-medium text-text-primary">{title}</h3>
        <p className="mt-1 text-body-2-regular text-text-secondary">{children}</p>
      </div>
      <div className="mt-auto px-5 pb-5">
        <img src={src} alt={alt} loading="lazy"
          className="block w-full rounded-xl border border-separator-border" />
      </div>
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
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-gradient-to-b from-accent-100/60 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-16 text-center">
          <Chip variant="subtle" color="lime">Self-hosted · vos données restent chez vous</Chip>
          <h1
            className="mx-auto mt-5 max-w-3xl font-medium tracking-tight text-text-primary"
            style={{ fontSize: 'clamp(38px,5.5vw,58px)', lineHeight: 1.08 }}
          >
            Votre entreprise<br />n'oublie plus.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-headline-medium text-text-secondary">
            Capturez le savoir de vos équipes, réduisez la dépendance aux personnes clés et transmettez
            instantanément le contexte aux nouveaux collaborateurs — et aux agents IA.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink variant="primary" size="medium" leadingIcon={adaptIcon(ArrowRight02Icon, 20)} href="#demo">
              Demander une démo
            </ButtonLink>
            <ButtonLink variant="secondary" size="medium" href="#demo">Commencer un pilote</ButtonLink>
          </div>
          <p className="mt-6 text-body-2-medium text-text-tertiary">
            Déjà client ? <a href="/portal/login" className="font-semibold text-accent-600 no-underline">Télécharger Companion</a>
          </p>
          <div className="mx-auto mt-12 max-w-5xl">
            <Shot src={askImg} alt="Ask Companion — réponse citée avec niveau de confiance et sources" />
            <p className="mt-3 text-caption-1-medium text-text-tertiary">
              Ask Companion — chaque réponse cite ses sources, avec son niveau de confiance. Contexte insuffisant ? Companion s'abstient.
            </p>
          </div>
        </div>
      </section>

      {/* 2 · Bento produit */}
      <Section soft id="produit">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Le produit, en vrai</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">Ce que ça change, concrètement.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">
            Captures réelles de l'application — aucune maquette. Ce que vous voyez est ce que vos équipes utiliseront.
          </p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <BentoShot wide src={riskImg} alt="Knowledge Risk — score global, personnes critiques, dépendances" title="Sachez ce que vous risquez de perdre — chiffré">
            Le Knowledge Risk chiffre votre exposition : personnes critiques, procédures à propriétaire unique,
            activités non documentées — chaque facteur pointe vers l'action.
          </BentoShot>
          <Card icon={Database01Icon} title="Company Brain">
            Le socle vérifié : procédures, décisions, faits — chacun avec sa source, son propriétaire
            et son statut. Les candidats ne passent « validés » que par une main humaine.
          </Card>
          <BentoShot src={brainImg} alt="Company Brain — connaissances typées avec confiance et statut" title="Un cerveau d'entreprise traçable">
            Types, propriétaires, confiance, statut — y compris les contradictions signalées
            plutôt qu'écrasées.
          </BentoShot>
          <BentoShot wide src={handoversImg} alt="Transferts — readiness par poste, pack de handover" title="Un départ ne doit jamais rimer avec perte sèche">
            Le handover compare ce que le partant seul sait au Role Brain de son poste, mène l'entretien,
            puis produit le pack de transmission — readiness à l'appui.
          </BentoShot>
          <Card icon={RocketIcon} title="Onboarding J1 · J7 · J30">
            Le nouvel arrivant reçoit un plan construit depuis le Role Brain et le handover de son
            prédécesseur. Autonomie en semaines, pas en mois.
          </Card>
        </div>
      </Section>

      {/* 3 · Flux */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Comment fonctionne Companion</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">De vos sources à la transmission.</h2>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
          <FlowStep icon={Folder01Icon} label="Sources" /><Arrow />
          <FlowStep icon={Database01Icon} label="Company Brain" /><Arrow />
          <FlowStep icon={UserCircleIcon} label="Role Brain" /><Arrow />
          <FlowStep icon={ShieldAlertIcon} label="Knowledge Risk" /><Arrow />
          <FlowStep icon={HandshakeIcon} label="Handover" /><Arrow />
          <FlowStep icon={RocketIcon} label="Onboarding" />
        </div>
      </Section>

      {/* 4 · Agents IA */}
      <Section soft id="agents">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Agents IA avec garde-fous</Eyebrow>
            <h2 className="text-title-2-medium text-text-primary">
              L'IA prépare.<br />Vous décidez.
            </h2>
            <p className="mt-4 text-body-medium text-text-secondary">
              Relances clients, mises à jour de procédures, préparation de handovers : les agents travaillent
              depuis votre mémoire, avec vos permissions. Toute action sensible attend votre approbation —
              et chaque décision est journalisée.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Card icon={ShieldKeyIcon} title="Permissions propagées">Un agent commercial ne voit jamais un dossier RH.</Card>
              <Card icon={DocumentValidationIcon} title="Approbations">L'agent propose, un humain approuve.</Card>
              <Card icon={FileEditIcon} title="Corrections">Chaque correction enrichit la mémoire.</Card>
            </div>
          </div>
          <Shot src={approvalsImg} alt="Approbations — l'agent propose, l'humain approuve" />
        </div>
      </Section>

      {/* 5 · Intégrations */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Intégrations</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">Connecté à vos outils du quotidien.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">
            Google, Microsoft, WhatsApp, Odoo, Slack, Notion… plus de 760 applications via notre couche d'intégration.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={GoogleDriveIcon} title="Google Workspace">Drive, Gmail, Docs — ingestion continue et sourcée.</Card>
          <Card icon={MicrosoftIcon} title="Microsoft 365">SharePoint, Teams, Outlook — le contexte de vos échanges.</Card>
          <Card icon={WhatsappIcon} title="WhatsApp Business">Les décisions prises dans les discussions deviennent de la mémoire.</Card>
          <Card icon={SlackIcon} title="Odoo, Slack, Notion…">Vos processus et espaces de travail, déjà connectés.</Card>
        </div>
      </Section>

      {/* 6 · Self-hosted */}
      <Section soft>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <Chip variant="subtle" color="lime">Self-hosted · confidentialité par architecture</Chip>
            <h2 className="mt-5 text-title-2-medium text-text-primary">Vos données restent chez vous.</h2>
            <p className="mt-4 text-body-medium text-text-secondary">
              Companion s'installe dans votre VPS, votre cloud privé ou votre infrastructure interne.
              Ni vos documents, ni vos conversations, ni vos mémoires ne quittent votre périmètre.
              Seule la licence logicielle est fournie et maintenue par KamaLoka.
            </p>
            <div className="mt-6 rounded-xl bg-brand-black p-4 text-left">
              <p className="text-caption-1-medium text-blue-200/80">Installation — 10 minutes</p>
              <pre className="mt-2 overflow-x-auto text-caption-1-medium leading-relaxed text-blue-100"><code>{`unzip companion-kit.zip && cd companion-kit
sudo ./install.sh   # licence .lic demandée à l'installation`}</code></pre>
            </div>
          </div>
          <div className="grid gap-4">
            <Card icon={ShieldUserIcon} title="Installation chez vous">VPS, cloud privé ou on-premise. Fonctionne même avec une connectivité instable.</Card>
            <Card icon={ServerStack01Icon} title="IA locale possible">Modèles exécutés sur votre infrastructure — zéro envoi vers des fournisseurs externes.</Card>
            <Card icon={Key02Icon} title="Licence hors-ligne">Vérification locale signée Ed25519. Aucune dépendance quotidienne à KamaLoka.</Card>
          </div>
        </div>
      </Section>

      {/* 7 · MCP / technique */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Pour les équipes techniques</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">Vos agents externes parlent à votre mémoire.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-text-secondary">
            Companion expose un serveur MCP standard : Claude, Cursor, vos agents maison —
            avec les permissions et l'audit de Companion.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card icon={BotIcon} title="Serveur MCP">10 outils : recherche sourcée, contexte entreprise/poste, création candidate, handovers…</Card>
          <Card icon={ShieldKeyIcon} title="Tokens scellés">Clients à portée limitée : scopes, outils autorisés, expiration, révocation.</Card>
          <Card icon={HistoryIcon} title="Audit complet">Chaque appel externe est journalisé — qui, quoi, quelles sources.</Card>
        </div>
      </Section>

      {/* 8 · Offres */}
      <Section soft id="offres">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Offres</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">Une licence annuelle.<br />Vos données, votre instance.</h2>
        </div>
        <Plans />
        <p className="mt-4 text-center text-caption-1-medium text-text-tertiary">
          Installation accompagnée : 750 000 FCFA (Business). Paiement annuel ≈ 2 mois offerts vs mensuel.
          Consommation IA : vos clés API par défaut (BYOK).
        </p>
      </Section>

      {/* 9 · Sécurité */}
      <Section>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>Sécurité · Audit · Permissions</Eyebrow>
          <h2 className="text-title-2-medium text-text-primary">Conçu pour les exigences<br />des banques et des institutions.</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card icon={Shield01Icon} title="Permissions par rôle">6 rôles applicatifs, appliqués jusqu'au retrieval.</Card>
          <Card icon={HistoryIcon} title="Journal d'audit">Connexions, validations, actions d'agents, exports : tout est tracé.</Card>
          <Card icon={CloudUploadIcon} title="Sauvegardes">Export complet, restauration testée — vos données ne dépendent de personne.</Card>
          <Card icon={ChartIcon} title="Aucune télémétrie">La licence se vérifie hors-ligne. Rien ne remonte sans votre accord.</Card>
        </div>
      </Section>

      {/* 10 · CTA final */}
      <section id="demo" className="bg-brand-black">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <div className="flex justify-center"><BrandMark size="lg" /></div>
          <h2 className="mt-6 font-medium text-white" style={{ fontSize: 'clamp(28px,4vw,42px)', lineHeight: 1.12 }}>
            Arrêtez de perdre<br />ce que vos équipes savent.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-medium text-white/70">
            Un pilote de 30 jours sur vos vrais cas : Knowledge Risk mesuré, premier handover assisté,
            premier onboarding généré.
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

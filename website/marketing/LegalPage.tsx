import { useState } from 'react'
import { cx } from '@/utils/cx'
import { ButtonLink } from '@/components/base/buttons/button'
import { Chip } from '@/components/base/badges/chip'
import logoGreen from './assets/logos/logo-green.png'

/**
 * Mentions légales & conditions — Companion, édité par KamaLoka AI
 * Technologies LLC. Les champs entre crochets sont à compléter avec les
 * informations du registre du commerce avant publication officielle.
 */

const SECTIONS = [
  { id: 'editeur', label: 'Éditeur' },
  { id: 'hebergement', label: 'Hébergement' },
  { id: 'licence', label: 'Licence d\u2019utilisation' },
  { id: 'propriete', label: 'Propriété intellectuelle' },
  { id: 'donnees', label: 'Données & confidentialité' },
  { id: 'facturation', label: 'Facturation & TVA' },
  { id: 'responsabilite', label: 'Responsabilité' },
  { id: 'droit', label: 'Droit applicable' },
] as const

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-24 text-title-3-semibold text-text-primary first:mt-0">
      {children}
    </h2>
  )
}

export function LegalPage() {
  const [active, setActive] = useState<string>('editeur')
  const nav = (label: string, id: string, i: number) => ({ label, id, i })
  const items = [
    nav(SECTIONS[0].label, SECTIONS[0].id, 0),
    nav(SECTIONS[1].label, SECTIONS[1].id, 1),
    nav(SECTIONS[2].label, SECTIONS[2].id, 2),
    nav(SECTIONS[3].label, SECTIONS[3].id, 3),
    nav(SECTIONS[4].label, SECTIONS[4].id, 4),
    nav(SECTIONS[5].label, SECTIONS[5].id, 5),
    nav(SECTIONS[6].label, SECTIONS[6].id, 6),
    nav(SECTIONS[7].label, SECTIONS[7].id, 7),
  ]

  return (
    <div className="min-h-screen bg-background-full font-sans text-text-primary">
      {/* Header */}
      <header className="border-b border-separator-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-6">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-black">
            <img src={logoGreen} alt="Companion" className="h-4 w-auto" />
          </span>
          <span className="text-headline-semibold">Companion</span>
          <Chip variant="subtle">Mentions légales</Chip>
          <div className="flex-1" />
          <ButtonLink variant="secondary" size="small" href="/">Site produit</ButtonLink>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[220px_1fr]">
        {/* Sommaire */}
        <nav aria-label="Sommaire" className="lg:sticky lg:top-8 lg:self-start">
          <ul className="flex flex-wrap gap-1.5 lg:flex-col">
            {items.map((it) => (
              <li key={it.id}>
                <a
                  href={`#${it.id}`}
                  onClick={() => setActive(it.id)}
                  className={cx(
                    'block rounded-lg px-2.5 py-1.5 text-body-2-medium transition-colors',
                    active === it.id
                      ? 'bg-background-secondary-default text-text-primary'
                      : 'text-text-tertiary hover:text-text-primary',
                  )}
                >
                  {it.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contenu */}
        <article className="min-w-0 space-y-4 text-body-regular text-text-secondary [&_h2]:text-text-primary [&_li]:mb-1 [&_strong]:text-text-primary">
          <h1 className="text-title-1-medium text-text-primary">Mentions légales & conditions</h1>
          <p>Dernière mise à jour : septembre 2026.</p>

          <H id="editeur">1. Éditeur</H>
          <p>
            Le logiciel <strong>Companion</strong> est édité par :
          </p>
          <ul>
            <li><strong>Dénomination sociale</strong> : KamaLoka AI Technologies LLC</li>
            <li><strong>Forme juridique</strong> : Limited Liability Company (LLC)</li>
            <li><strong>Siège</strong> : Abidjan, Côte d'Ivoire</li>
            <li><strong>Registre du commerce</strong> : [RCCM à compléter]</li>
            <li><strong>Contact</strong> : <a className="text-accent-600 no-underline" href="mailto:contact@kamaloka.ai">contact@kamaloka.ai</a></li>
            <li><strong>Directeur de la publication</strong> : [à compléter]</li>
          </ul>
          <p>
            KamaLoka AI Technologies LLC conçoit et commercialise des applications SaaS et
            logiciels d'intelligence artificielle destinés à l'automatisation des processus
            d'entreprise. Companion, son produit de gestion de mémoire opérationnelle
            self-hosted, est distribué sous licence propriétaire.
          </p>

          <H id="hebergement">2. Hébergement</H>
          <p>
            Companion est un logiciel <strong>auto-hébergé</strong> : l'instance applicative, la
            base de données et les fichiers sont hébergés sur l'infrastructure du client
            (VPS, cloud privé ou serveur interne). KamaLoka AI Technologies LLC n'héberge
            aucune donnée client. Ce site vitrine est hébergé chez [hébergeur du site à
            compléter].
          </p>

          <H id="licence">3. Licence d'utilisation</H>
          <p>
            Companion est concédé sous licence propriétaire, annuelle par défaut
            (mensuelle en option), émise par entité contractante. La licence est un
            fichier signé cryptographiquement (Ed25519) vérifié localement par
            l'instance — la clé de signature ne quitte jamais KamaLoka.
          </p>
          <ul>
            <li><strong>Offre standard (connectée)</strong> : l'instance confirme
            périodiquement sa licence par un heartbeat technique (compteurs agrégés —
            aucune donnée métier) et reçoit un lease renouvelé automatiquement.</li>
            <li><strong>Offre Enterprise (hors-ligne)</strong> : la licence longue durée
            fait foi sans aucune connexion sortante.</li>
            <li><strong>Cycle de renouvellement</strong> : actif → grâce (30 jours, tout
            fonctionne) → mode restreint (consultation, export et sauvegardes restent
            libres ; les nouvelles créations sont suspendues). Les données du client
            restent accessibles et exportables en toutes circonstances — il n'existe
            aucun mécanisme de verrouillage des données.</li>
          </ul>
          <p>
            Le client est responsable de l'administration de son instance (mises à jour,
            sauvegardes, comptes) — des guides détaillés sont fournis avec le logiciel.
          </p>

          <H id="propriete">4. Propriété intellectuelle</H>
          <p>
            Le logiciel Companion, sa documentation, ses marques et son site vitrine sont
            la propriété exclusive de KamaLoka AI Technologies LLC. Le client acquiert un
            droit d'usage non exclusif et non transférable, dans les limites de sa licence
            (plan, quotas d'utilisateurs, d'agents et d'instances). Aucune cession de
            propriété intellectuelle n'est consentie. Les marques tierces citées
            (Google, Microsoft, Notion, Slack, etc.) appartiennent à leurs propriétaires
            respectifs.
          </p>

          <H id="donnees">5. Données & confidentialité</H>
          <p>
            <strong>Chez le client</strong> : l'intégralité des données métier
            (documents, mémoires, conversations, fichiers) réside sur l'infrastructure
            du client. Le traitement IA (modèles de langage et d'embeddings) s'exécute
            localement ; l'usage de fournisseurs externes (BYOK) est à la discrétion du
            client.
          </p>
          <p>
            <strong>Chez KamaLoka</strong> : seuls des compteurs techniques agrégés
            (nombre d'utilisateurs, d'agents, d'intégrations, version, santé) sont
            transmis périodiquement pour la gestion des licences. Trois principes
            s'appliquent : (1) ce heartbeat est purement technique ; (2) les données
            d'amélioration produit sont opt-in et non implémentées ; (3) les données ne
            servent jamais à l'entraînement de modèles. Ce site vitrine ne dépose
            aucun cookie publicitaire.
          </p>

          <H id="facturation">6. Facturation & TVA</H>
          <p>
            Vente aux entreprises (B2B). Moyens de paiement : Stripe (EUR, abonnement à
            renouvellement automatique), Jèko (XOF — Mobile Money, carte — facture
            réémise), virement bancaire (grands comptes, validation manuelle). Pour un
            client professionnel établi dans l'UE et assujetti, la TVA n'est pas
            facturée : le client l'autoliquide (<em>reverse charge</em>) — son numéro de
            TVA intracommunautaire est vérifié (VIES) et mentionné sur la facture. Le
            modèle de facture est validé avec notre conseil fiscal.
          </p>

          <H id="responsabilite">7. Responsabilité</H>
          <p>
            Companion est fourni « en l'état » avec les garanties de la licence
            contractuelle. KamaLoka s'engage à corriger les défauts signalés dans les
            délais du support souscrit. La responsabilité de KamaLoka ne saurait être
            engagée pour les dommages indirects, la perte de données non couverte par
            une sauvegarde du client, ou l'usage non conforme de la documentation. Le
            client est seul responsable de l'administration de son serveur (accès,
            secrets, sauvegardes) et du respect des droits des personnes dont il
            traite les données.
          </p>

          <H id="droit">8. Droit applicable</H>
          <p>
            Les licences et services sont régis par le droit ivoirien (siège de
            l'éditeur), sans préjudice des règles impératives applicables aux
            contrats de consommation dans l'UE. Tout litige fait d'abord l'objet d'une
            résolution amiable ; à défaut, compétence est attribuée aux tribunaux
            compétents du ressort du siège de KamaLoka AI Technologies LLC, sauf
            clause contraire d'un contrat signé.
          </p>

          <div className="mt-10 flex flex-wrap gap-2 border-t border-separator-border pt-6">
            <ButtonLink variant="secondary" size="small" href="/">
              Site produit
            </ButtonLink>
            <ButtonLink variant="ghost" size="small" href="/docs">
              Documentation
            </ButtonLink>
            <ButtonLink variant="ghost" size="small" href="/login">
              Accéder à l'application
            </ButtonLink>
          </div>
        </article>
      </main>

      <footer className="border-t border-separator-border px-6 py-3">
        <p className="mx-auto max-w-5xl text-caption-1-regular text-text-tertiary">
          © {new Date().getFullYear()} KamaLoka AI Technologies LLC — éditeur de
          Companion. <a href="/landing" className="no-underline hover:text-text-primary">Site produit</a>
        </p>
      </footer>
    </div>
  )
}

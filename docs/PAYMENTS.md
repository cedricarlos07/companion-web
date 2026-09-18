# Paiements Companion — Jèko, Stripe, virement

> Décision : **Stripe pour automatiser (Europe), Jèko pour l'Afrique / Mobile Money,
> virement pour les grands comptes. Le Control Center KamaLoka reste la seule
> autorité sur les licences.**

Les processeurs sont une **couche d'encaissement**, jamais le cœur du licensing :

```text
LANDING / PORTAIL CLIENT
        ↓  (paiement)
Jèko (XOF · Mobile Money, carte)   |   Stripe (EUR/USD · cartes, abonnements)
        ↓
webhook SIGNÉ (checkout.session.completed / confirmation Jèko)
        ↓
KAMALOKA CONTROL CENTER
        ↓  vérifie signature + payment/customer/order
facture = paid → prolonge expiresAt → génère la licence signée (+ lease)
        ↓
disponible dans le Portail Client → Companion activé / renouvelé
```

## Règles d'autorité

- Le **retour navigateur** du client ne prouve rien : seule la **confirmation
  webhook signée** déclenche un changement d'état.
- Aucun webhook n'active directement Companion : signature vérifiée, puis
  `payment / customer / order` recoupés avec le contrat, puis émission.
- La clé privée de signature des licences ne quitte jamais le Control Center.

## Webhooks minimum à traiter (Control Center)

| Événement | Effet |
| --- | --- |
| paiement réussi (`checkout.session.completed`, équivalent Jèko) | facture `paid` → émission / prolongation licence |
| renouvellement réussi (invoice paid, abonnement) | nouvelle licence 12 mois / prolongation |
| paiement échoué / renouvellement échoué | relance (Stripe automatique, Jèko : rappel commercial) ; licence suit son cycle lease → grâce → restricted |
| abonnement annulé | pas de kill : la licence court jusqu'à son terme, puis cycle lease |
| remboursement / chargeback | suspension à la main (décision commerciale), révocation via le cycle lease |

## Répartition par marché

| Marché | Processeur | Moyens | Notes |
| --- | --- | --- | --- |
| Côte d'Ivoire / XOF | **Jèko** | Orange Money, Wave, MTN, Moov, Djamo, carte | frais ~1,5 % (≈ 36 000 FCFA sur une licence à 2,4 M) ; liens/checkout, pas de moteur d'abonnement → **facture annuelle**, pas de prélèvement mensuel auto |
| Europe / EUR (et USD) | **Stripe** | cartes internationales | Checkout hébergé, abonnements (mensuel à renouvellement auto), reçus, relances, Customer Portal pour la partie paiement uniquement |
| Grands comptes (tous marchés) | **Virement** | bon de commande + facture | validation manuelle `paid` dans le Control Center, puis émission |

Le portail n'affiche que les moyens pertinents pour la devise du contrat
(`PAYMENT_METHODS` dans `src/data/portal.ts`) ; le client ne voit pas la
complexité derrière.

## Tarification

Une seule édition Companion, prix régional, **annuel par défaut** (aligné sur
la licence 12 mois), mensuel majoré :

| Marché | Mensuel | Annuel | Déploiement (une fois) |
| --- | --- | --- | --- |
| Afrique francophone | 250 000 FCFA/mois | 2 400 000 FCFA/an | 750 000 FCFA |
| Europe | 490 €/mois | 4 900 €/an | 1 500 € |

Le mensuel automatique (prélèvement) n'est proposé que via Stripe Billing.
En XOF, le « mensuel » est une facture réémise chaque mois, pas un
prélèvement automatique.

## TVA (UE)

Vente **B2B uniquement** en V1. Client professionnel UE assujetti : pas de TVA
KamaLoka, **autoliquidation (reverse charge)** par le client, numéro de TVA
vérifié (VIES) et mentionné sur la facture. Modèle de facture validé avec le
conseil fiscal avant les premières factures européennes.

## Périmètre d'implémentation

- **Portail client** (ce repo) : sélection du moyen de paiement par devise,
  explication du flux, montants multi-devises — `src/pages/portal/invoices.tsx`,
  `src/data/portal.ts`.
- **Control Center** (projet séparé) : endpoints Stripe/Jèko, webhooks signés,
  statuts de facture, émission des licences et leases (voir
  `server/services/licenses.ts` pour le format de signature attendu côté
  instance Companion).

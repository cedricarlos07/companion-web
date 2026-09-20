# Modèle de licences Kamaloka — Companion self-hosted

> **Principe : le client contrôle ses données. Kamaloka contrôle le droit d'utiliser Companion.**
> Le client héberge son instance (PostgreSQL, Mem0, Mastra, Activepieces) ; la licence
> logicielle reste émise, maintenue et renouvelée par Kamaloka AI Technologies.

## 1. Architecture

```text
        KAMALOKA CONTROL CENTER (control-center/, port 5300)
        clients · licences · activations · factures · paiements
        clé privée Ed25519 (jamais distribuée)
                    │
        fichier companion-license-*.lic (signé)
                    │
                    ▼
        COMPANION CHEZ LE CLIENT
        - import .lic → vérification locale (clé publique seule)
        - licence engine → entitlements (limites de plan)
        - heartbeat quotidien → licence.kamaloka.ai (métadonnées seulement)
```

Deux modes de fonctionnement :

| Mode | Connexion | Usage |
|---|---|---|
| **Self-hosted Offline** | Aucune. Le `.lic` signé est vérifié localement. | Banques, gouvernements, serveurs sensibles, connectivité instable |
| **Self-hosted Connected** | 1 heartbeat/jour vers le control plane | Clients classiques : suivi d'usage, versions, support |

Le heartbeat n'envoie **jamais** de mémoires, documents, emails ou conversations —
uniquement `licenseId`, `instanceId`, version, mode et compteurs agrégés
(users / agents / intégrations). Un échec de heartbeat n'a **aucun** impact produit.

## 2. Cycle de vie d'une licence (aucun kill-switch)

```text
Licence active → expiration → 30 jours de grâce → Restricted Mode
```

- **Active** : tout fonctionne.
- **Grâce** (30 j, configurable via `LICENSE_GRACE_DAYS`) : tout fonctionne + bannière
  d'incitation au renouvellement.
- **Restreint** : la consultation, l'export et les **backups restent libres** —
  les données ne sont jamais prises en otage. Sont bloqués (HTTP 402) :
  - création d'utilisateurs (`POST /invitations`) ;
  - exécution d'actions agentiques (`POST /agents/:id/runs`, `resume`, `approve`) ;
  - connexion de nouvelles intégrations (`POST /ap/connect/:pieceName`).

Le levier commercial est la reprise des créations, pas le blocage de l'accès.

## 3. API du control plane (`control-center`)

```text
POST /v1/activate     { license, instanceId, version }   → lie l'instance (maxInstances)
POST /v1/validate     { licenseId, instanceId }          → { status, plan, expiresAt }
POST /v1/deactivate   { licenseId, instanceId }          → libère un siège d'instance
POST /v1/heartbeat    { licenseId, instanceId, version, mode, counts }
```

API admin (`x-admin-key`) : clients, émission/renouvellement/révocation de licences,
factures, paiements, instances (réinitialisation d'activation), dashboard.
UI interne rendue serveur sur `/` (login par clé admin).

## 4. Format de licence

Payload JSON signé Ed25519, encapsulé en base64 — vérifiable hors-ligne par Companion :

```json
{
  "licenseId": "LIC-KAM-2026-00002",
  "organization": "Entreprise ABC",
  "plan": "business",
  "issuedAt": "2026-09-17T16:42:09.321Z",
  "expiresAt": "2027-09-12T16:42:09.321Z",
  "entitlements": {
    "users.max": 100, "agents.max": 20, "mcpClients.max": 5,
    "sources.max": 15, "storage.maxGb": 50,
    "advancedAudit": true, "sso": false, "prioritySupport": true, "advancedBackup": true
  }
}
```

- Companion embarque la **clé publique** (`LICENSE_PUBLIC_KEY`) — jamais la privée.
- L'import d'une licence (owner, `POST /api/license/import`) active automatiquement
  le plan correspondant (`org_entitlements.plan`).
- Le ré-import d'une même licenceId (renouvellement) met à jour la ligne existante.
- Une signature invalide ⇒ restriction **immédiate** (pas de grâce pour la fraude).
- L'instanceId (`cmp_inst_…`) est généré au premier démarrage, persisté dans `settings`.

## 5. Tarifs de référence (FCFA)

| Plan | Annuel | Mensuel | Installation | Instances |
|---|---|---|---|---|
| Pilot | essai 30 j | — | — | 1 |
| Business | 2 400 000 | 250 000 | 750 000 | 1 |
| Enterprise | sur devis | sur devis | sur devis | 3 |

L'annuel équivaut à ~2 mois offerts vs le mensuel. La consommation IA tierce reste
**BYOK** par défaut (facturée directement au client par le fournisseur) ; Managed AI
(enveloppe facturée par Kamaloka) se décide à la commande.

## 6. Encaissement (B2B classique)

```text
Devis accepté → Facture Kamaloka (FAC-…) → Virement → Paiement validé
             → Émission licence (LIC-KAM-…) → livraison companion-license-*.lic
```

Le Control Center suit factures et paiements ; l'émission de licence peut être liée
à la facture annuelle depuis la fiche client.

## 7. Tests

```bash
npm run test:billing        # 20 scénarios : accès, usage, licence, grâce, restreint
npm run test:mcp -- --clean # purge des clients MCP de test résiduels
```

La série B de `test:billing` exerce le cycle complet : import d'une licence expirée →
restricted (402 sur invitations/runs, lecture et backup libres) → grâce → plan business
activé → retrait → retour essai. La signature des licences de test utilise
`dev-sign` en dev pur, sinon le Control Center (chaîne de confiance de production).

## 8. Exploitation

- CC : `cd control-center && npm start` (port 5300). Arrêt propre :
  `POST /admin/shutdown` (flush PGlite avant exit — évite un data dir sale).
- Variables : `CC_ADMIN_KEY`, `CC_PORT`, `CC_DATA_DIR`, `LICENSE_SIGNING_PRIVATE_KEY` /
  `LICENSE_SIGNING_PUBLIC_KEY` (prod), côté Companion `LICENSE_PUBLIC_KEY` +
  `LICENSE_SERVER_URL` (ex. `https://license.kamaloka.ai`) + `LICENSE_GRACE_DAYS`.
- En production, servir le CC derrière `license.kamaloka.ai` (HTTPS uniquement).

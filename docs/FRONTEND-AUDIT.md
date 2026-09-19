# Frontend — matrice d'audit (0 mock en production)

> **Règle de sortie par route** : lecture, écriture, permissions, erreurs,
> persistance et audit réels. Une cellule non vérifiée = route non terminée.
>
> **0 donnée mockée en production. 0 bouton principal sans backend.
> 0 écriture uniquement locale.**

Garde runtime : `ALLOW_MOCK_DATA` (vite define, interdit par défaut) — un
build de production avec mock activé refuse de démarrer (`src/main.tsx`).
Gate CI : `scripts/check-frontend.mjs` (allowlist shrinking — chaque ligne
retirée = une page branchée et auditée) câblé dans `npm run build`.

Légende : ✅ réel et testé · 🟡 partiel (à compléter) · ❌ mock/store ·
n/a sans objet · 🔍 à vérifier écran par écran.

## Application (chrome authentifié)

| Route | GET réel | Écriture réelle | Permissions | Erreurs | Persistance | Audit | E2E |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/home` | 🟡 overview | n/a (liens) | 🔍 | ❌ | 🔍 | n/a | ❌ |
| `/ask` | ✅ POST /ask | ✅ | ✅ clause d'accès | 🔍 | ✅ (mémoires) | ✅ | 🟡 |
| `/brain` | 🟡 | n/a | 🔍 | ❌ | ✅ | n/a | ❌ |
| `/brain/memory/:id` | 🟡 | 🟡 verify/contradict | 🔍 | ❌ | ✅ | 🟡 | ❌ |
| `/people` | ✅ | ❌ (création employé ?) | 🔍 | ❌ | ✅ | 🟡 | ❌ |
| `/people/:id` | 🟡 | ❌ | 🔍 | ❌ | ✅ | n/a | ❌ |
| `/roles` | ✅ | ❌ | 🔍 | ❌ | ✅ | n/a | ❌ |
| `/roles/:id` (Role Brain) | 🟡 | ❌ | 🔍 | ❌ | ✅ | n/a | ❌ |
| `/sources` | ✅ | ✅ (connect) | 🔍 | ❌ | ✅ | ✅ | ❌ |
| `/sources/new` | n/a | 🟡 (upload → store ?) | 🔍 | ❌ | ✅ | ✅ | ❌ |
| `/knowledge-risk` | 🟡 service risk | n/a | 🔍 | ❌ | ✅ | n/a | ❌ |
| `/handovers` | ❌ mock | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/handovers/new/:employeeId` | ❌ mock | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/handovers/:id` (détail/pack) | ❌ mock | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/handovers/:id/interview` | 🟡 (entretien API) | ✅ answer | 🔍 | ❌ | ✅ | 🟡 | 🟡 |
| `/onboarding` | 🟡 | n/a | 🔍 | ❌ | ✅ | n/a | ❌ |
| `/onboarding/:id` | ❌ mock | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/agents` | ✅ liste | 🟡 (status) | ✅ role gate | ❌ | ✅ | 🟡 | ✅ battery |
| `/agents/new` | ❌ store | ❌ | 🔍 | ❌ | ❌ | ❌ | ❌ |
| `/agents/:id` | ❌ mock | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/automations` | ❌ store | ❌ | 🔍 | ❌ | ❌ | ❌ | ❌ |
| `/approvals` | ❌ store (API GET ✓) | ❌ store (API POST ✓) | 🔍 | ❌ | ❌ | ✅ serveur | ❌ |
| `/activity` | 🟡 GET /audit | n/a | 🔍 | ❌ | ✅ | ✅ | ❌ |
| `/integrations` | ✅ | 🟡 | ✅ admin | ❌ | ✅ | ✅ | 🟡 |
| `/settings` | ❌ mock | ❌ | 🔍 | ❌ | ❌ | ❌ | ❌ |
| `/billing` | ✅ | ✅ import licence | 🔍 | ❌ | ✅ | 🟡 | ✅ billing |

## Surfaces autonomes

| Route | État | Notes |
| --- | --- | --- |
| `/login` | ✅ réelle + garde mock (fallback démo bloqué hors ALLOW_MOCK_DATA) | |
| `/setup` | ✅ API réelle | |
| `/portal/*` | 🟡 mock consenté | Le backend du portail est le Control Center KamaLoka (projet séparé) — allowlist `check-frontend`, à brancher quand le CC expose son API |

## Ordre d'exécution de la phase

1. `/approvals` — store → API (GET/POST existent côté serveur) + double-clic,
   déjà traitée, autre org, mauvais rôle, run inexistant, restart.
2. Domaine Handover complet : `/handovers` + new + détail/pack (un seul domaine).
3. `/onboarding/:id` → Role Brain → `/people/:id` (objets métier partagés).
4. `/agents/new` + `/agents/:id` (config réelle : modèle, autonomie, tools,
   budgets, scopes, triggers, kill switch, historique).
5. `/settings` — chaque toggle = configuration backend réelle + permission + audit.
6. `/sources/new` + `/home` (KPI depuis /overview réel — plus aucun chiffre codé).
7. `npm run test:frontend-real-data` — persistence, refresh, 403, cross-org,
   erreurs affichées, boutons morts, console.error.

## Gate de sortie de la phase

```
29/29 fichiers allowlist retirés (check-frontend ✅ sans allowlist)
0 mock en production (garde runtime + build)
0 bouton mort · 0 faux CRUD · 0 donnée métier hardcodée
test:frontend-real-data ✅ · build ✅ · test:battery ✅
```

Ensuite seulement : Golden E2E externe (Drive → Activepieces → ingestion →
Mem0 → Ask cité → Mastra → Approval → Gmail → audit), puis VPS vierge.

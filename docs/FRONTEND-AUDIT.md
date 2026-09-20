# Frontend — matrice d'audit (0 mock en production)

> **Règle de sortie par route** : lecture, écriture, permissions, erreurs,
> persistance et audit réels. Une cellule non vérifiée = route non terminée.
>
> **0 donnée mockée en production. 0 bouton principal sans backend.
> 0 écriture uniquement locale.**

Garde runtime : `ALLOW_MOCK_DATA` (vite define, interdit par défaut) — un
build de production avec mock activé refuse de démarrer (`src/main.tsx`).
Gate CI : `scripts/check-frontend.mjs` — l'allowlist ne contient plus que
les 7 pages portail (mock consenti, backend KamaLoka CC séparé). Toute
page applicative hors allowlist ne peut plus importer de fixtures.

Légende : ✅ réel et testé · 🟡 partiel (à compléter) · ❌ mock/store ·
n/a sans objet · 🔍 à vérifier écran par écran.

## Application (chrome authentifié)

| Route | GET réel | Écriture réelle | Permissions | Erreurs | Persistance | Audit | E2E |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/home` | ✅ /overview + session + risques | n/a (liens) | n/a | ✅ | ✅ | n/a | ✅ frontend-real |
| `/ask` | ✅ POST /ask | ✅ | ✅ clause d'accès | 🔍 | ✅ (mémoires) | ✅ | 🟡 |
| `/brain` | ✅ /memories (limit 200) | n/a (lecture) | n/a | ✅ | ✅ | n/a | ✅ frontend-real |
| `/brain/:id` | ✅ | ✅ verify/deprecate/contradicted (déclenche le trigger de résolution) | ✅ | ✅ | ✅ | ✅ | 🟡 |
| `/people` | ✅ | ✅ POST /employees (formulaire + rôle) | ✅ 403 auditeur affiché | ✅ | ✅ refresh vérifié | ✅ | ✅ frontend-real |
| `/people/:id` | 🟡 | ❌ | 🔍 | ❌ | ✅ | n/a | ❌ |
| `/roles` | ✅ | n/a (lecture — pas de création V1) | n/a | ✅ | ✅ | n/a | 🟡 |
| `/roles/:id` (Role Brain) | 🟡 | ❌ | 🔍 | ❌ | ✅ | n/a | ❌ |
| `/sources` | ✅ sources + documents | n/a (via new) | n/a | ✅ | ✅ | n/a | 🟡 |
| `/sources/new` | n/a | ✅ POST /sources/upload (fichiers + texte, résultats réels) | ✅ | ✅ | ✅ | ✅ ingestion | ✅ frontend-real |
| `/knowledge-risk` | ✅ service risk complet | n/a | n/a | ✅ | ✅ | n/a | 🟡 |
| `/handovers` | ✅ liste API + recherche/filtre | n/a (création via new) | 🔍 | ✅ | ✅ | 🟡 | ✅ handover-ui |
| `/handovers/new` (+ /:employeeId) | ✅ employés réels | ✅ POST /handovers (anti double-submit) | ✅ rôle gate | ✅ | ✅ | ✅ | ✅ handover-ui |
| `/handovers/:id` (détail/pack) | ✅ | ✅ pack/successeur | 🔍 | ✅ | ✅ | ✅ | ✅ handover-e2e |
| `/handovers/:id/interview` | ✅ gaps réels | ✅ réponses persistées | 🔍 | ✅ | ✅ | ✅ | ✅ handover-ui |
| `/onboarding` | 🟡 | n/a | 🔍 | ❌ | ✅ | n/a | ❌ |
| `/onboarding/:id` | 🟡 | 🟡 progression | ✅ (employé/manager) | ❌ | ✅ | ✅ | 🟡 continuity-ui |
| `/agents` | ✅ liste + compteurs | ✅ status (anti double-clic) | ✅ | ✅ | ✅ refresh vérifié | ✅ | ✅ frontend-real + battery |
| `/agents/new` | ✅ catalogue réel | ✅ POST /agents (validation, anti double-submit) | ✅ owner/admin | ✅ | ✅ | ✅ agent.created | ✅ battery (D) |
| `/agents/:id` | ✅ agent + runs + triggers + usage | ✅ status/run/budget/triggers | ✅ role gates | ✅ | ✅ | ✅ | ✅ battery (D) |
| `/automations` | ✅ GET /triggers | ✅ toggle persistant | ✅ manager+ | ✅ | ✅ refresh vérifié | n/a | ✅ frontend-real |
| `/approvals` | ✅ GET /approvals | ✅ approve/reject | ✅ | ✅ | ✅ | ✅ | ✅ cycle E2E |
| `/activity` | ✅ GET /audit | n/a | n/a | ✅ | ✅ | ✅ | 🟡 |
| `/integrations` | ✅ | 🟡 | ✅ admin | ❌ | ✅ | ✅ | 🟡 |
| `/settings` | ✅ session/org/ai/backup/security/users/invitations | ✅ org update, invites, AI models, backup, triggers | ✅ role gates serveur | ✅ | ✅ refresh vérifié | ✅ | ✅ frontend-real |
| `/billing` | ✅ | ✅ import licence | 🔍 | ❌ | ✅ | 🟡 | ✅ billing |

## Surfaces autonomes

| Route | État | Notes |
| --- | --- | --- |
| `/login` | ✅ réelle (+ forgot-password réel, pré-remplissage gated ALLOW_MOCK_DATA) | |
| `/setup` | ✅ API réelle | |
| `/portal/*` | 🟡 mock consenti | Backend = Control Center KamaLoka (projet séparé) — les 7 seules entrées allowlistées |

## État de la phase

- ✅ `/approvals` (étape 1) · ✅ domaine Handover (étape 2) · ✅ onboarding/Role
  Brain/employee detail (étape 3) · ✅ agents complet (étape 4) · ✅ settings
  (étape 5) · ✅ sources/home (étape 6) · ✅ pages partielles + layout (toutes
  les pages applicatives sont branchées).
- ✅ `test:frontend-real-data` (étape 7) : 13/13 — login refusé, KPI réels,
  création + persistance, 403 affiché, upload LLM réel, kill switch,
  renommage, trigger, console clean.

Reste avant Golden E2E : les 🟡/❌ ciblés ci-dessus (people/:id écritures,
roles/:id, onboarding list, ask E2E complet, integrations erreurs) — plus
aucune page mockée.

## Gate de sortie de la phase

```
Allowlist = 7 fichiers portail uniquement (mock consenti CC KamaLoka)
0 mock en production (garde runtime + build)
0 bouton mort · 0 faux CRUD · 0 donnée métier hardcodée
test:frontend-real-data ✅ 13/13 · build ✅ · test:battery ✅
test:handover-e2e ✅ · test:handover-ui ✅
```

Ensuite seulement : Golden E2E externe (Drive → Activepieces → ingestion →
Mem0 → Ask cité → Mastra → Approval → Gmail → audit), puis VPS vierge.

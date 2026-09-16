# Product Action Audit — Companion

## Résumé
15 des 27 routes ont des boutons morts, des mocks ou des actions non connectées.
Le reste de ce document détaille chaque route, chaque action attendue et son état.

## Table

| Route | Buttons | API Calls | Mocks | Dead | Actions manquantes |
|---|---|---|---|---|---|
| /agent-detail | ✓ | 0 | 1 | 0 | Runs réels, cost, edit agent |
| /agent-new | ✓ | 0 | 0 | 0 | POST /api/agents (create réel) |
| /approvals | ✓ | 0 | 1 | 0 | Approve/reject réel (déjà branché, mock fallback) |
| /automations | ✓ | 0 | 0 | 0 | Create/edit/delete automations réels |
| /handover-detail | ✓ | 4 | 2 | 0 | Cancel/archive handover |
| /integrations | ✓ | 0 | 2 | 0 | Connect/disconnect réels, Activepieces status |
| /interview | ✓ | 5 | 4 | 0 | Attachment upload, audio record |
| /onboarding | ✓ | 1 | 1 | 0 | Create onboarding réel |
| /onboarding-detail | ✓ | 0 | 0 | 0 | Mark step done (API), manager notes |
| /people | ✓ | 1 | 1 | 0 | Create/edit modal réel |
| /role-brain | ✓ | 0 | 0 | 0 | Archive/merge role |
| /roles | ✓ | 1 | 1 | 0 | Create role modal réel |
| /settings | ✓ | 0 | 3 | 0 | Persist settings réels |
| /setup | ✓ | 0 | 0 | 0 | POST create org + owner réel |
| /source-new | ✓ | 0 | 0 | 0 | Upload réel |

## Actions critiques manquantes (backend)

| Action | API | Priorité |
|---|---|---|
| Create employee (modal) | POST /api/employees | P0 |
| Edit employee | PATCH /api/employees/:id | P0 |
| Disable/enable user account | POST /api/users/:id/status | P0 |
| Create role | POST /api/roles | P1 |
| Edit role | PATCH /api/roles/:id | P1 |
| Create department | POST /api/departments | P1 |
| Create memory (manual) | POST /api/memories (existe) | P0 |
| Delete source | DELETE /api/sources/:id | P1 |
| Create agent | POST /api/agents (existe via Mastra) | P1 |
| Create automation | POST /api/automations | P2 |
| Delete automation | DELETE /api/automations/:id | P2 |
| Create MCP client | POST /api/mcp/clients (existe) | P1 |
| Password reset | POST /api/auth/forgot-password | P0 |
| Invitation | POST /api/invitations | P0 |
| License upload | POST /api/licenses | P0 |
| Organization settings | PATCH /api/organizations/:id | P1 |
| Profile update | PATCH /api/users/me | P1 |
| Session revoke | DELETE /api/sessions/:id | P2 |

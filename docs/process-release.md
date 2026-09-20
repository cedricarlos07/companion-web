# Process de release — Companion (interne KamaLoka)

> Chaque release est publiée par tag. Le workflow `release.yml` vérifie la
> cohérence, les gates, le build, publie la GitHub Release et enregistre la
> version au Control Center.

## 1. Checklist avant release

- [ ] Les gates locaux passent : `npm run check:sql && npm run check:frontend`
      `npm run typecheck:server && npx tsc --noEmit && npm run build`
- [ ] Les batteries E2E locales passent : `test:battery`, `test:handover-e2e`,
      `test:handover-ui`, `test:frontend-real-data` (+ `test:golden-e2e` si le
      CC est joignable)
- [ ] **DOC À JOUR** (c'est aussi un gate automatique, voir §3) :
      - `docs/guide-utilisateur.md` — tout écran/flux modifié
      - `docs/guide-administrateur.md` — toute variable, endpoint,
        comportement admin modifié
      - `CHANGELOG.md` — entrée `## vX.Y.Z` obligatoire
      - `../control-center/README.md` si l'API CC a changé
- [ ] `package.json` versionné (`npm version patch|minor|major`)

## 2. Publier

```bash
git add -A && git commit -m "release: vX.Y.Z …"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z        # déclenche release.yml
```

Le workflow : cohérence tag ↔ package.json ↔ CHANGELOG → **gate doc** (§3) →
gates + build → GitHub Release (notes du changelog) → enregistrement au
Control Center (variables `CC_RELEASE_URL` / secret `CC_RELEASE_TOKEN`,
sautée proprement si absentes) → les portails clients affichent la version,
les instances la voient via `update-check`.

## 3. Gate documentation (automatique)

Si le diff depuis le tag précédent touche `src/` ou `server/` **sans toucher**
`docs/`, `README.md` ou `CHANGELOG.md`, la release **échoue** avec le message
d'erreur indiquant quel guide compléter. Règle simple :

> code touché ⇒ doc touchée. Un correctif purement technique peut se contenter
> d'une ligne dans le CHANGELOG — c'est alors le `CHANGELOG.md` modifié qui
> fait passer le gate.

## 4. Après publication

- Vérifier la GitHub Release (notes correctes).
- Vérifier `GET <CC>/releases/latest` (ou la console CC → releases).
- Annoncer aux clients : la mise à jour apparaît dans leur app
  (update-check) et sur leur portail ; eux appliquent avec `./update.sh`.
- Si l'API du Control Center a changé : déployer le CC **avant** de tagger
  Companion (le contrat instance↔CC est documenté des deux côtés —
  `server/services/licenses.ts` ↔ `control-center/server/licenses.ts` —
  ne jamais diverger).

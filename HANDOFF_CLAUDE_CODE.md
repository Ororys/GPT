# Passer le relais à Claude Code

## Mise en route

Extraire l'archive `HealthConvergence_Claude_Handoff.zip`, ouvrir son dossier `HealthConvergence` dans Claude Code, puis lui donner le contenu de `PROMPT_REPRISE_CLAUDE.md`. Le fichier `CLAUDE.md` contient les consignes durables.

Sur un ordinateur avec Claude Code installé et authentifié :

```bash
cd HealthConvergence
claude
```

Si vous utilisez Claude Code sur le web depuis un téléphone, placer d'abord ce code dans **un dépôt GitHub privé**, puis connecter ce dépôt à Claude Code. Aucun dépôt GitHub ni compte externe n'a été créé automatiquement pour ce transfert. Ne pas publier l'archive en dépôt public sans revue.

## Ce que contient l'archive

- Backend et tests historiques conservés à la racine.
- `apps/personal` : application complète et migrations PostgreSQL, version 0.3.
- `demo-mobile` : copie du code du site privé, avec son manifeste d'hébergement, son build Worker et ses tests.
- Documents, bilans successifs, captures et logs utiles.

Pas de secret, `.env`, base locale, cookie, node_modules ou métadonnées Git. Les historiques Markdown sont conservés ; l'archive n'est pas un dépôt Git distant et ne transfère pas les accès d'hébergement. Réinitialiser un Git local ou importer dans un dépôt privé est possible après extraction.

## Lancer l'application principale

Node 24+, Docker Compose :

```bash
npm run personal:install
npm run personal:env
npm run personal:db:up
npm run personal:db:prepare
npm run personal:dev
```

Ouvrir `http://127.0.0.1:3000`. Le Compose personnel utilise le port 55433, distinct de l'ancien prototype. Les secrets locaux sont générés, pas récupérés de l'environnement précédent. Ne pas lancer les tests sur un serveur contenant des patients réels.

Sans Docker, configurer une base PostgreSQL 16 dédiée dans les fichiers privés, puis préparer le schéma comme expliqué dans `apps/personal/README.md`.

## Tester

```bash
cd apps/personal
npm run typecheck
npm run lint
npm run format:check
npm test
HC_TEST_ADMIN_URL='<URL privée de la grappe synthétique>' npm run test:pg
npm run build
npx playwright install chromium
HC_TEST_ADMIN_URL='<URL privée de la grappe synthétique>' npm run test:e2e:pg
```

L'URL d'amorçage doit permettre la création et suppression de bases **jetables**. Les tests utilisent un rôle distinct du rôle applicatif. Les résultats antérieurs sont dans les dossiers `docs/personal-sprint-*/evidence` ; Claude devra relancer les tests nécessaires sur son environnement.

## Démo mobile déjà publiée

https://convergence-mobile-demo.waxyphlox4.chatgpt.site

Accès privé au propriétaire, via le compte ChatGPT. Pas de PostgreSQL distant connecté. Les profils sont fictifs et les ajouts sont limités à la session du navigateur.

Pour compiler sa source :

```bash
cd demo-mobile
npm ci
npm test
npm run build
npx tsc --noEmit
```

`dist/server/index.js` contient le Worker et les assets embarqués. Ne pas remplacer le routage de cette version par les imports `next/link`/`next/navigation` du projet principal. Ne pas écraser sa variante de modèle qui accepte `storage=mobile-demo-session`.

## Publication après reprise

Le projet Sites existant est identifié dans `demo-mobile/.openai/hosting.json`. Ne pas créer un deuxième Site ni rendre l'accès public. Le pipeline nécessite une authentification Sites et une version source poussée correspondant exactement à l'artefact. Les clés temporaires ne sont pas incluses.

Claude Code peut développer et tester sans ces droits. Pour mettre à jour ce lien, il faudra un accès Sites approprié ou revenir dans cette conversation avec les changements. Un dépôt GitHub privé ne déclenche pas, à lui seul, ce déploiement. Un futur hébergement Next.js/PostgreSQL sur un sous-domaine Nexorial reste une décision séparée ; aucun DNS n'a été modifié.

## Limites à conserver visibles

Données synthétiques uniquement ; identité fictive ; audit SQL transactionnel ; pas d'OCR, LLM, API fabricant ou conformité revendiquée. Le parseur PDF est un premier chemin natif à format contrôlé. Le rangement des données et la navigation doivent rester inchangés jusqu'à nouvelle demande du fondateur.

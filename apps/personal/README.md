# Convergence Personal 0.6 — PostgreSQL, données synthétiques

Les cinq pages sont raccordées à une base PostgreSQL réelle, sans fallback silencieux. Aucun dossier réel, OCR, LLM ou fournisseur connecté.

## Démarrer

Node 24+, Docker Compose ; depuis ce répertoire :

```bash
npm ci
npm run env:init
npm run db:up
npm run db:prepare
npm run dev
```

Ouvrir `http://127.0.0.1:3000`. Production locale : `npm run build && npm start`. Cela ne rend pas ce prototype utilisable pour des patients réels.

Le Compose utilise PostgreSQL 16, port 55433 en loopback et volume nommé persistant. `.env.local` contient la connexion applicative et une clé de session aléatoire ; `.env.database` contient les identifiants d'amorçage, utilisés seulement par le CLI. Les deux fichiers sont privés et ignorés par Git. L'initialisation refuse d'écraser les fichiers existants. Sans Docker, configurer ces URL vers une base locale dédiée, puis exécuter `db:prepare`. Ne pas exposer le serveur.

Le rôle de connexion doit être `hc_personal_login`, avec mot de passe aléatoire d'au moins 32 caractères. Le serveur refuse superutilisateur, BYPASSRLS, propriétaire ou connexion disposant d'accès direct aux tables. L'administrateur n'est jamais utilisé pour les requêtes métier. La préparation et le seed sont idempotents ; ne pas effacer le volume pour relancer.

Le mode précédent reste disponible en définissant explicitement `HC_PERSONAL_STORAGE=local`. Ses reçus `.local` ne sont pas supprimés mais ne sont pas automatiquement migrés. La démonstration peut être réimportée dans PostgreSQL, sans doublon. Les données et API historiques du dépôt sont conservées séparément.

## Fonctions

Vue d'ensemble, biologie, sport, documents, timeline, paramètres ; clair/sombre, responsive, graphiques interactifs et tableau accessible, source PDF synthétique, détail d'activité, recherche, export et Time Machine descriptive. L'import accepte exclusivement le fichier JSON synthétique fourni. Les PDF sont générés à partir de ce jeu ; aucune extraction PDF/IA n'est simulée.

## Vérifier

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
# URL d'amorçage d'une grappe synthétique dédiée permettant CREATE DATABASE :
HC_TEST_ADMIN_URL='<URL locale privée>' npm run test:pg
npm run build
HC_TEST_ADMIN_URL='<URL locale privée>' npm run test:storage-http
npx playwright install chromium
HC_TEST_ADMIN_URL='<URL locale privée>' npm run test:e2e:pg
npm run test:e2e # mode local explicite dans la configuration de test
```

Les suites SQL créent et détruisent des bases de test isolées et utilisent un rôle distinct du rôle applicatif. Ne jamais pointer les tests sur un serveur contenant des données médicales réelles.

Architecture, bilan et limites : `../../docs/personal-sprint-02/BILAN.md`. L'identité demeure démonstrative ; l'audit SQL n'est pas indépendant d'un appelant compromis. Sauvegarde, restauration, authentification réelle et validations réglementaires restent ouvertes.

## PDF biologiques synthétiques — sprint 03

Extraction native réelle avec unpdf, limitée aux PDF du corpus synthétique identifié par SHA-256. Revue explicite avant intégration transactionnelle PostgreSQL ; PDF original conservé. Aucun OCR, LLM ou analyseur universel de laboratoire. Les unités incompatibles sont bloquées, les références proviennent du document, et une date connue au jour ne devient pas une heure de prélèvement supposée. Voir `../../docs/personal-sprint-03/BILAN.md`.

## Cas limites PDF — sprint 04

Tableau en colonnes reconstitué par coordonnées ; lignes non reprises affichées ; valeurs « < », paramètres répétés et dates multiples ou invalides bloqués avec motif. Trois PDF synthétiques ajoutés à la liste blanche. Voir `../../docs/personal-sprint-04/BILAN.md`.

Si le Chromium de Playwright n'est pas téléchargeable, `HC_PLAYWRIGHT_CHROMIUM=<chemin>` permet d'utiliser un Chromium déjà installé.

## Correction versionnée — sprint 05

Un résultat lu dans un PDF peut être corrigé depuis la fenêtre source (mode PostgreSQL) : même unité, motif obligatoire, nouvelle version immuable. La valeur et le texte lus restent conservés ; la Time Machine affiche la valeur connue à la date choisie. Voir `../../docs/personal-sprint-05/BILAN.md`.

## Doublons entre documents — sprint 06

Lors de la revue d'un PDF, un résultat dont le paramètre a déjà une valeur le même jour (UTC) dans un autre document est signalé et décoché par défaut ; rien n'est fusionné. Voir `../../docs/personal-sprint-06/BILAN.md`.

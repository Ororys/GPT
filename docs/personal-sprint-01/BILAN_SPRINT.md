# Sprint 01 — Convergence Personal

18 novembre 2026. Première vertical slice B2C, données synthétiques uniquement.

## Livraison

Application Next.js/React/TypeScript strict dans `apps/personal` : vue d'ensemble, biologie, sport, documents, timeline et paramètres. Sidebar rétractable, navigation mobile, modes sombre/clair, préférences persistantes. Jeu commun : 7 documents, 36 observations biologiques, 52 activités, 83 nuits ; un import de démonstration ajoute un résultat et son document. Les données des cinq pages proviennent du même dossier.

Graphiques ECharts interactifs : zoom, deux axes, unités, lacunes et tableau accessible. Source PDF accessible depuis un résultat. Recherche et filtres fonctionnels, détails d'activité, export JSON/CSV, Time Machine avec dates d'événement ET de connaissance. Profil secondaire vide. États de chargement, import en cours, erreur et absence de résultats. Aucun score médical ni conseil thérapeutique.

Import JSON limité au fichier synthétique fourni : empreinte, contrôle serveur, provenance, statut à vérifier, reçu local atomique et idempotence. **Aucun OCR, parsing PDF ou modèle IA n'est implémenté.** Les PDF consultables sont générés depuis les fixtures, et non extraits de documents externes.

## Architecture et reprise

Modernisation progressive : API, migrations PostgreSQL 001–006 et tests historiques préservés. La nouvelle application utilise des services autorisés et un adaptateur explicitement synthétique avec reçus locaux ; **elle n'est pas encore raccordée à PostgreSQL**. Ce choix temporaire est visible dans l'interface et documenté, sans remplacer le backend historique par une simulation.

Pas de migration destructive. Pas de compte, fournisseur externe, dépense ou déploiement. Interfaces futures pour extraction, organisations et partage non activées. Voir AUDIT_REPRISE.md et ARCHITECTURE_CIBLE.md.

## Tests réellement exécutés

- Prototype conservé : **45 unitaires, 34 PostgreSQL/HTTP, 7 navigateur réussis**. Les 7 incluent un test de capacité avec réponses interceptées, comme dans v3.1.
- Nouvelle application : **13 tests métier/PDF réussis** et **12 scénarios Playwright réussis** sur le serveur Next de production.
- Vérifications : TypeScript strict, Oxlint, Prettier, build de production ; installation `npm ci` depuis une copie Git neuve puis tests des correctifs finaux dans cette copie.
- Sécurité HTTP : absence de session, accès croisé, origine interdite, hôte inattendu, JSON malformé, fichier modifié et dépassement de taille.
- Axe : aucune violation des règles AA testées sur la vue d'ensemble sombre et claire. Ceci n'est pas un audit d'accessibilité complet.
- Rendu réel à 10 000 points synthétiques, zoom et tableau paginé. Aucune performance chiffrée revendiquée.
- Captures desktop et mobile ouvertes et relues ; défauts de tableau, navigation, contraste et débordement corrigés. Une capture intermédiaire montrait le chargement : attente corrigée dans les tests finaux.
- PDF généré puis relu avec `pdftotext` : valeurs et unité originale µg/L présentes.
- `npm audit` final : **0 vulnérabilité connue**, dépendances de développement incluses. La chaîne de lint initialement vulnérable a été remplacée.

Les logs et captures sont dans `evidence/`. Les premiers échecs de tests ne sont pas cachés : navigateur absent, contrôle Origin à ajuster au Host local, cycle de destruction du graphique/tableau, bouton hors écran, grille mobile, contraste et nonce CSP sur page statique. Les corrections ont été retestées.

## Lancer

Depuis la racine du dépôt, Node 22+ :

```bash
npm run personal:install
npm run personal:dev
```

Ouvrir **http://127.0.0.1:3000**. Aucun PostgreSQL n'est requis pour ce nouvel espace synthétique. L'API historique conserve son propre démarrage PostgreSQL décrit dans README.

Production locale : `npm run personal:build`, puis `npm run personal:start`.

## Limites et prochain sprint

Stockage personnel local mono-processus ; identité démonstrative ; pas de fournisseurs, OCR, IA, import FIT/GPX/TCX ni partage professionnel opérationnel. Les références de laboratoire sont fictives. Jours UTC, données sport/sommeil limitées à 90 jours ; aucune conclusion médicale ou causale. Les préférences d'interface ne sont pas un consentement juridique.

Le relais de prévisualisation partagé a échoué à ouvrir le port ; les tests et captures ont utilisé le serveur local du runner Playwright. Aucun lien public n'est livré. La CI est ajoutée, pas exécutée sur GitHub. Node de session : 24 ; CI configurée sur 22, non exécutée ici. Ni Safari, ni mobiles physiques, ni lecteur d'écran, ni pentest exhaustif.

Prochain sprint recommandé : raccorder les services personnels au PostgreSQL existant par migrations additives, enrichir le registre et la provenance documentaire, avec tests d'isolation ; puis développer le parsing PDF natif français et la revue des candidats, avant OCR/LLM. Les traitements de documents réels restent interdits avant examen juridique, sécurité et réglementaire. Aucune conformité HDS, RGPD ou MDR revendiquée.

## Fichiers

- `apps/personal/src/app` : routes, API, thèmes, contrôle Host et CSP dans `src/proxy.ts`.
- `apps/personal/src/components` : shell, cinq pages, graphiques, modales et primitives réutilisables.
- `apps/personal/src/modules` : modèles, fixtures, services, repository, identité, audit, contrats futurs.
- `apps/personal/tests` : tests métier et navigateur ; configuration, lockfile et outils dans l'application.
- `.github/workflows/personal.yml` : CI de l'espace B2C, indépendante de la CI historique.
- `docs/personal-sprint-01` : audit de reprise, architecture, design, présent bilan et preuves.
- `package.json`, README et documents de suivi racine : commandes et état du nouveau sprint.

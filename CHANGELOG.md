# Sprint 13 / 0.13.0 — 18 novembre 2026

Applications Android et iOS (Capacitor) ouvrant le même serveur que le site ; lecture seule et minimisée de Santé / Health Connect (sommeil, FC au repos, VFC, pas, distance) sous autorisation explicite ; migration additive 009 ; builds natifs en CI (Android réussi). Voir docs/personal-sprint-13/BILAN.md.

# Sprint personnel 12 / 0.12.0 — 18 novembre 2026

Connexion réelle des patients en option (`HC_PERSONAL_AUTH=oidc`) : OIDC code + PKCE, jeton vérifié, double authentification exigée (amr), rattachement contrôlé uniquement (migration additive 008, script opérateur), sujet haché. Fournisseur OpenID local pour les tests. Correction de la redirection de retour (hôte public). Voir docs/personal-sprint-12/BILAN.md.

# Sprint personnel 11 / 0.11.0 — 18 novembre 2026

Règle du jour local (C-01, fuseau du dossier, migration additive 007), axe temporel proportionnel, cinq levers de chaise et masse grasse estimée (protocoles sourcés, aucun seuil). Démo mobile alignée. Voir docs/personal-sprint-11/BILAN.md.

# Sprint personnel 10 / 0.10.0 — 18 novembre 2026

Mesures du centre (tour de taille, PA systolique/diastolique, préhension) en nouvelle catégorie de la page Biologie, sur deux bilans annuels fictifs, avec protocole explicite et sans plage de référence inventée. Résumé et passeport mis à jour. Axe des graphiques : année affichée sur plusieurs années. Démo mobile resynchronisée (sprints 04–10), testée, non republiée. Voir docs/personal-sprint-10/BILAN.md.

# Sprint personnel 09 / 0.9.0 — 18 novembre 2026

Autorisations par entrée de données (PDF, import structuré), versionnées, révocables et appliquées par la base (triggers au point d'entrée, transaction annulée). Migration additive 006, API et bloc dans Paramètres. Voir docs/personal-sprint-09/BILAN.md.

# Sprint personnel 08 / 0.8.0 — 18 novembre 2026

Passeport de qualité (R12) depuis la vue d'ensemble : provenance, unités, laboratoires, obtention, couverture sur 90 jours, plus longue période sans donnée, appareils et notes de comparabilité, sans lecture médicale. Bandeau de qualité corrigé (valeurs calculées). Voir docs/personal-sprint-08/BILAN.md.

# Sprint personnel 07 / 0.7.0 — 18 novembre 2026

Résumé factuel pour consultation en PDF (90 j, 12 ou 24 mois) : valeurs datées et sourcées (document, page, référence du laboratoire, correction), lacunes, couverture de la montre, événements et limites, sans interprétation. Route auditée ; migration additive 005 pour l'événement d'audit. Voir docs/personal-sprint-07/BILAN.md.

# Sprint personnel 06 / 0.6.0 — 18 novembre 2026

Signalement non bloquant des doublons entre documents lors de la revue PDF (même paramètre, même jour UTC, autre document) : migration additive 004, calcul à la lecture, résultat décoché par défaut, rien de fusionné. Voir docs/personal-sprint-06/BILAN.md.

# Sprint personnel 05 / 0.5.0 — 18 novembre 2026

Correction versionnée des résultats lus dans un PDF : migration additive 003, table immuable sous RLS, motif obligatoire, contrôle de version concurrente, historique et Time Machine. Valeur et texte d'origine jamais modifiés. Conflits et mode non PostgreSQL renvoient 409 au lieu de 500. Voir docs/personal-sprint-05/BILAN.md.

# Sprint personnel 04 / 0.4.0 — 18 novembre 2026

Parcours PDF natif consolidé : lignes reconstituées depuis des colonnes, lignes non reprises exposées, valeurs « < » et doublons intra-document bloqués, dates multiples ou invalides refusées, toutes les mentions de dossier contrôlées, titre issu de la date lue. Trois PDF synthétiques ajoutés à la liste blanche ; empreintes des PDF existants verrouillées. Aucune migration SQL, aucun OCR/LLM. Voir docs/personal-sprint-04/BILAN.md.

# Sprint personnel 02 / 0.2.0 — 18 novembre 2026

Persistance PostgreSQL du nouvel espace : schéma additif, RLS, rôles, import concurrent atomique/idempotent, audit et mode local explicite. Configuration privée, volume Compose, CI et tests enrichis. Aucun OCR/LLM ou connecteur réel ajouté. Voir docs/personal-sprint-02/BILAN.md.

# Sprint B2C 01 — 18 novembre 2026

Nouvelle application Next.js/TypeScript dans apps/personal : overview, biologie, sport, documents, timeline, paramètres, thèmes, responsive, provenance, graphiques ECharts et import structuré synthétique. Backend PostgreSQL et comportements historiques conservés. CI, tests, design system et bilan ajoutés. Aucun déploiement ni service externe.

# Complément v3.1 — 15 novembre 2026

- Audit indépendant de la livraison v3.0, rapports initiaux archivés dans docs/audit-v3.0-original/.
- Migration 006 : précision microseconde, rejet des valeurs absentes/nulles, verrou de connexion contre révocation concurrente, refus des révisions non prises en charge.
- Migration DDL/reçu atomique ; tests de rollback, reprise et contrôle d'empreinte.
- Script PostgreSQL local sans effacement, utilisateur non root et secret aléatoire privé.
- Synthèse : refus explicite au-delà du plafond de chargement ; limites UTC et moyenne par échantillon dans le rapport.
- CI PostgreSQL/Chromium ; dossier maître v3.1 ajouté, v3.0 conservé.

# Journal des changements

## 3.0.0 — 15 novembre 2026

Audit complet de la v2.4 puis reprise. Détail des constats : AUDIT_TECHNIQUE.md. Preuves : TEST_REPORT.md.

### Corrigé
- Écriture en base impossible (`digest()` introuvable) — P0-1.
- Frontière SQL reposant sur un superutilisateur, RLS sans politique — P0-2.
- Collision d'identifiants source entre patients — P1-1.
- Refus d'accès non journalisés — P1-2.
- Observations modifiables — P1-3.
- Jeton malformé renvoyant 500 ; date inexistante acceptée — P2-1, P2-2.

### Ajouté
- Migrations 004 et 005, exécuteur de migrations avec contrôle d'empreinte.
- Registre unique des métriques, méthodes et espaces de noms.
- API unique adossée à PostgreSQL : profil, observations, source d'origine, rapport à la demande avec instantané, exports CSV/JSON/Markdown, imports par connecteur simulé, consentements de sources, journal d'accès. Contrat OpenAPI.
- Interface responsive réécrite : synthèse, graphique, filtres, sources, rapport, imports, journal, états vides et d'erreur.
- Contrat de connecteur et interfaces non configurées HealthKit, Health Connect, laboratoire.
- 26 tests d'intégration sur PostgreSQL réel, 6 tests E2E navigateur, 8 tests unitaires.
- Docker : image applicative non privilégiée, `compose.yaml` (base éphémère, migration, application), secrets générés localement.

### Supprimé (conservé dans l'historique git, étiquette `v2.4-baseline`)
- `src/api.mjs`, `pg-store.mjs`, `report-api.mjs`, `synthetic-report-store.mjs`, `report-demo-server.mjs`, `demo-app-server.mjs`, `live-api.mjs`, `live-store.mjs`, `authorization.ts`, `ingestion.ts` et leurs tests ; `viewer/app.html` ; `contracts/types.ts` ; `docker/00_roles.sql`, `docker/04_seed.sql`.

### Déplacé
- Anciens README, rapport final et décisions de sécurité → `legacy/`.

### Inchangé
- `sql/001–003` (historique), outils Python hors ligne et leurs 37 tests, `viewer/HealthConvergence_v1.9.html`.

## 2.4 et antérieures
Voir le dossier maître, sections 16 à l'addendum v2.4.

La génération concurrente du même rapport est sérialisée par verrou consultatif (personne et empreinte), évitant les violations d’unicité.


## Incrément personnel 0.3 — 18 novembre 2026

Voir [le bilan PDF et relais Claude Code](docs/personal-sprint-03/BILAN.md) pour les changements, tests réellement exécutés et limites. Les conclusions historiques restent datées de leurs audits respectifs.

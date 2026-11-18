# Backlog priorisé — après v3.0

Priorité : P1 = avant tout pilote, P2 = avant ouverture, P3 = confort. Les bloquants humains sont dans BLOCKERS.md.

| ID | P | Sujet | Détail | Dépend de |
|---|---|---|---|---|
| S-01 | P1 | Fournisseur d'identité | Remplacer `src/token.mjs` et `/demo/session` par une validation OIDC (JWKS, rotation) | B-01 |
| S-02 | P1 | Lier le sujet à la base | Vérifier la signature du jeton côté base ou isoler un service d'identité ; l'API ne doit plus pouvoir choisir `p_subject` | S-01 |
| D-01 | P1 | Corrections et révisions | Nouvelle version d'un enregistrement via `supersedes_observation_id` ; le rapport n'utilise que la version en vigueur | B-06 |
| D-03 | P1 | Comptes rendus de laboratoire | Alimenter `lab_report` : prélèvement, validation, import, intervalle de référence du laboratoire | B-08 |
| C-01 | P1 | Jour local | Regrouper par jour dans le fuseau d'acquisition, pas en UTC (sommeil, pas) | — |
| C-02 | P2 | Agrégation journalière | Règle par métrique (somme des pas, moyenne de FC) avant la moyenne de fenêtre | — |
| D-02 | P2 | Doublons entre sources | Détecter un même enregistrement venu de deux fournisseurs (T04) | B-08 |
| S-03 | P2 | Limitation de débit, TLS, en-têtes HSTS | Derrière un proxy inverse ; adapter le contrôle `Host` | B-02 |
| S-04 | P2 | Journal externalisé | Copie inviolable de l'audit hors de la base ; durée de conservation | B-03 |
| U-01 | P2 | Accessibilité | Audit WCAG 2.1 AA, lecteur d'écran, tableau alternatif au graphique | — |
| U-02 | P2 | Export PDF du rapport | Aujourd'hui Markdown, JSON, CSV | — |
| U-03 | P2 | Saisie IDE au centre | Formulaire de mesure avec protocole (`measurement_session`) plutôt que CSV | B-07 |
| T-01 | P2 | Lisibilité du code | Formatage automatique, découpage de `src/app.mjs` et `web/app.js`, typage | — |
| T-02 | P2 | Moteur unique | Retirer `longitudinal/report.py`, `importers/`, `viewer/` une fois l'équivalence figée par test | — |
| T-03 | P3 | Intégration continue | Exécuter `test:all` à chaque commit | — |
| T-04 | P3 | Performance | Index et pagination serveur pour `api_whoami`, rapport en flux au-delà de 100 000 observations | — |
| F-01 | P3 | Interface FHIR | Export `Observation` une fois les terminologies validées | B-06 |


## Mise à jour v3.1

- Livré : T-03, workflow `.github/workflows/ci.yml` (exécution GitHub non réalisée).
- D-01 : garde de refus des versions multiples livrée ; vrai flux de rectification toujours P1.
- P1 : inventorier les doublons historiques et pertes de microsecondes avant reprise d'une base v3.0 ; valider une stratégie de rectification sans inventer les données.
- P1 : audit durable hors transaction de l'appelant, associé à S-02/S-04. Un refus SQL suivi de ROLLBACK n'est pas conservé.
- C-01 reste ouvert : choix du fuseau patient absent ; ne pas inventer une règle à partir d'un simple décalage numérique.
- P2 : tester sauvegarde/restauration et migration d'une base persistante, charge, échec réseau, concurrence rapports ; plafonds et pagination UI.
- P2 : figer les images Docker et actions CI par empreintes, automatiser la surveillance de dépendances. `npm ci` repose déjà sur le lockfile.


## Suite du sprint B2C — 18 novembre 2026

- P1 : raccorder le service personnel au PostgreSQL existant, avec migrations additives, registre enrichi et tests d'isolation ; l'adaptateur actuel est synthétique/local.
- P1 : pipeline documentaire : stockage privé, parsing natif, candidats sourcés et revue ; ensuite OCR/LLM sous abstraction et banc mesuré.
- P1 avant tout usage réel : identité, consentements, rétention, hébergement et évaluation réglementaire.
- P2 : isoler davantage activités/sommeil, import FIT/GPX/TCX, règles de comparaison et fuseaux validées.
- P2 : accessibilité complète, navigateurs supplémentaires, sauvegarde/restauration et tests multi-instance.


## Mise à jour personnelle 0.2

Raccordement PostgreSQL et tests SQL/E2E livrés. Restent : rapprochement contrôlé avec le schéma historique (pas de fusion automatique), normalisation progressive des charges utiles, identité réelle, journal indépendant et sauvegarde/restauration. Prochain incrément prioritaire : parsing PDF natif synthétique, stockage privé et revue des candidats sourcés ; OCR/LLM seulement ensuite.


## Incrément personnel 0.3 — 18 novembre 2026

Voir [le bilan PDF et relais Claude Code](docs/personal-sprint-03/BILAN.md) pour les changements, tests réellement exécutés et limites. Les conclusions historiques restent datées de leurs audits respectifs.

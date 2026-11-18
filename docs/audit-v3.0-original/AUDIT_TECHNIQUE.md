# Audit technique — Health Convergence v2.4

**Date :** 15 novembre 2026 · **Objet audité :** archive `MedTech_HealthConvergence_ProductPrototype_v2.4` (étiquette git `v2.4-baseline`).
**Méthode :** lecture intégrale du code et du SQL, exécution des suites existantes, puis **première exécution réelle** des migrations 001–003 et de `npm run test:pg` sur PostgreSQL 16. Les numéros de ligne renvoient aux fichiers de `v2.4-baseline` (`git show v2.4-baseline:<fichier>`).
**Portée :** données synthétiques uniquement. Cet audit n'est ni un test d'intrusion, ni une revue indépendante, ni une évaluation de conformité HDS/RGPD/MDR.

## 1. Vérification des affirmations des anciens rapports

| Affirmation (source) | Résultat de la vérification |
|---|---|
| « Tests moteurs/API réussis » (RAPPORT_FINAL_v2.4) | **Confirmé** : 58 tests passent à l'identique (3 + 12 Node/TS, 37 Python, 1 rapport, 5 live). |
| « Frontière de fonctions SQL » livrée en v1.5/v1.6 (dossier §19–20) | **Infirmé** : jamais exécutée ; à la première exécution, l'écriture échoue à 100 % (P0-1) et `npm run test:pg` échoue (`500 !== 201`). |
| « Schéma fermé par RLS » (dossier §17.2, SECURITY_DECISIONS) | **Trompeur** : aucune politique n'existe ; le schéma ne « fonctionne » que parce que tout s'exécute en superutilisateur (P0-2). |
| « Contrainte d'unicité globale retirée » (003, l. 8–10) | **Infirmé** : le `DROP CONSTRAINT` vise un nom inexistant et ne supprime rien (P1-1). |
| « Refus des accès inter-patients » par l'API live (v2.2) | **Confirmé mais hors base** : la décision est prise par une `Map` JavaScript, pas par PostgreSQL (P0-3). |
| « Les permissions ne dérivent jamais d'un rôle auto-déclaré » | **Confirmé** : seul `sub` est lu dans le jeton (`src/token.mjs:14-15`). |
| « 12 séries, 11 comparaisons, SpO₂ non comparée » | **Confirmé**, et recoupé avec le rapport Python v1.8 (mêmes écarts). |
| « Interface non validée visuellement » | **Confirmé** ; désormais testée dans Chromium (voir TEST_REPORT.md). |

## 2. Problèmes classés

### P0 — bloquants, corrigés dans cette session

| ID | Constat | Preuve | Correctif |
|---|---|---|---|
| P0-1 | **Toute écriture en base échoue.** `insert_synthetic_measurement` appelle `digest()` (pgcrypto, schéma `public`) avec `search_path=pg_catalog,hc`. | `sql/003_api_boundary.sql:41,56` ; erreur réelle : `function digest(text, unknown) does not exist`. | Fonction retirée ; empreinte par `sha256()` natif (`sql/005`). |
| P0-2 | **Frontière de sécurité fictive.** RLS forcée sans aucune politique ; fonctions `SECURITY DEFINER` détenues par le superutilisateur `BYPASSRLS` créé par Docker. Avec un propriétaire normal, plus rien ne serait lisible. | `sql/001_init.sql:135-140` ; `compose.yaml:5` ; requête réelle : `hc_migration_owner rolsuper=t rolbypassrls=t`, propriétaire des 3 fonctions. | Propriétaire `hc_owner` non privilégié, politiques RLS réelles avec portée par personne (`sql/004`). |
| P0-3 | **Le produit ne passe pas par la base.** L'interface, l'API live et l'API de rapport lisent un fichier JSON ; l'autorisation est une liste en mémoire. Le chemin PostgreSQL n'accepte que 4 métriques, dont aucune n'est celle du rapport (`HEART_RATE` contre `RHR`). | `src/demo-app-server.mjs:12` ; `src/live-store.mjs:9` ; `src/live-api.mjs:23-25` ; `src/api.mjs:31` ; `sql/003:47`. | Un seul serveur adossé à PostgreSQL ; toutes les décisions d'accès en base. |

### P1 — importants

| ID | Constat | Preuve | État |
|---|---|---|---|
| P1-1 | Collision inter-patients : unicité globale `(source, identifiant, version)` sans patient, jamais supprimée. Deux patients ne peuvent pas partager un identifiant source ; l'erreur révèle l'existence d'un enregistrement chez autrui. | `sql/003:10` ; contrainte réelle `…_source_record_id_in_key` toujours présente. | Corrigé + test de non-régression. |
| P1-2 | Les refus d'accès ne sont pas journalisés : l'`INSERT` d'audit est annulé par le `RAISE` qui suit. Contredit la décision n° 4 de SECURITY_DECISIONS. | `sql/003:32-33` (reconnu l. 82) ; mesuré : 0 ligne `denied_read`. | Corrigé (retour de statut, sans exception). |
| P1-3 | Observations modifiables et supprimables (aucun trigger). | `sql/001:59-85` ; dossier §17.2. | Corrigé (UPDATE/DELETE/TRUNCATE refusés). |
| P1-4 | Quatre vocabulaires de métriques incompatibles. | `contracts/types.ts:2-5` ; `src/api.mjs:31` ; `src/live-report.mjs:3` ; `importers/csv_pipeline.py:11-21`. | Corrigé : registre unique en base. |
| P1-5 | Tests non probants : suite PostgreSQL ignorée par défaut et jamais lancée ; tests HTTP sur faux dépôt ; `npm test` n'inclut ni `test:report` ni `test:live`. | `tests/test_pg_integration.mjs:8,16` ; `tests/test_api.mjs:5` ; `package.json:10`. | Corrigé : 26 tests sur PostgreSQL réel, 6 E2E. |
| P1-6 | Secrets en clair et jeton distribué sans contrôle d'hôte (exposé au DNS rebinding). | `docker/00_roles.sql:2` ; `compose.yaml:6` ; `src/demo-app-server.mjs:11,17-24`. | Corrigé : secrets générés localement, contrôle de l'en-tête `Host`. |
| P1-7 | Données de démonstration chargées par l'initialisation du schéma ; « synthétique » n'est qu'un booléen `DEFAULT false`. | `compose.yaml:21` ; `sql/001:13`. | Corrigé : seed séparé, contrainte `CHECK (synthetic)`. |
| P1-8 | Authentification de démonstration (HS256, secret partagé), sans fournisseur d'identité, MFA ni révocation de session. | `src/token.mjs`. | **Non corrigeable ici** → BLOCKERS B-01. |
| P1-9 | `p_subject` est transmis par l'API : un rôle API compromis peut se faire passer pour n'importe quel sujet. | Conception 003 (reconnu l. 83-84). | **Ouvert** → BACKLOG S-02. |
| P1-10 | Aucun flux de correction (compte rendu de laboratoire révisé) : un contenu différent est rejeté, pas versionné. | `supersedes_observation_id` jamais utilisé. | **Ouvert** → BACKLOG D-01. |

### P2 — à traiter

| ID | Constat | Preuve | État |
|---|---|---|---|
| P2-1 | Jeton malformé → 500 ou 400 au lieu de 401. | `src/token.mjs:7,11` ; `src/live-api.mjs:43`. | Corrigé. |
| P2-2 | Date inexistante acceptée (`2026-02-31`). | `src/live-report.mjs:37-38`. | Corrigé. |
| P2-3 | CSP avec `unsafe-inline` ; interface de 17 Ko sur 15 lignes, non maintenable. | `src/demo-app-server.mjs:20` ; `viewer/app.html`. | Corrigé : interface réécrite, CSP stricte. |
| P2-4 | Trois serveurs HTTP redondants, deux moteurs de rapport (Python v1.8, JS v2.1). | `src/api.mjs`, `report-api.mjs`, `live-api.mjs` ; `longitudinal/report.py`. | Serveurs fusionnés ; moteur Python conservé comme outil hors ligne (BACKLOG T-02). |
| P2-5 | Les 8 mesures du centre n'ont pas d'identifiant source dans le jeu v2.0. | `fixtures/report_api_observations_v2.0.json`. | Contourné au seed (identifiant historique). |
| P2-6 | Regroupement par jour en UTC ; moyenne par échantillon et non par jour. | `src/live-report.mjs:13,32`. | **Ouvert** → BACKLOG C-01, C-02. |
| P2-7 | Aucune déduplication entre sources (critère T04). | — | **Ouvert** → BACKLOG D-02. |
| P2-8 | Aucune conversion d'unité, aucun rattachement LOINC/UCUM (critère T02 non satisfait : les unités non canoniques sont refusées). | — | **Ouvert, volontaire** (dossier §17.3) → BLOCKERS B-06. |
| P2-9 | Tables `lab_report`, `measurement_session`, `device` inutilisées : dates de prélèvement et de validation non distinguées. | `sql/001:26-56`. | **Ouvert** → BACKLOG D-03. |
| P2-10 | Ni limitation de débit, ni TLS (boucle locale seulement). | — | **Ouvert** → BACKLOG S-03. |

### P3 — mineurs

- En-tête du dossier maître resté à « 2.0 » alors que le contenu allait jusqu'à v2.4 (corrigé en v3.0).
- README annonçant « sans npm install » alors que `pg` est requis ; `tsconfig.json` et `contracts/types.ts` sans usage (supprimés).
- Jeux de 378 et 379 observations aux identifiants différents (`fixtures/observations_v1.3.json`, héritage non utilisé).
- `api_whoami` parcourt toutes les personnes (acceptable en démonstration, à indexer ensuite).

## 3. Synthèse par axe demandé

| Axe | Avant (v2.4) | Après (v3.0) |
|---|---|---|
| 1. Architecture, qualité | 3 serveurs, 2 moteurs, 4 vocabulaires | 1 serveur, 1 registre ; style encore dense (BACKLOG T-01) |
| 2. Tests | 58 tests, aucun sur base ni navigateur | 77 tests dont 26 sur PostgreSQL réel et 6 E2E |
| 3. Migrations, accès effectif | Jamais exécutées ; écriture cassée | 001→005 exécutées ; RLS et droits vérifiés |
| 4. API, authentification | Jeton de démo, erreurs 500 | Jeton de démo durci ; **identité réelle absente** |
| 5. Isolation patients | En mémoire | En base, testée de façon adversariale |
| 6. Validation, unités | Dupliquée, incohérente | En base, par registre ; pas de conversion |
| 7. Idempotence | En mémoire ; SQL cassé | Atomique, idempotente, concurrente, déterministe |
| 8. Traçabilité | Aucune en base | Provenance, empreintes, instantanés de rapport |
| 9. Calculs longitudinaux | Corrects sur le jeu fictif | + dates validées, dossier vide ; limites UTC ouvertes |
| 10. Frontend | Non testé | Réécrit, responsive, testé dans Chromium |
| 11. Dette | Élevée | Réduite ; héritage Python conservé |
| 12. Intégrations futures | Aucune interface | Contrat de connecteur + 3 interfaces non configurées |

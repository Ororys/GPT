# Rapport de tests indépendant — v3.1

15 novembre 2026. Les anciens résultats sont archivés dans `docs/audit-v3.0-original/TEST_REPORT.md`. Aucun résultat ci-dessous ne vient seulement d'une affirmation du développeur précédent.

## Environnement

Debian 13, utilisateur non root, Node 24.22.1, npm 11.9.0, Python 3.13. PostgreSQL **16.11 compilé localement**, pgcrypto lié à libcrypto ; Chromium **153.0.8010.12**, Playwright du lockfile. Docker, sudo et PostgreSQL étaient absents à l'arrivée. La première tentative a échoué sur une liaison pgcrypto manquante (`EVP_cast5_cbc`) ; la bibliothèque locale a été reliée à libcrypto, sans changer les migrations pour contourner l'extension. Les résultats ci-dessous ont ensuite été obtenus sur ce serveur réel.

## Reproduction de la livraison v3.0

Copie issue de `git archive HEAD` du dépôt fourni, sans correctifs, dépendances du lockfile. `HC_TEST_ADMIN_URL` pointe vers une grappe synthétique dédiée.

| Suite originale | Réussis | Échecs / ignorés |
|---|---:|---:|
| Node unitaires | 8 | 0 / 0 |
| Python hérités | 37 | 0 / 0 |
| PostgreSQL et HTTP | 26 | 0 / 0 |
| Chromium, parcours réels | 6 | 0 / 0 |
| Total | **77** | **0 / 0** |

Preuve : `docs/test-evidence/baseline-v3.0.log`.

Ces tests confirment les migrations neuves, droits SQL/RLS, isolation, révocations séquentielles, immuabilité des opérations ordinaires, atomicité/idempotence des imports, imports identiques concurrents et audit des refus en autocommit. Ils ne couvrent pas toutes les garanties annoncées.

## Nouveaux tests sur la version non corrigée

Les quatre tests `v3.1` de test_pg_import ont été exécutés sur la copie v3.0 avec `node --test --test-name-pattern='v3.1' tests/regressions.mjs` : **4 échecs attendus**, démontrant valeur absente non traitée, perte de microsecondes, révocation concurrente non synchronisée et double comptage de versions. Un test synchronisé de rapports simultanés échoue aussi : **5 appels sur 6** subissent une violation d'unicité.

Preuves : `baseline-new-import-tests.log`, `baseline-report-concurrency.log` dans docs/test-evidence/. Ces échecs sont des preuves de défauts anciens, pas des succès de la suite corrigée.

## Version corrigée, clone neuf

Instantané local Git du code corrigé, puis véritable `git clone` dans un répertoire neuf, **npm ci** (sans node_modules préexistant), puis :

```bash
HC_TEST_ADMIN_URL='<URL locale privée de la grappe dédiée>' npm run test:all
```

| Suite finale | Réussis | Échecs / ignorés |
|---|---:|---:|
| Node unitaires | 8 | 0 / 0 |
| Python hérités | 37 | 0 / 0 |
| PostgreSQL/HTTP/migrations | 34 | 0 / 0 |
| Navigateur, parcours réels | 6 | 0 / 0 |
| Navigateur, capacité UI avec réponses interceptées | 1 | 0 / 0 |
| Total | **86** | **0 / 0** |

Preuve : `docs/test-evidence/clean-clone-v3.1.log`. Le test de capacité intercepte uniquement la liste d'observations pour vérifier un plafond UI ; ce n'est **pas** un test de charge PostgreSQL. Les six autres parcours utilisent l'API et PostgreSQL réels.

Les huit tests supplémentaires PostgreSQL couvrent : quatre défauts d'import, concurrence des rapports, rollback volontaire de l'audit (limite résiduelle explicitement attendue), transaction de migration/rollback/reprise/empreinte, mise à niveau d'un schéma 001–005 peuplé vers 006 puis réimport de 378 doublons sans insertion.

## Vérifications supplémentaires exécutées

- Script local : lancement réussi sans root avec PG_BINDIR, répertoire existant refusé, syntaxe `bash -n` correcte. Aucune suppression destructive de l'ancien script exécutée.
- Parcours README sans Docker depuis le clone : env:init, migrations 001–006, seed **378 insertions**, npm start, `/healthz` → HTTP 200 `SYNTHETIC_ONLY` ; migration et seed relancés → **0 insertion, 378 doublons**.
- Captures desktop et mobile 390 px ouvertes et relues ; copies dans docs/test-evidence/. Onglets mobiles défilables ; aucun débordement global constaté dans le test.
- `npm audit --json` : **0 vulnérabilité connue** sur les dépendances installées (dev incluses), résultat conservé. Cela ne constitue pas une revue du code de toutes les dépendances.
- `git diff --check`, vérifications de syntaxe Node des fichiers modifiés et bash : sans erreur.

## Non exécuté / non validé

Docker build/compose (outil absent), GitHub Actions distant (workflow ajouté seulement), Node 22 de la CI (session sur Node 24), PostgreSQL mineure exacte de l'ancien rapport (16.16), Firefox/Safari, vrais mobiles, WCAG/lecteurs d'écran, vrais fournisseurs, vraie authentification, TLS, charge, sauvegarde/restauration, migration de données réelles, pentest exhaustif, sécurité de l'administrateur, certification HDS/RGPD/MDR, validation médicale.

Les pertes de fractions déjà produites par v3.0 ne sont pas réparées. Les versions multiples historiques ne sont pas nettoyées automatiquement. La mise à niveau testée porte sur le jeu synthétique du dépôt, pas sur une base persistante d'exploitation.


## Nouvelle session — sprint B2C du 18 novembre 2026

Suites historiques relancées : 45 unitaires, 34 PostgreSQL/HTTP et 7 navigateur réussis. Nouvel espace : 13 tests métier/PDF et 12 scénarios navigateur réussis ; types, lint, format et build vérifiés. Audit npm final sans alerte connue. Conditions, limites et preuves : docs/personal-sprint-01/BILAN_SPRINT.md et evidence/. Ces résultats ne valident ni une intégration PostgreSQL du nouvel espace, ni un OCR ou fournisseur réel.


## Sprint personnel 02 — 18 novembre 2026

Exécutés : 13 tests métier/PDF, 10 tests PostgreSQL, 2 tests HTTP de refus du stockage, 12 scénarios navigateur sur PostgreSQL et 12 en mode local explicite, tous réussis. Le parcours d'import local a également été revérifié après conservation de son audit. Types, lint, format et build passent. L'API locale démarrée retourne storage=postgresql et les 36 observations du seed. Audit npm sans alerte connue. Preuves : docs/personal-sprint-02/evidence/. Le Compose et la CI distante ne sont pas revendiqués comme exécutés.


## Incrément personnel 0.3 — 18 novembre 2026

Voir [le bilan PDF et relais Claude Code](docs/personal-sprint-03/BILAN.md) pour les changements, tests réellement exécutés et limites. Les conclusions historiques restent datées de leurs audits respectifs.

# Convergence Personal 0.2 — PostgreSQL

Le nouvel espace B2C conserve les cinq pages et utilise maintenant PostgreSQL par défaut.

```bash
npm run personal:install
npm run personal:env
npm run personal:db:up
npm run personal:db:prepare
npm run personal:dev
# http://127.0.0.1:3000
```

Node 22+ et Docker Compose. Le serveur doit rester local et ne recevoir que des données synthétiques. Une installation PostgreSQL locale dédiée peut remplacer Docker : voir [les instructions](apps/personal/README.md).

[Bilan du sprint 02](docs/personal-sprint-02/BILAN.md) · [capture du stockage connecté](docs/personal-sprint-02/evidence/postgresql-settings.png). Le mode fichiers précédent est conservé avec `HC_PERSONAL_STORAGE=local` explicite ; aucune bascule automatique en cas de panne. Aucun OCR, LLM ou fournisseur réel. L'API historique ci-dessous est conservée.

---

# Health Convergence — v3.1 (V1 descriptive, données synthétiques)

**Données fictives uniquement. Aucun usage médical. Aucune exposition réseau.** Ce dépôt n'est conforme à aucun référentiel (HDS, RGPD, MDR) : voir BLOCKERS.md.

## Démarrer avec Docker

```bash
npm install            # outils de test et générateur de secrets
npm run env:init       # crée .env avec des secrets aléatoires locaux
docker compose up --build
```

Ouvrir <http://127.0.0.1:8080/> sur la même machine et choisir un profil fictif.

| Profil | Ce qu'il montre |
|---|---|
| `patient-demo` | Dossier complet : synthèse, historique, rapport, sources, journal d'accès |
| `physician-demo` | Lecture et import pour un patient pris en charge |
| `ide-demo` | Import de mesures sans lecture de l'historique |
| `patient-beta` | Dossier vide (états vides) |
| `founder-demo`, `admin-demo` | Aucun dossier accessible |

Pour essayer un import : profil `ide-demo`, onglet « Sources et imports », fichier `fixtures/csv/lab_demo.csv` (déjà chargé : 6 doublons ignorés).

## Tester

```bash
npm run test:unit   # sans base
npm run test:pg     # PostgreSQL de compose (port 55432) : bases jetables créées puis supprimées
npm run test:e2e    # navigateur ; au préalable : npx playwright install chromium
npm run test:all
```

Sans Docker, installer les binaires PostgreSQL 16 (dont pgcrypto), puis avec un utilisateur **non root** :

```bash
npm ci
npm run env:init
scripts/local-pg.sh /tmp/hc-demo-neuf 55432 # refuse tout répertoire existant
export HC_ADMIN_DATABASE_URL="$(cat /tmp/hc-demo-neuf/admin-url)"
export HC_TEST_ADMIN_URL="$HC_ADMIN_DATABASE_URL"
# Les variables exportées priment sur .env ; on utilise ici la base postgres de la grappe dédiée.
export DATABASE_URL="$(node --env-file=.env -e 'const u=new URL(process.env.DATABASE_URL);u.pathname="/postgres";console.log(u.href)')"
npm run db:migrate
npm run db:seed
npm run test:all
npm start
```

Le fichier `admin-url` est privé et contient un secret local. Arrêter avec
`/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/hc-demo-neuf stop`.
Définir `PG_BINDIR` pour un autre emplacement de binaires. La grappe n'est jamais effacée automatiquement.

## Documents

| Fichier | Contenu |
|---|---|
| AUDIT_TECHNIQUE.md | Audit indépendant de v3.0, défauts et preuves |
| ARCHITECTURE.md | Conception v3.0 et corrections v3.1 |
| SECURITY.md | Modèle de sécurité et risques résiduels |
| TEST_REPORT.md | Ce qui a été exécuté, ce qui ne l'a pas été |
| BLOCKERS.md | Décisions humaines requises |
| BACKLOG_PRIORISE.md | Suite du travail |
| CHANGELOG.md | Changements |
| MedTech_Bordeaux_Dossier_Maitre_v3.1.md | Source de vérité du projet |
| docs/openapi.yaml | Contrat de l'API |

## Revue indépendante v3.1

Résultats et limites : [RAPPORT_FINAL_v3.1.md](RAPPORT_FINAL_v3.1.md). Les preuves d'exécution sont conservées dans `docs/test-evidence/`. Les 77 tests v3.0 ont été reproduits ; la version corrigée passe 86 tests dans l'environnement décrit dans TEST_REPORT.md. Docker et CI distante restent à vérifier. Les révisions d'un identifiant source déjà importé sont refusées jusqu'au vrai flux de rectification.

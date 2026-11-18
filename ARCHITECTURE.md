# Architecture — v3.0

Périmètre : **V1 descriptive, données synthétiques**. Aucun module clinique n'existe dans ce dépôt.

## Vue d'ensemble

```
Navigateur (web/, JS natif, CSP stricte)
        │  HTTP en boucle locale, jeton en en-tête
        ▼
API Node (src/app.mjs)            ← identité seulement (jeton) ; aucune décision d'accès
   ├─ moteur descriptif (src/live-report.mjs, fonction pure et déterministe)
   ├─ connecteurs (src/connectors/) : validation structurelle uniquement
   └─ src/pg-repository.mjs : 1 méthode = 1 fonction SQL
        │  rôle hc_api_login : EXECUTE sur hc.api_* et rien d'autre
        ▼
PostgreSQL 16, schéma hc
   ├─ hc.api_* (SECURITY DEFINER, propriétaire hc_owner non privilégié)
   ├─ hc.authz / hc.guard / hc.audit : autorisation, portée RLS, journal
   └─ tables sous RLS forcée, observations immuables
```

## Principes

1. **La base décide.** L'API transmet le sujet authentifié ; rôle, lien patient, habilitation, validité et révocation sont lus en base à chaque appel.
2. **Un refus n'est pas une exception.** Les fonctions retournent `{"status":"forbidden"}` après avoir journalisé, ce qui rend l'audit des refus durable.
3. **Portée par personne.** Après autorisation, `hc.guard` place l'identifiant de la personne dans un paramètre de transaction ; les politiques RLS des tables de dossier filtrent dessus. Un oubli de filtre dans une fonction ne peut pas exposer un autre dossier.
4. **Validation à un seul endroit.** Métrique, méthode, unité, bornes de plausibilité et horodatage sont vérifiés en base contre `hc.metric_definition` et `hc.metric_method`.
5. **Imports atomiques et idempotents.** Clé `(personne, espace de noms, identifiant source, version)` ; empreinte SHA-256 du contenu normalisé ; même contenu = doublon ignoré, contenu différent = conflit ; identifiant d'observation déterministe ; verrou consultatif par personne et source.
6. **Rapports traçables.** Le rapport est une fonction pure des observations autorisées et des paramètres. Son empreinte, ses paramètres et la liste exacte des observations sont enregistrés (`hc.report`, `hc.report_observation`).
7. **Démonstration séparée.** Les migrations ne contiennent aucune donnée ; `scripts/seed-demo.mjs` charge le jeu fictif par la vraie fonction d'import et exige `HC_SYNTHETIC_ONLY=true`.

## Arborescence

| Chemin | Rôle |
|---|---|
| `sql/001–003` | Historique v1.3–v1.6, conservé tel quel (jamais modifié après application) |
| `sql/004_hardening_registry.sql` | Rôles, RLS, immuabilité, registre des métriques, verrou synthétique |
| `sql/005_api_functions.sql` | Frontière d'API |
| `scripts/migrate.mjs` | Applique les migrations une fois, avec contrôle d'empreinte |
| `scripts/seed-demo.mjs`, `seeds/` | Jeu fictif |
| `src/app.mjs`, `src/server.mjs` | API HTTP et point d'entrée |
| `src/connectors/` | Contrat de connecteur, CSV simulés, interfaces non configurées |
| `web/` | Interface |
| `docs/openapi.yaml` | Contrat de l'API (servi sur `/api/v1/openapi.yaml`) |
| `tests/` | Unitaires, intégration PostgreSQL, HTTP, E2E |
| `importers/`, `longitudinal/`, `scripts/normalize_demo.py`, `viewer/`, `legacy/` | Héritage hors ligne v1.3–v2.4, non utilisé par le produit |

## Pourquoi ces remplacements

| Avant | Après | Gain démontré |
|---|---|---|
| 3 serveurs HTTP (ingestion, rapport figé, live) | 1 serveur | Une seule surface à sécuriser et à tester |
| Autorisation en mémoire (Map, TypeScript) et en SQL non exécuté | SQL seul, exécuté | Une seule source de vérité, testée de façon adversariale |
| 4 vocabulaires de métriques | 1 registre en base | Le test vérifie 13 métriques, partagées par l'import, l'API et le rapport |
| Tests sur faux dépôts | Tests sur PostgreSQL réel | Les défauts P0-1, P0-2, P1-1, P1-2 étaient invisibles avant |

## Préparation des connecteurs réels

Un connecteur produit des enregistrements normalisés ; il ne décide jamais des droits. `apple_healthkit`, `android_health_connect` et `lab_hl7_fhir` sont déclarés `not_configured` : prérequis listés, correspondances de types à vérifier sur appareil, appel refusé (HTTP 501). HealthKit fournit la VFC en SDNN, Health Connect en RMSSD : deux méthodes distinctes du registre, jamais fusionnées.

## Séparation V1 / V2

Aucune fonction, route ou table ne calcule de score, de seuil ou d'alerte. `hc.clinical_module` reste verrouillé par `CHECK (executable_in_v1 = false)`. Un test échoue si une fonction SQL ou une clé de rapport évoque risque, score, alerte ou diagnostic.


## Revue v3.1

La migration 006 remplace seulement l'import et la sérialisation UTC, sans réécrire 001–005. Les microsecondes sont conservées ; les secondes entières gardent leur représentation historique pour préserver l'idempotence des jeux existants. La vérification de connexion active prend un verrou de ligne jusqu'à la fin de transaction : un import attend une révocation en cours ; une révocation attend la fin d'un import déjà autorisé. Les transactions longues doivent donc être bornées côté exploitation.

Une autre version du même identifiant source est refusée (`REVISION_NOT_SUPPORTED`) jusqu'à la conception d'un flux de correction. Ce refus ne résout ni les doublons historiques, ni les doublons entre fournisseurs. L'identité d'un sujet reste fournie par l'API : RLS limite la portée, mais n'authentifie pas ce sujet.

Le migrateur conserve DDL et reçu SHA-256 dans la même transaction, sous verrou consultatif. Les scripts SQL sont des fichiers de confiance avec un seul BEGIN/COMMIT externe. Les échecs de migration annulent DDL et reçu ensemble. Le démarrage local refuse les répertoires existants et génère un secret privé, sans sudo ni suppression récursive.

La CI exécute les trois suites sur PostgreSQL 16 et Chromium. Son ajout n'est pas une preuve d'exécution sur GitHub ; voir les exécutions locales dans TEST_REPORT.md. L'héritage Python reste hors ligne : sa suppression attend une équivalence plus complète, il n'existe pas de deuxième serveur produit actif.

La génération concurrente du même rapport est sérialisée par verrou consultatif (personne et empreinte), évitant les violations d’unicité.


## Sprint personnel B2C — 18 novembre 2026

Application Next.js additionnelle dans apps/personal, sans remplacement du backend historique. Services autorisés côté serveur et adaptateur explicite synthetic-fixture+local-imports. L'interface ne prétend pas interroger PostgreSQL. Architecture et cible de convergence : docs/personal-sprint-01/ARCHITECTURE_CIBLE.md. Aucun schéma existant n'est modifié.


## Sprint personnel 02 — persistance PostgreSQL (0.2)

Le raccordement précédemment ouvert est réalisé pour le nouvel espace, dans un schéma additif `personal`, sans modifier `hc`. Rôles distincts, fonctions API SECURITY DEFINER détenues par un propriétaire non privilégié, RLS forcée, journal SQL et transactions d'import. Le mode par défaut est PostgreSQL ; le mode fichiers est explicite. Aucun fallback. Les charges utiles sont persistées en JSONB avec clés de provenance, colonnes temporelles et index ; la normalisation complète du modèle cible reste à poursuivre. Détails, tests et limites : docs/personal-sprint-02/BILAN.md. Les deux schémas ne sont pas automatiquement fusionnés.

# Rapport de tests — v3.0 (15 novembre 2026)

Seuls figurent ici des résultats **réellement obtenus** dans cette session.

## Environnement d'exécution

- Node.js 22.23.4, Python 3.13, PostgreSQL **16.16** (image `postgres:16-alpine`), Docker 29.9, Chrome for Testing 153 piloté par Playwright 1.63.
- Chaque fichier de test PostgreSQL crée sa propre base jetable, y applique 001→005, charge le jeu fictif par la vraie fonction d'import, puis la supprime.

## Résultats

| Suite | Commande | Tests | Résultat |
|---|---|---:|---|
| Unitaires Node (jeton, CSV, connecteurs, moteur) | `npm run test:unit` | 8 | 8 réussis |
| Héritage Python (normalisation, CSV, rapport v1.8) | inclus dans `test:unit` | 37 | 37 réussis |
| Frontière SQL (droits, RLS, isolation, audit, immuabilité) | `npm run test:pg` | 8 | 8 réussis |
| Imports (idempotence, atomicité, concurrence, validation) | `npm run test:pg` | 9 | 9 réussis |
| API HTTP → PostgreSQL | `npm run test:pg` | 9 | 9 réussis |
| E2E navigateur → API → PostgreSQL | `npm run test:e2e` | 6 | 6 réussis |
| **Total** | `npm run test:all` | **77** | **77 réussis, 0 ignoré** |

Avant correction, sur la même base : `npm run test:pg` d'origine **échouait** (`500 !== 201`).

## Vérifications manuelles

- `docker compose up` : migrations 001→005 appliquées, seed 378 observations, `/healthz` OK, requête authentifiée OK, conteneur applicatif sous l'utilisateur `node`.
- Relance de la migration et du seed : 0 insertion, 378 doublons.
- Le serveur refuse de démarrer avec le rôle de migration ou sans `HC_SYNTHETIC_ONLY=true`.
- Dépôt cloné à neuf, `npm ci`, `npm run test:all` : 77 réussis.
- Captures d'écran relues (elles ont révélé deux défauts d'affichage, corrigés et couverts par un test).
- `npm audit --omit=dev` : 0 vulnérabilité connue (1 dépendance d'exécution, `pg`).

## Critères d'acceptation du dossier maître (§15.5)

| Critère | État | Preuve |
|---|---|---|
| T01 Identité | Couvert | Isolation croisée, même identifiant source chez deux patients |
| T02 Conversions d'unités | **Non couvert** | Aucune conversion : unité non canonique refusée (B-06) |
| T03 SDNN/RMSSD | Couvert | Séries distinctes en base et dans le rapport |
| T04 Doublons entre sources | **Non couvert** | Idempotence par source seulement (D-02) |
| T05 Fuseaux, heure d'été | Partiel | Instant UTC et décalage d'origine conservés ; regroupement par jour UTC (C-01) |
| T06 Couverture | Couvert | Couverture insuffisante → aucune valeur |
| T07 Changement d'appareil | Couvert | L'appareil fait partie de la clé de série |
| T08 Compte rendu sourcé, déterministe | Couvert | Empreinte stable, instantané référencé en base |
| T09 Retrait d'autorisation | Partiel | Arrêt des imports testé ; pas d'effacement ni de révocation fournisseur |
| T10 Contrôle d'accès | Couvert | Administratif et fondateur sans accès, vérifié en base et dans l'interface |

## Ce qui n'a PAS été testé ou validé

- **Construction Docker avec le `Dockerfile` strictement tel que livré** : dans cet environnement, `npm ci` échoue derrière le proxy TLS. L'image a été construite avec une variante n'ajoutant que le certificat du proxy, puis `docker compose up` a été exécuté avec succès (migrations, seed, API, interface). À confirmer sur votre poste.
- L'image PostgreSQL a été tirée d'un miroir (`public.ecr.aws`) car Docker Hub renvoyait 429.
- Firefox, Safari, vrais mobiles ; audit d'accessibilité WCAG ; lecteurs d'écran.
- Test d'intrusion, revue de sécurité indépendante, test de charge, comportement sous gros volumes (> 100 000 observations par dossier : refus explicite).
- Installation sur un PostgreSQL managé où le rôle de migration n'est pas superutilisateur.
- Sauvegarde, restauration, montée de version d'une base existante.
- Tout connecteur réel (HealthKit, Health Connect, Garmin, laboratoire, FotoFinder).
- Toute conformité HDS, RGPD ou MDR : **aucune n'est revendiquée**.

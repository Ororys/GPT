# Health Convergence — Backend Core v1.6

**STRICTEMENT DONNÉES SYNTHÉTIQUES.** Ni application de santé en production, ni conformité HDS/RGPD/MDR ou audit de sécurité. Cette version cumule les fichiers v1.3 à v1.5.

## Exécution des tests sans base

```bash
npm test
```

## Intégration PostgreSQL locale (exécutable sur ton poste avec Docker)

Pré-requis : Docker Engine + Compose v2, Node 22+, accès npm. **Utiliser une machine de développement sans données personnelles.**

```bash
docker compose up -d --wait
npm install
npm run test:pg
# Pour réinitialiser complètement la base jetable :
docker compose down
docker compose up -d --wait
```

`compose.yaml` utilise PostgreSQL 16, stockage tmpfs éphémère, port 55432 accessible **uniquement sur 127.0.0.1**. Les mots de passe de démonstration sont publics et non sécurisés ; ne jamais exposer cet environnement au réseau. La création se fait dans l'ordre 00_roles, 001_init, 002_identity, 003_api, 04_seed. **Le script d'intégration utilise un compte propriétaire uniquement pour les modifications de fixtures et un compte applicatif restreint pour l'API.**

Ce qui est testé par `test:pg` : refus des SELECT directs, impossibilité d'appeler la fonction interne, lecture autorisée uniquement pour le patient concerné, refus inter-patient et fondateur, import IDE autorisé, déduplication, conflit de révision, validation SQL et révocation de grant. Les tests modifient la base jetable et ne doivent PAS être lancés sur une vraie base patient.

## LIMITES NON RÉSOLUES
- Aucun Docker ni PostgreSQL disponible dans l'environnement de génération : **tests PostgreSQL live non exécutés ici**. À faire sur un poste équipé.
- La fonction SQL `SECURITY DEFINER` reçoit une identité issue d'un token de démo, donc **ne constitue pas une identité réelle**.
- Les audits de refus sont annulés lors d'un rollback ; ajouter une journalisation séparée et durcie.
- Il manque : OIDC vérifié, MFA soignants, isolation multi-centres, prise en charge des habilitations, tests de concurrence, rate limiting, sauvegarde et restore, tests d'intrusion, DPIA, HDS, consentements, interopérabilité réelle, certifications éventuelles.
- La V2 clinique reste strictement isolée et non exécutée.
- Les identifiants fixes, mots de passe et tokens sont réservés aux démonstrations sur données fictives.

## Important : validation des SQL
`sql/003_api_boundary.sql` contient maintenant des contrôles explicites des métriques et unités, alignés sur l'API HTTP. Le script de test PostgreSQL doit encore confirmer que ces fonctions et privilèges s'exécutent effectivement comme attendu.


## v1.7 — Imports CSV simulés, sans connexion fournisseur

Exécutable hors ligne, sans Docker, npm ni réseau :

```bash
python3 -m unittest discover -s tests -p 'test_csv_pipeline.py' -v
python3 importers/csv_pipeline.py --wearable fixtures/csv/watch_demo.csv --lab fixtures/csv/lab_demo.csv --out fixtures/imported_v1.7.json
```

**Entrées admises** : CSV synthétiques dans un format conventionnel strict (`record_id,timestamp,metric_code,method_code,value,unit,source_device`). Le fournisseur réel devra disposer de son propre adaptateur et d'une spécification de format. La normalisation conserve source/méthode/unité/date, rejette les métriques inconnues et interdit les conversions silencieuses. `SLEEP` est exprimé en heures, `STEPS` en nombre de pas. Les bornes sont des protections techniques larges, non des seuils médicaux.

**Données de qualité** : couverture temporelle et observations manquantes ; ne constitue pas un score de santé. La VFC SDNN et RMSSD restent séparées. Les valeurs SpO₂ de montre ne sont pas des tests diagnostiques.

**Important** : les observations de l'import v1.7 ne sont pas encore enregistrées dans PostgreSQL ni exposées par l'API v1.6. Ce module est un préparateur indépendant, réservé aux données de démonstration. Les tests SQL réels v1.6 restent bloquants pour l'exploitation.


## V1.8 — Synthèse longitudinale descriptive (offline, démonstration)

```bash
python -m unittest discover -s tests -p 'test_longitudinal.py' -v
python longitudinal/report.py --input fixtures/imported_v1.7.json --center fixtures/demo_v1.2.json --out fixtures/report_v1.8.json --markdown fixtures/report_v1.8.md
```

Compare les 14 premiers et 14 derniers jours de montre si >=7 jours distincts par fenêtre et si les fenêtres ne se chevauchent pas. Compare les deux valeurs extrêmes d'une série clinique à méthode/source/appareil identiques sans prétendre valider une tendance. Chaque comparaison est accompagnée des identifiants des observations effectivement retenues. Le recoupement R01/R05/R07/R10 ne produit aucune inférence médicale. Seules les données synthétiques sont acceptées ; aucune insertion PostgreSQL n'est revendiquée.

## Interface de consultation v1.9 (sans serveur)

Ouvrir `viewer/HealthConvergence_v1.9.html` dans un navigateur moderne. Ce fichier autonome embarque **378 observations synthétiques** (370 observations de la filière CSV v1.7 et 8 mesures fictives du centre) et le rapport de référence v1.8. Aucune requête réseau n'est effectuée. Les filtres par dates, module et provenance **filtrent uniquement l'affichage** ; les 11 comparaisons du moteur v1.8 ne sont pas recalculées par le navigateur.

- Sélectionner une mesure pour afficher une courbe séparant méthode/unité/appareil, puis inspecter une observation via son identifiant.
- Utiliser `Exporter JSON filtré` pour récupérer les seules observations affichées, accompagnées du rapport de référence et des paramètres des filtres.
- L'impression utilise la fonctionnalité native du navigateur. Le contenu reste **purement descriptif**.
- L'interface ne synchronise rien, ne stocke aucune information patient réelle et n'est pas un dispositif médical validé.

Vérification hors navigateur : `python -m unittest discover -s tests -p 'test_*.py'` et compilation syntaxique du script intégré avec `node --check`. L'essai E2E visuel Playwright n'a pas été exécuté : navigateur Chromium absent de l'environnement.

**Limitations explicites** : pas de moteur de comparaison ad hoc après modification de la période ; pas de connexion PostgreSQL ; pas d'authentification ; pas de visualisation certifiée cliniquement ; performances à revalider au-delà du petit jeu de démonstration. Pour de vrais dossiers, ajouter contrôle d'accès côté serveur, hébergement adapté, protections anti-divulgation et validation réglementaire.

## v2.0 — API de consultation descriptive (données synthétiques exclusivement)

La nouvelle couche `src/report-api.mjs` expose le rapport pré-calculé v1.8 et les 378 observations exactement utilisées par la vue v1.9. Consultez `REPORT_API_V2.md`.

```bash
npm run test:report
HC_SYNTHETIC_ONLY=true HC_DEMO_SECRET='change-this-test-secret-at-least-32-chars' npm run start:report-demo
```

Endpoints : `GET /v1/demo/patients/:uuid/report`, `GET /v1/demo/patients/:uuid/observations` (pagination/filtre), `GET /v1/demo/patients/:uuid/observations/:observationId`.

**Ne jamais connecter des dossiers patients réels** : identification et autorisations uniquement simulées, pas d'audit durable, pas de base PostgreSQL réellement testée et pas de validation réglementaire.

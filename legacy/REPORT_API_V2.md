# API de consultation descriptive v2.0 — SYNTHÉTIQUE UNIQUEMENT

## Endpoints

`GET /healthz` ; `GET /v1/demo/patients/:uuid/report` ; `GET /v1/demo/patients/:uuid/observations?limit=50&offset=0&metric=RHR` ; `GET /v1/demo/patients/:uuid/observations/:id`.

- Jeton de démonstration signé obligatoire sur les chemins patients ; le champ `subject` n'est jamais fourni par le client dans le corps.
- Autorisation `read` contrôlée avant la lecture, y compris les détails et le rapport entier.
- Pagination plafonnée à 100 lignes et paramètres filtrés ; réponse `Cache-Control: no-store, private`.
- Aucune publication de rapport du patient dans une page HTML sans authentification.
- Données exclusivement fictives ; stockage local en mémoire et aucun accès à PostgreSQL.
- Les rapports sont **pré-calculés** en v1.8 ; les filtres de l'API ne changent pas leur calcul.
- Aucune API de risque clinique, alerte ou diagnostic.

## Démonstration

Avec Node.js >=22, définir `HC_SYNTHETIC_ONLY=true` et `HC_DEMO_SECRET` (32 caractères minimum), puis exécuter `npm run start:report-demo`.
Un jeton de test peut être créé à l'aide de `mintDemoToken('patient-demo',{secret})` depuis le module `src/token.mjs`. Ne jamais employer ces jetons sur internet ou pour des données réelles.

## Limites à lever avant exploitation

1. Authentification et consentement réels, MFA professionnels et identités certifiées selon contexte.
2. Règles d'accès en base, audit à écriture protégée, tests contre PostgreSQL réel.
3. Infrastructure HDS et exigences RGPD/PGSSI-S appropriées.
4. Analyse de menace, contrôles d'export, minimisation et garanties contre l'accès privilégié.
5. Intégrations de données fournisseurs et validations médicales/réglementaires.

## Cohérence des sources de démonstration

Le fichier `fixtures/report_api_observations_v2.0.json` provient des 378 observations intégrées dans l'interface v1.9, plutôt que de l'ancien export brut v1.3. Une vérification bloquante s'assure que **toutes** les références présentes dans les comparaisons du rapport existent dans cet export. La conservation de l'ancien jeu `observations_v1.3.json` sert à la compatibilité historique, pas à l'API de lecture v2.0.

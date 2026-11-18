# Health Convergence — Prototype cumulatif v2.4

**POUR DONNÉES FICTIVES UNIQUEMENT** — développement/recettage ; aucune utilisation médicale ou accès public.

## Démarrage local (Node.js ≥ 22, sans npm install)

```bash
npm run start:browser-demo
```

Ouvrir `http://127.0.0.1:8092/demo` sur la **même machine**. Le serveur écoute seulement sur `127.0.0.1`. Un token temporaire fictif est émis par `/demo/token` pour l'interface ; **ne pas exposer le serveur sur un réseau** et ne pas copier ce mécanisme en production.

Le serveur restitue les données synthétiques incluses dans `fixtures/report_api_observations_v2.0.json` et recalcule les rapports à la demande.

## Tests sans dépendance externe

```bash
npm run test:live
npm run test:report
node --test tests/test_api.mjs
node --experimental-strip-types --test tests/test_security.ts
python -m unittest discover -s tests -p 'test_*.py'
```

La suite PostgreSQL (`npm run test:pg`) exige Docker / PostgreSQL / dépendances `pg` configurés séparément et n'a pas été exécutée ici.

## Modules

- `src/live-report.mjs` : calcul déterministe, référencé, non clinique ; compatible métriques du jeu fictif.
- `src/live-api.mjs` : consultation live par token de démo ; validation des paramètres / refus des accès non autorisés en simulation.
- `src/live-store.mjs` : dépôt en lecture seule, données synthétiques.
- `src/demo-app-server.mjs` : démonstration HTML locale + token de démonstration, interdit en production.
- `viewer/app.html` : interface responsive de démonstration.
- `tests/test_live_report.mjs`, `tests/test_live_api.mjs` : tests supplémentaires.

## Règles scientifiques

Les rapports affichent **uniquement** des écarts arithmétiques et une provenance. Aucun risque clinique, score médical, diagnostic, triage, causalité ou alertes automatisées. La VFC (SDNN/RMSSD), les unités, appareils et sources ne sont jamais fusionnés. Données manquantes non interpolées. Le suivi biologique peut provenir de sources externes sous conditions à définir ; l'API médicale réelle n'est pas implémentée.

## Productisation / périmètre hors prototype

La solution n'est pas complète au sens commercial ou réglementaire : identité et consentement réels, hébergement santé, contrôle en base de données, conformité MDR/RGPD, contrats médicaux, API fournisseurs, audit d'exploitation et essais navigateurs restent ouverts. Voir `RAPPORT_FINAL_v2.4.md`.

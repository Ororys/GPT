# Reprise du prototype — 18 novembre 2026

Périmètre exécuté : dépôt HealthConvergence v3.1 présent dans le workspace, issu de l'audit précédent. Les modifications non commitées déjà présentes ont été conservées. Aucun reset, écrasement de migrations ou migration destructive.

## Vérifications exécutées dans cette session

Lecture de README, ARCHITECTURE, SECURITY, BLOCKERS, AUDIT_TECHNIQUE ; inspection de package.json, des fixtures, du repository PostgreSQL et du seed. Puis exécution des tests :

- `npm run test:unit` : **8 Node + 37 Python réussis**.
- `npm run test:pg` : **34 réussis** sur PostgreSQL 16.11 réel, bases jetables migrées et peuplées.
- `npm run test:e2e` : **7 réussis**, dont 6 parcours réels et 1 test de capacité avec interception ciblée, comme documenté précédemment.

Les premières tentatives PostgreSQL ont échoué parce que le serveur était arrêté, puis redémarré au port par défaut au lieu de 55432. Après correction du lancement, la suite complète passe. Ces erreurs d'environnement ne sont pas présentées comme des tests applicatifs réussis.

## Briques conservées

`sql/001–006`, fonctions SQL d'autorisation/import et RLS ; `src/pg-repository.mjs` ; registre des métriques ; imports CSV ; rapports descriptifs ; tests adversariaux ; documentation des limites. Le code historique n'est pas remplacé par une simulation. Il reste lancé et testé avec ses commandes existantes.

## Limites vérifiées et dette

L'authentification historique reste démonstrative ; le sujet SQL vient de l'API ; l'audit SQL peut être annulé par l'appelant et n'est pas inviolable face à l'administrateur. Pas de flux réel de rectification, conversion validée, fournisseur actif, jour patient, consentement juridique, sauvegarde/PRA validés ni conformité démontrée. Le registre initial ne contient ni la ferritine ni toutes les données nécessaires au brief B2C. L'interface JS historique est dense et ne constitue pas un design system réutilisable tel quel.

## Modernisation retenue, plutôt qu'une réécriture globale

1. Conserver intégralement la frontière SQL et ses tests.
2. Ajouter `apps/personal`, application Next.js/TypeScript indépendante pour le premier parcours B2C.
3. Isoler calculs, données, services, identité de démo et composants visuels.
4. Utiliser un adaptateur explicitement nommé `synthetic-fixture+local-imports`. Il ne prétend pas utiliser PostgreSQL. Il n'existe aucun basculement silencieux d'une base défaillante vers des fixtures.
5. Au sprint suivant, rapprocher les contrats du nouveau dossier et du registre SQL, puis brancher l'adaptateur PostgreSQL derrière les mêmes services avec les tests d'isolation existants et additionnels.

Deux runtimes coexistent pendant cette transition ; ce n'est pas une architecture cible à conserver indéfiniment. Le coût de cette séparation temporaire est explicite : l'API historique et l'espace personnel ont des jeux de démonstration distincts. Les cinq pages personnelles, en revanche, partagent un même dossier cohérent.

Une réécriture totale aurait perdu des garanties déjà testées. Une simple reskin de l'ancien client aurait imposé trop tôt son schéma limité à toute la nouvelle vision. Le choix retenu permet de valider la vertical slice sans annoncer prématurément une migration métier terminée.

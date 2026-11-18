# Sprint 21 — S-02 : la base vérifie elle-même la session

Date : 18 novembre 2026 (travail autonome). Point P1 du backlog : « l'API ne doit plus pouvoir choisir `p_subject` ».

## Problème

Toutes les fonctions SQL faisaient confiance au sujet transmis par le rôle applicatif. Quiconque détenait le mot de passe de ce rôle (fuite d'environnement, injection SQL) pouvait lire ou écrire n'importe quel dossier.

## Réalisé

- Migration additive **`012_session_proof.sql`** :
  - extension `pgcrypto`, marquée « trusted », donc activable par le propriétaire de la base ;
  - table `personal.session_key` : clé de signature, lisible seulement par les fonctions propriétaires, écrite seulement par l'administrateur, RLS forcée ;
  - `session_proof_ok` vérifie le HMAC-SHA256 du jeton de session, son expiration, et que le sujet **et** le dossier du jeton sont exactement ceux demandés ;
  - `personal.guard` refuse tout appel sans preuve valide (refus journalisé) dès que la clé est installée.
- **Application** : chaque appel PostgreSQL s'exécute dans une transaction qui transmet la valeur du cookie de session signé (`hc.session_proof`). Le format du cookie et sa signature sont inchangés (démonstration et connexion réelle).
- **Activation automatique** : `db:prepare` installe la clé à partir de `HC_PERSONAL_SESSION_SECRET` (déjà généré par `env:init`). Sans ce secret, le comportement reste celui d'avant, notamment pour les bases de test qui ne le fournissent pas.
- Les suites navigateur (PostgreSQL et connexion réelle) tournent désormais **avec la preuve exigée**.

## Vérifications

- Nouveau test SQL : jeton valide accepté ; aucun jeton, jeton pour un autre dossier, contenu modifié, autre clé, jeton expiré, jeton malformé, expiration non numérique : tous refusés et journalisés ; clé illisible par le rôle applicatif.
- Contre-épreuve de bout en bout : serveur et base avec la même clé → 200 ; avec des clés différentes → **403**.
- L'exercice de sauvegarde a détecté que la nouvelle table n'avait pas de RLS forcée ; corrigé avant publication.
- 57 unitaires, 26/26 PostgreSQL, sauvegarde 1/1, stockage HTTP 2/2, navigateur 26/26 (PostgreSQL), 18 + 8 ignorés (local), 6/6 (connexion réelle).

## Limites

- Un attaquant qui contrôle le processus applicatif possède aussi la clé et peut signer des sessions. La protection vise une fuite du seul accès base.
- Les fonctions non gardées (`api_audit`, `api_identity_person`) restent appelables par le rôle applicatif. La seconde ne fait que résoudre une identité déjà rattachée, et sa clé de sujet est un hachage.
- L'audit reste annulable par un appelant qui contrôle la transaction ; il n'est pas externalisé (S-04).

## Complément (même soirée)

- **Clé obligatoire en mode PostgreSQL** : sans `HC_PERSONAL_SESSION_SECRET`, le serveur générait une clé aléatoire, et la base, qui connaît la vraie clé, refusait alors tout avec un « forbidden » trompeur. Il répond désormais `503 SESSION_SECRET_REQUIRED` avec un message explicite dans les journaux. Test HTTP dédié (stockage HTTP : 3/3).
- **CI** : les fichiers de tests PostgreSQL s'exécutent l'un après l'autre. Sur une grappe neuve, deux fichiers créaient en même temps les rôles partagés. Le correctif a été vérifié sur une grappe neuve locale.
- **CI** : l'exercice de sauvegarde utilise les outils clients PostgreSQL 16, alignés sur le serveur.

# Sprint 02 — persistance PostgreSQL réelle

18 novembre 2026 · application personnelle 0.2.0 · données synthétiques uniquement.

## Réalisé

Les cinq pages du sprint précédent utilisent maintenant PostgreSQL par défaut. Documents, observations, activités, nuits et événements sont persistés dans le schéma dédié `personal`. Les imports ont des reçus SQL ; le journal est stocké en base. Les lectures ne reconstruisent plus le dossier depuis les fixtures. Le seed utilise toujours un jeu fictif, mais il est exécuté séparément du serveur.

La configuration en cours a été initialisée sur la grappe PostgreSQL 16.11 locale. Le serveur Next de production a été démarré sur `http://127.0.0.1:3000`. Une requête authentifiée a confirmé HTTP 200, `storage=postgresql`, 7 documents, 36 observations, 52 activités et 83 nuits.

- Migration additive et suivie par SHA-256, DDL et reçu dans la même transaction. Les migrations historiques `hc` ne sont pas modifiées.
- Rôles SQL propriétaire sans connexion et sans BYPASSRLS ; rôle applicatif sans accès direct aux tables ; seules les fonctions API sont exécutables.
- RLS forcée, portée par personne, autorisation en base et révocation effective au prochain appel.
- Transactions d'import, verrou consultatif et unicité : six clients concurrents importent une seule fois.
- Résultats, documents, reçus et journal protégés contre les mutations ordinaires.
- Métadonnées par entité, clés de provenance et index de séries ; les charges utiles restent en JSONB. Ce n'est pas encore le modèle normalisé complet de la vision cible.
- Refus applicatif d'une connexion administrateur et erreur 503 si PostgreSQL est indisponible. Aucun retour automatique aux fixtures.
- Mode local conservé uniquement avec `HC_PERSONAL_STORAGE=local` explicite.
- Indication « PostgreSQL connecté » dans les paramètres et explication du stockage dans l'interface.
- Configuration locale générée sans écrasement : secret de session et URL applicative dans `.env.local`, accès de migration dans `.env.database`, jamais chargé automatiquement par Next.
- Compose PostgreSQL avec volume nommé persistant et publication loopback ; CI enrichie de PostgreSQL et des suites correspondantes.

## Tests exécutés

| Suite | Résultat |
|---|---:|
| Métier/PDF | 13 réussis |
| Intégration PostgreSQL réelle | 10 réussis |
| HTTP : base indisponible / rôle administrateur | 2 réussis |
| Playwright, backend PostgreSQL | 12 réussis |
| Playwright, mode local explicite | 12 réussis |

Les tests PostgreSQL vérifient migrations neuves, privilèges, isolation, RLS, révocation, atomicité sous erreur d'insertion, concurrence, idempotence, immuabilité et reprise du seed sans perdre l'import. Le contrôle d'empreinte des migrations est testé. Les tests HTTP démontrent l'absence de dossier de secours et le refus du rôle administrateur. Les E2E PostgreSQL vérifient aussi la valeur réelle `storage=postgresql` reçue de l'API.

TypeScript strict, Oxlint et build de production passent. Audit npm : résultat dans evidence/npm-audit.json. Les logs des exécutions sont conservés. Les tests du backend historique n'ont pas été relancés dans cet incrément : ses fichiers SQL et runtime n'ont pas été modifiés.

## Lancer depuis une copie neuve

Node 22+ et Docker Compose, depuis la racine :

```bash
npm run personal:install
npm run personal:env
npm run personal:db:up
npm run personal:db:prepare
npm run personal:dev
```

Puis `http://127.0.0.1:3000`. Le PostgreSQL de ce Compose utilise le port 55433, distinct de l'ancien prototype. `personal:env` refuse d'écraser des fichiers existants. Les fichiers privés ne sont pas dans l'archive. Ne jamais utiliser `down -v` pour une base à conserver.

Sans Docker : fournir dans les fichiers privés une base dédiée PostgreSQL 16, une URL administrateur pour la préparation et une URL applicative avec rôle `hc_personal_login` et mot de passe aléatoire d'au moins 32 caractères, puis `personal:db:prepare`. Le serveur ne reçoit pas la variable administrateur.

Le Compose ajouté n'a pas été démarré dans cette session : les tests et le démarrage réel ont utilisé le PostgreSQL 16.11 local. La CI distante n'a pas été exécutée. L'isolation des secrets par UID/conteneur, sauvegardes, restauration et exploitation nécessitent une conception de production séparée.

## Reprise de la v0.1 et limites

Les anciens fichiers `.local` ne sont pas supprimés. Leur reprise n'est pas automatique : activer explicitement le mode local pour retrouver cette démonstration, ou réimporter le même fichier JSON fourni dans PostgreSQL. Le seed ne supprime ni ne remplace les imports existants. Les jeux historiques `hc` et le nouveau schéma personnel ne sont pas fusionnés automatiquement.

L'identité reste fictive ; le rôle API choisit encore le sujet transmis aux fonctions. Le journal est durable en autocommit mais reste annulable par un appelant SQL qui contrôle sa transaction et modifiable par un administrateur. Les triggers ne rendent pas le stockage inviolable. Les rôles de migration ont des privilèges d'amorçage élevés.

L'import reste limité au fichier JSON synthétique fourni, contrôlé par empreinte. Aucun OCR, LLM, fournisseur connecté ou import de document réel n'est ajouté. Aucun score médical, diagnostic ou conformité HDS/RGPD/MDR revendiqué. La V1 reste descriptive.

Prochain incrément : stockage documentaire privé et parsing PDF natif synthétique, avec candidats sourcés et revue, avant tout OCR ou appel à un modèle externe.

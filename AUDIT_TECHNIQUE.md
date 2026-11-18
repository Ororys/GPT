# Audit indépendant de Health Convergence v3.0 — reprise v3.1

15 novembre 2026. Objet : archive fournie `HealthConvergence_v3.0.zip`, dépôt extrait sans données réelles. Revue de code, exécutions sur base neuve, tests adversariaux additionnels. Ce travail n'est pas un pentest exhaustif, une validation médicale ou une certification. Le rapport précédent, portant sur v2.4, reste dans `docs/audit-v3.0-original/`.

## Éléments réellement présents à l'arrivée

Un serveur Node unique utilise PgRepository et les fonctions SQL, contrairement aux anciens serveurs conservés hors ligne. Le registre SQL contient 13 métriques ; le seed synthétique charge 378 observations par la vraie fonction d'import. L'interface utilise un DOM construit avec nœuds texte et une CSP sans scripts inline. Les adaptateurs réels sont explicitement `not_configured`. Les résultats d'exécution indépendante sont dans TEST_REPORT.md ; ils priment sur les affirmations historiques.

## Défauts et preuves

Aucun P0 nouveau démontré dans le périmètre synthétique local. P1 signifie important pour intégrité, sécurité ou avant pilote ; ce classement ne rend pas le prototype utilisable en production.

| ID | Gravité | Défaut v3.0 et reproduction | Traitement |
|---|---|---|---|
| A-01 | P1 | `hc.iso_utc` sérialise uniquement les secondes ; importer `08:00:00.123456Z` stocke `08:00:00Z`. Réimporter `.654321Z` est pris pour un doublon. Test `microsecondes conservées` dans test_pg_import. | Migration 006 : fractions conservées dans canonisation et stockage. Perte historique irrécupérable sans source. |
| A-02 | P1 | `api_import_batch` lit l'état actif sans verrou ; une révocation non validée n'est pas vue et un import peut passer avant sa validation. Test `révocation concurrente` bloque une transaction de révocation puis tente l'import. | Verrou de ligne de connexion ; ordre déterministe avec révocation. Un import déjà autorisé termine avant que la révocation soit validée. |
| A-03 | P1 | Même identifiant source avec version `2` après `1` crée deux observations. Aucun lien de remplacement ni filtre de version dans le rapport. Test `autre version`. | Refus `REVISION_NOT_SUPPORTED` ; vraie correction versionnée reste ouverte. Ne nettoie pas les versions historiques. |
| A-04 | P1 | `scripts/local-pg.sh` exécutait `rm -rf $D` en root, sans garde, avec variables non citées et mot de passe fixe. Preuve statique ; commande destructive volontairement non exécutée. | Réécriture : non root, répertoire neuf uniquement, chemin borné, secret aléatoire privé, aucun effacement. |
| A-05 | P1 | Sujet libre dans les fonctions SQL : le rôle API peut lire en se déclarant `patient-demo`, sans preuve du jeton. Reproduction test_pg_boundary `limite documentée`. | Ouvert S-02/B-01 : identité réelle requise, aucune fausse correction. |
| A-06 | P1 | BEGIN → appel refusé → ROLLBACK annule l'audit. Test_pg_boundary `limite documentée` mesure le compteur avant/après. Les appels HTTP autocommit conservent leurs refus. | Ouvert : journal hors transaction de l'appelant, lié à une identité vérifiable. |
| A-07 | P2 | `jsonb_typeof(value) <> 'number'` vaut NULL pour champ absent ; une erreur de contrainte remplace le rejet structuré. Test `valeurs absentes ou nulles`. | `IS DISTINCT FROM`, lot refusé explicitement ; null de lot/enregistrement également traité. |
| A-08 | P2 | COMMIT du DDL avant INSERT du reçu de migration : interruption entre les deux laisse schéma sans reçu et reprise impossible. Preuve structurelle dans ancien migrate.mjs. | Même transaction pour DDL/reçu, test de rollback/reprise/idempotence/empreinte. La coupure exacte après COMMIT n'a pas été injectée. |
| A-09 | P2 | `fetchAll` renvoie silencieusement après offset > 20000 : synthèse partielle alors que rapport/export peuvent utiliser 100000 observations. | Échec explicite du chargement ; plafond UI reste une limite de capacité. |
| A-10 | P2 | Moyenne par échantillon, jours UTC, aucune règle d'agrégation journalière, qualité/exclusions non gérées par un workflow. | Limites UTC et moyenne ajoutées au rapport ; règles patient/métrique restent ouvertes. |
| A-11 | P2 | Images Docker sur étiquettes mobiles ; actions CI sur tags ; pas de restauration, charge ou exploitation vérifiée. | Lockfile/npm ci présents, CI ajoutée ; épinglage et exploitation au backlog. |
| A-13 | P1 | Deux générations simultanées du même rapport passent le SELECT puis INSERT ; cinq appels sur six échouent sur `report_person_sha_key` lors du test synchronisé `rapports identiques concurrents`. | Verrou consultatif par personne/empreinte avant sélection et création ; test de non-régression. |
| A-12 | P3 | Jeux hérités de 378/379 lignes, deux moteurs descriptifs (Python hors ligne et JS produit), en-têtes documentaires historiques. | Périmètre clarifié ; historique conservé, aucune équivalence générale prétendue. |

## Portée des garanties

- RLS et fonctions : la portée dépend d'un paramètre de transaction posé par guard ; le rôle API n'a pas de lecture directe. Le propriétaire peut changer les règles et un superutilisateur les contourner. Les triggers ne sont pas une preuve d'inviolabilité administrative.
- SQL injection : paramètres liés pour les données métier, noms de rôle bornés et identifiants cités dans le migrateur. Tests d'entrées hostiles existants ; aucun fuzzing exhaustif.
- XSS : nœuds texte, CSP, pas d'innerHTML dans le client actuel. Exports CSV préfixés contre formules ; compatibilité avec tous les tableurs non démontrée.
- CSRF : bearer explicite, pas de cookies de session ni CORS ouvert ; endpoint de démo JSON et contrôle Host. L'authentification reste fictive.
- SSRF : aucun fetch sortant fournisseur ni URL utilisateur récupérée ; les futurs adaptateurs devront être évalués séparément.
- Docker : ports loopback, application non root, système de fichiers applicatif en lecture seule, capacités supprimées ; base éphémère, secrets d'environnement lisibles aux administrateurs locaux. Docker absent de cette session : aucune validation runtime Docker indépendante.
- Mesures : unités/méthodes/bornes techniques contrôlées, pas de conversion ni validation clinique. Le booléen synthetic ne détecte pas des données réelles.
- Rapports : déterminisme et références vérifiables ; aucun score médical. L'empreinte est fournie par l'API à la base : elle ne prouve pas à elle seule que le moteur est digne de confiance. Les documents complets ne sont pas archivés dans la table report.

## Reproduire

Suivre README pour une grappe dédiée. `npm ci`, `npm run test:all`. Les tests de non-régression ajoutés à test_pg_import permettent de comparer le code corrigé avec la copie v3.0 sans migration 006. Ne jamais viser une base contenant de vraies données. Preuves d'exécution et limites précises : TEST_REPORT.md.

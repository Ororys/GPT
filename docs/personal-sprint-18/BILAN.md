# Sprint 18 — Export complet des données (droit d'accès et portabilité)

Date : 18 novembre 2026 (travail autonome).

L'export JSON ne contenait que le dossier affiché. Il contient désormais tout ce qui est stocké pour ce dossier, sous la clé `export` (format `convergence-export`, version 1). La forme du haut de fichier ne change pas, ce qui garde la compatibilité.

- Migration additive **`011_full_export.sql`** : `api_export_extras`, en lecture seule, protégée par la garde de sujet et par RLS.
- Contenu ajouté : identités rattachées au dossier (sujets hachés, actives ou non), historique des autorisations, PDF importés avec leur proposition d'extraction et la sélection revue, reçus d'import, **données brutes du téléphone**, **journal d'activité du dossier** (événements d'audit dont le dossier est la cible).
- Les corrections versionnées figuraient déjà dans les observations exportées.
- En mode fichiers local, une note indique que seul le dossier est exporté.
- Le texte de la page Paramètres décrit le contenu réel de l'export.

Vérifications : 25/25 PostgreSQL (contenu complet, cloisonnement : le profil Camille n'exporte rien d'Alex, accès croisé refusé), navigateur 25/25 sur PostgreSQL, 17 + 8 ignorés en local, 6/6 connexion réelle, 52 unitaires.

**Limites** : l'export n'est pas signé et n'est pas encore au format FHIR (B-06 : terminologies à valider). Les octets des PDF importés ne sont pas inclus dans le JSON ; ils restent téléchargeables un par un.

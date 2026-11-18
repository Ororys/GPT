# API de l'espace personnel (`apps/personal`)

Référence pour l'application mobile, un futur hébergement et la revue de sécurité. Toutes les routes sont sous `/api`, même origine que les pages. Données synthétiques uniquement.

## Règles communes

- **Session** : cookie `hc_personal_demo`, HttpOnly, `SameSite=Strict`, signé (HMAC-SHA256), 1 heure. Il est ouvert par `/api/session` en mode démonstration, ou par `/api/auth/callback` en connexion réelle (`HC_PERSONAL_AUTH=oidc`). Le même jeton sert de preuve à la base de données (S-02, sprint 21).
- **Écritures** (`POST`) : l'en-tête `Origin` doit correspondre exactement à l'hôte servi, faute de quoi la réponse est 403.
- **Hôtes** : seuls les hôtes de `HC_PERSONAL_ALLOWED_HOSTS` sont servis (421 sinon).
- **Erreurs** : corps `{"error": "<CODE>"}`.

| Statut | Codes |
|---|---|
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN`, `CONSENT_REQUIRED`, `DEMO_AUTH_DISABLED` |
| 404 | `NOT_FOUND` |
| 409 | `*_CONFLICT` (version périmée, revue différente), `*_REQUIRES_POSTGRES` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 422 | `INVALID_*` |
| 503 | `DATABASE_UNAVAILABLE`, `UNSAFE_DATABASE_ROLE`, `OIDC_UNAVAILABLE` |
| 500 | `INTERNAL_ERROR` (détail jamais exposé) |

## Routes

| Méthode et chemin | Rôle | Notes |
|---|---|---|
| `GET /auth/status` | Mode (`demo`/`oidc`), session ouverte, dossier | Sans session : `authenticated: false` |
| `GET /auth/login` | Redirection vers le fournisseur d'identité | OIDC uniquement : code + PKCE S256, `state`, `nonce` |
| `GET /auth/callback` | Retour du fournisseur, vérification du jeton, double authentification exigée | Redirige vers `/?auth=ok`, `mfa`, `not_enrolled` ou `invalid` ; aucun rattachement automatique |
| `POST /auth/logout` | Fermeture de la session | Journalisé |
| `POST /session` | Profil fictif (`{"personId":"demo-alpha"}`) | Refusé en mode OIDC |
| `GET /records/{personId}` | Dossier complet, valeurs corrigées et historique, `device` (données du téléphone agrégées par jour) | Seulement son propre dossier |
| `GET /documents/{id}` | PDF source (octets d'origine pour un PDF importé) | En-tête `X-Document-SHA256` |
| `GET /export` | Export complet (dossier + `export` : identités, autorisations, PDF, reçus, données brutes du téléphone, journal) | Journalisé |
| `GET /summary?period=90\|365\|730` | Résumé PDF pour consultation | Aucune interprétation (test sur le texte) |
| `GET /imports` · `POST /imports` | Fichier JSON de démonstration ; import idempotent | Fichier exact uniquement (SHA-256) ; autorisation `structured-import` |
| `GET /pdf/fixtures[?id=]` | Liste ou octets des PDF synthétiques | Corpus fermé |
| `POST /pdf/analyze` | Lecture native d'un PDF de la liste blanche, mise en revue | ≤ 500 Ko ; autorisation `pdf-documents` ; renvoie `overlaps` |
| `POST /pdf/confirm` | Ajout des résultats explicitement sélectionnés | Transactionnel, idempotent, 409 si autre sélection |
| `POST /observations/correct` | Correction versionnée d'un résultat lu dans un PDF | `{observationId, expectedVersion, value, reason}` ; même unité |
| `GET /consents` · `POST /consents` | État et historique des autorisations ; décision versionnée | `{source, expectedVersion, granted}` |
| `GET /device-imports` · `POST /device-imports` | Résumé et import des données du téléphone | ≤ 500 enregistrements ; types, unités et forme imposés ; autorisation `device-health` |

## Base de données

Toutes les routes passent par `databaseCall` : une transaction par appel, avec la preuve de session. Les fonctions `personal.api_*` (`SECURITY DEFINER`) appellent `personal.guard`, qui vérifie l'identité rattachée et la preuve, puis restreint la visibilité au dossier (RLS). Le rôle applicatif n'a aucun accès direct aux tables. Migrations : `apps/personal/sql/001–012`, en ajout seul.

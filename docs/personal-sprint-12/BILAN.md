# Sprint 12 — Connexion réelle des patients (OIDC + double authentification)

Date : 18 novembre 2026. Priorité choisie par le fondateur. Aucun compte externe créé : les tests utilisent un fournisseur OpenID local, démarré par la suite de tests.

## Réalisé

- **Mode `HC_PERSONAL_AUTH=oidc`** (la démonstration reste le mode par défaut). En mode OIDC, les profils fictifs sont refusés (`DEMO_AUTH_DISABLED`), et une session de démonstration n'est pas acceptée, ni l'inverse.
- **Flux standard** : code d'autorisation + **PKCE S256** (RFC 7636, vecteur officiel testé), `state` et `nonce` aléatoires dans un cookie de transaction signé (10 min, HttpOnly, SameSite=Lax limité à `/api/auth`). Découverte vérifiée (l'émetteur doit correspondre exactement). Jeton d'identité vérifié avec `jose` : signature par les clés publiées, émetteur, audience, `azp`, expiration, nonce ; `alg: none` refusé.
- **Double authentification exigée** via le claim `amr` (RFC 8176), valeurs configurables (`mfa` par défaut).
- **HTTPS obligatoire** pour le fournisseur et le retour, sauf sur la machine locale.
- **Aucun rattachement automatique** : migration additive `008_oidc_identity.sql`. `api_identity_person` ne résout qu'une identité déjà rattachée et active ; un échec est journalisé (`oidc_not_enrolled`). Le rattachement passe par l'opérateur : `npm run identity:link -- <émetteur> <sub> <dossier>`. La contrainte d'unicité `actor.person_id` est levée : un dossier peut avoir plusieurs identités.
- **Sujet non réversible** : `oidc:` + SHA-256(émetteur, identifiant). Aucun identifiant brut n'est stocké ni journalisé.
- **Interface** : écran « Connexion à votre espace », messages distincts (double authentification manquante, identité non rattachée, vérification impossible), panneau « Votre connexion » et déconnexion dans Paramètres.
- **CI** : `npm run test:e2e:oidc` ajouté au workflow.

## Défaut trouvé par les tests et corrigé

Après le retour du fournisseur, la redirection utilisait `request.url`. Derrière le serveur Next, ce dernier porte un hôte interne (`localhost`) : le navigateur changeait d'hôte et perdait le cookie de session. La redirection utilise désormais l'origine publique configurée (`HC_PERSONAL_OIDC_REDIRECT_URI`). Ce défaut aurait touché un déploiement réel.

## Vérifications exécutées dans cette session

- Statique, build : OK ; `npm audit --omit=dev` : 0 vulnérabilité.
- Unitaires : 44/44, dont jeton valide, autre clé, autre émetteur, autre audience, nonce rejoué, jeton expiré, `alg: none`, `amr` absent ou insuffisant, HTTPS imposé, vecteur RFC 7636, cloisonnement des sessions demo/OIDC, expiration.
- PostgreSQL : 22/22, dont non-rattachement, rattachement contrôlé, deux identités pour un dossier, refus de double rattachement, dossier inconnu, révocation, audit, absence d'accès direct à `actor`.
- Navigateur : 21/21 (PostgreSQL), 15 + 6 ignorés (local) et **6/6 connexion réelle** : profils fictifs désactivés, refus sans double authentification, identité non rattachée, jeton d'une autre application, état falsifié, connexion complète (cookie HttpOnly Strict, accès croisé refusé) puis déconnexion.

## Limites

- Fournisseur patient réel non choisi : c'est une décision du fondateur, à prendre chez un hébergeur compatible HDS.
- Pas de déconnexion côté fournisseur (`end_session_endpoint`) ni de renouvellement de session : durée fixe d'une heure.
- La base fait toujours confiance au sujet transmis par l'API (S-02 ouvert) : l'application vérifie le jeton, la base ne le revérifie pas.
- La démo mobile n'est pas concernée : elle reste en profils fictifs.

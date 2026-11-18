# Sprint 20 — En-têtes de sécurité et exercice de sauvegarde/restauration

Date : 18 novembre 2026 (travail autonome). Backlog S-03 (partiel) et P2 « sauvegarde/restauration ».

## En-têtes HTTP

Déjà présents : CSP avec nonce et `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Cache-Control: no-store`. Ajoutés :
- `Permissions-Policy` : caméra, micro, géolocalisation, paiement, USB et `interest-cohort` désactivés ;
- `Cross-Origin-Opener-Policy: same-origin` ;
- `Strict-Transport-Security` (1 an, sous-domaines), **seulement** quand l'application tourne en HTTPS (`HC_PERSONAL_SECURE_COOKIE=true`). En HTTP local, HSTS bloquerait le développement ; un test vérifie qu'il est absent dans ce cas.

## Exercice de sauvegarde et restauration (`npm run test:backup`, ajouté à la CI)

Sur une base jetable, après de l'activité (lecture auditée, autorisation accordée) : `pg_dump --format=custom`, nouvelle base, `pg_restore --exit-on-error`. La copie restaurée doit être identique :
- même nombre de lignes dans chacune des 17 tables, mêmes empreintes de migrations ;
- RLS forcée sur toutes les tables, immuabilité active (suppression refusée) ;
- servie par le rôle applicatif : dossier identique, accès direct aux tables refusé, autorisation restaurée.

Résultat : réussi au premier passage.

## Limites

Restauration dans la même grappe (les rôles existent déjà). Une restauration sur une grappe neuve demande de recréer d'abord les rôles (`db:prepare`). Pas de sauvegarde chiffrée, planifiée ni externalisée : cela dépend de l'hébergeur (B-02). Pas de limitation de débit, qui relève du proxy inverse de l'hébergement.

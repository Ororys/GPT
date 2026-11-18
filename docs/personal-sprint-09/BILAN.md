# Sprint 09 — Autorisations par source, versionnées et révocables

Date : 18 novembre 2026. Données exclusivement fictives. Pages et découpage conservés : un bloc « Ce que vous autorisez » est ajouté au panneau des sources, dans Paramètres.

Répond à la vision §7 (« synchronisation avec permissions explicites ; révocation et fin de synchronisation »), limité aux entrées de données **réellement existantes** : documents PDF et import structuré. Aucun faux connecteur montre n'est présenté comme autorisable.

## Réalisé

- **Migration additive `006_source_consent.sql`** :
  - table `personal.source_consent` en ajout seul (version, autorisé/retiré, auteur, date), RLS forcée, immuable, sans accès direct du rôle API ;
  - `api_consents` (état + historique) et `api_set_consent` (version attendue, verrou, refus d'une décision sans changement, audit `consent_granted` / `consent_revoked`) ;
  - **contrôle au point d'entrée des données** : triggers `BEFORE INSERT` sur `pdf_intake`, `pdf_review` et `import_receipt`. Quelle que soit la fonction appelante, une autorisation retirée refuse l'ajout et annule la transaction entière (y compris une revue PDF préparée avant le retrait).
- **Préparation de la démo** : le profil Alex est créé avec les deux autorisations accordées par `seed:demo-setup`, visible comme tel dans l'historique, et révocable.
- **API** `GET/POST /api/consents` (Origin vérifiée, schéma strict) ; l'erreur SQL `CONSENT_REQUIRED` est remontée en 403 explicite au lieu d'une indisponibilité générique.
- **Interface** : état, bouton Retirer/Autoriser, historique versionné ; messages explicites dans l'import PDF et l'import JSON. Le texte précise que les données déjà ajoutées restent (effacement : décision juridique B-04).
- Libellé de source corrigé : les PDF synthétiques sont aussi lus en texte natif depuis le sprint 03.

## Vérifications exécutées dans cette session

- Statique, build : OK.
- Unitaires : 34/34.
- PostgreSQL : 20/20, dont état initial, refus inter-dossier, décision sans changement, version périmée, refus du staging et d'un re-staging après retrait, **confirmation refusée et annulée** pour une revue préparée avant retrait, trigger d'import structuré, historique, immuabilité, audit.
- Navigateur : 20/20 sur PostgreSQL (retrait → import PDF refusé avec message → rétablissement) ; 14 réussis + 6 ignorés en mode local.

## Limites

Pas d'expiration ni de portée temporelle des autorisations. Le retrait n'efface ni ne masque les données existantes. Ce mécanisme produit n'établit pas une base légale RGPD (B-03) ; identité toujours démonstrative.

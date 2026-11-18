# v1.4 — Design de sécurité et décisions

**Ce livrable n'est PAS prêt pour des données patients réelles.**

## Décisions retenues

1. Identité attestée côté serveur par un fournisseur d'identité à choisir. Ne jamais accepter `actor_id`, rôle ou `person_id` transmis librement par le navigateur comme preuve d'identité.
2. Patient : lecture de son dossier seulement. IDE : mesures sur patients explicitement assignés (par défaut pas d'accès à l'historique biologique complet). Médecin : lecture dans le cadre d'un lien de prise en charge explicite et temporel. Administratif : calendrier/facturation seulement. Fondateur : aucune lecture clinique. Service : aucune autorisation générique.
3. Revocation immédiate des liens professionnels; consentement à l'API montre séparé des permissions d'accès aux dossiers. Le droit de prendre en charge une personne ne découle pas d'un simple consentement RGPD.
4. Journaliser les tentatives d'accès autorisées **et refusées** ; éviter les valeurs médicales dans l'audit et définir une durée de conservation.
5. Ingestion idempotente par (personne, namespace, identifiant source, version); conflits = erreur, pas d'écrasement silencieux.
6. V1 descriptive séparée de V2 clinique; aucune alerte médicale automatique dans ce package.

## Limites techniques explicites

- Pas de fournisseur d'identité configuré, pas de validation JWT/OIDC, pas de vrai routeur HTTP.
- `VerifiedContext` est un **contrat illustratif**, pas une barrière cryptographique : un développeur pourrait le forger; le type ne remplace jamais une vérification réelle.
- `MemoryRepository` est en mémoire, ne fournit aucune transaction durable ni résistance à des accès concurrents.
- La migration SQL ajoute des tables et un trigger d'audit, mais **aucune politique RLS permissive** : le schéma reste fermé à tout rôle applicatif ordinaire.
- Aucun test d'exécution PostgreSQL, HDS, DPIA, DPA, règles CNIL, certification MDR ni tests de pénétration ne sont déclarés.
- Les triggers append-only ne sont pas une garantie contre un superutilisateur/owner; des journaux immuables externalisés seraient nécessaires.
- Un professionnel doit voir assez d'informations pour exercer légalement sa mission : le modèle IDE minimal est provisoire à discuter avec le responsable médical.
- Ne pas utiliser `patient_actor` comme délégation pour un mineur ou proche sans modèle juridique dédié.

## Prochain sprint (v1.5)

Choisir IDP et hébergement de test; brancher un vrai serveur API avec token vérifié, séparer migration-owner et service roles, implémenter autorisation garantie à la frontière DB, transactions réelles + tests d'accès adversariaux et scénarios de révocation. Intégrer une politique de suppression/export et d'incident de sécurité. Aucune donnée de santé réelle avant cadrage juridique/HDS/ANSSI et tests de sécurité appropriés.

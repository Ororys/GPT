# Comparatif de trois hébergeurs certifiés HDS (18 novembre 2026)

Demande du fondateur : comparer trois hébergeurs, **sans rien signer ni payer**. Besoin technique du produit : une application Node.js 24 (Next.js) et **PostgreSQL 16 managé** avec sauvegardes, en France. Source de référence pour la certification : la [liste officielle de l'ANS](https://esante.gouv.fr/offres-services/hds/liste-des-hebergeurs-certifies), qui indique la version du référentiel. Depuis le 16 mai 2026, seuls les certificats au **référentiel HDS v2** sont valides.

| Critère | Clever Cloud | OVHcloud | Scaleway |
|---|---|---|---|
| Certification HDS | Annoncée v2, sur les **6 activités** ; certification depuis janvier 2025 ([annonce](https://www.clever-cloud.com/blog/press/2025/01/15/clever-cloud-obtains-hds-certification), [page HDS](https://www.clever.cloud/health-data-hosting/)) | Certifié ; une page de la documentation mentionne encore la version 2018, une autre la certification sur la version 2024 : **à vérifier sur la liste ANS** ([doc HDS](https://docs.ovhcloud.com/fr/guides/account-and-service-management/account-information/hds-certification)) | Certifié depuis juillet 2024 ([sécurité et résilience](https://www.scaleway.com/fr/securite-et-resilience/), [page HDS](https://www.scaleway.com/fr/security-and-compliance/hds/)) |
| PostgreSQL managé dans le périmètre HDS | **Oui, affirmé** sur la page produit ([PostgreSQL](https://clever.cloud/product/postgresql/)) | Bases relationnelles managées listées comme couvertes ; PostgreSQL non nommé explicitement sur la page HDS | **Non confirmé** dans les sources consultées |
| Exécution de l'application Node.js | PaaS (déploiement depuis Git) | Instances ou Kubernetes managé (plus d'exploitation à notre charge) | Instances, conteneurs ou Kubernetes |
| Conditions annoncées | Contrat HDS spécifique | Support Business ou Enterprise, option HDS à activer | Support Business ou Enterprise, contrat HDS ; hébergement limité à la France |
| Données en France | Oui, annoncé | Selon les régions choisies | Oui pour les offres HDS |
| Tarifs | Non relevés | Non relevés | Non relevés |

## Recommandation

**Clever Cloud en premier choix à instruire.** C'est le seul des trois dont le PostgreSQL managé est explicitement annoncé dans le périmètre HDS v2. Son modèle PaaS correspond aussi à l'architecture actuelle (une application Node, une base PostgreSQL, sans exploitation de serveurs). **OVHcloud** reste l'alternative la plus établie, à condition de confirmer la version v2 du certificat et l'inclusion de PostgreSQL. Scaleway n'est retenu qu'en troisième, faute de confirmation sur la base managée.

Cette recommandation repose **uniquement sur les pages publiques des hébergeurs**. Avant toute décision :

1. Vérifier les trois noms sur la liste ANS, avec la version v2 et la date de validité.
2. Demander à chacun, par écrit : le périmètre exact (PostgreSQL 16, sauvegardes, journaux, région), le contrat HDS, le prix pour 1 application + 1 base de petite taille + support requis, et les engagements de restauration.
3. Rappel : l'hébergeur certifié ne rend pas l'éditeur conforme. AIPD, sécurité applicative, identité et revue indépendante restent nécessaires (B-03, B-01, B-10).

Rien n'a été souscrit. Le choix et la signature appartiennent au fondateur.

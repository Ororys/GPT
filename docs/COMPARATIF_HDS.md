# Comparatif de trois hébergeurs certifiés HDS (18 novembre 2026)

Demande du fondateur : comparer trois hébergeurs, **sans rien signer ni payer**. Besoin technique du produit : une application Node.js 24 (Next.js) et **PostgreSQL 16 managé** avec sauvegardes, en France. Source de référence pour la certification : la [liste officielle de l'ANS](https://esante.gouv.fr/offres-services/hds/liste-des-hebergeurs-certifies), qui indique la version du référentiel. Depuis le 16 mai 2026, seuls les certificats au **référentiel HDS v2** sont valides.

| Critère | Clever Cloud | OVHcloud | Scaleway |
|---|---|---|---|
| Certification HDS | Annoncée v2, sur les **6 activités** ; certification depuis janvier 2025 ([annonce](https://www.clever-cloud.com/blog/press/2025/01/15/clever-cloud-obtains-hds-certification), [page HDS](https://www.clever.cloud/health-data-hosting/)) | Certifié ; une page de la documentation mentionne encore la version 2018, une autre la certification sur la version 2024 : **à vérifier sur la liste ANS** ([doc HDS](https://docs.ovhcloud.com/fr/guides/account-and-service-management/account-information/hds-certification)) | Certifié depuis juillet 2024 ([sécurité et résilience](https://www.scaleway.com/fr/securite-et-resilience/), [page HDS](https://www.scaleway.com/fr/security-and-compliance/hds/)) |
| PostgreSQL managé dans le périmètre HDS | **Oui, affirmé** sur la page produit ([PostgreSQL](https://clever.cloud/product/postgresql/)) | Bases relationnelles managées listées comme couvertes ; PostgreSQL non nommé explicitement sur la page HDS | **Non confirmé** dans les sources consultées |
| Exécution de l'application Node.js | PaaS (déploiement depuis Git) | Instances ou Kubernetes managé (plus d'exploitation à notre charge) | Instances, conteneurs ou Kubernetes |
| Conditions annoncées | Contrat HDS spécifique | Support Business ou Enterprise, option HDS à activer | Support Business ou Enterprise, contrat HDS ; hébergement limité à la France |
| Données en France | Oui, annoncé | Selon les régions choisies | Oui pour les offres HDS |
| Tarifs (voir ci-dessous) | Forfait HDS de 200 €/mois + ressources ×1,4 (à confirmer) | Base PostgreSQL « Business » ≈ 138 € HT/mois + support Business obligatoire (prix non trouvé) | Non relevés |

## Recommandation

**Clever Cloud en premier choix à instruire.** C'est le seul des trois dont le PostgreSQL managé est explicitement annoncé dans le périmètre HDS v2. Son modèle PaaS correspond aussi à l'architecture actuelle (une application Node, une base PostgreSQL, sans exploitation de serveurs). **OVHcloud** reste l'alternative la plus établie, à condition de confirmer la version v2 du certificat et l'inclusion de PostgreSQL. Scaleway n'est retenu qu'en troisième, faute de confirmation sur la base managée.

Cette recommandation repose **uniquement sur les pages publiques des hébergeurs**. Avant toute décision :

1. Vérifier les trois noms sur la liste ANS, avec la version v2 et la date de validité.
2. Demander à chacun, par écrit : le périmètre exact (PostgreSQL 16, sauvegardes, journaux, région), le contrat HDS, le prix pour 1 application + 1 base de petite taille + support requis, et les engagements de restauration.
3. Rappel : l'hébergeur certifié ne rend pas l'éditeur conforme. AIPD, sécurité applicative, identité et revue indépendante restent nécessaires (B-03, B-01, B-10).

Rien n'a été souscrit. Le choix et la signature appartiennent au fondateur.

## Coûts estimés (recherche du 18 novembre 2026, sans devis)

Ordres de grandeur tirés des pages publiques. **Un devis écrit reste nécessaire.**

| | Clever Cloud | OVHcloud |
|---|---|---|
| Ticket d'entrée HDS | Forfait de **200 €/mois**, puis tarif standard des ressources **×1,4**, selon la page HDS. Un article de Clever Cloud d'avril 2026 dit pourtant que le HDS est inclus sans surcoût pour les bases : **contradiction à lever** | Support **Business obligatoire** pour les produits HDS ; prix non trouvé |
| Base PostgreSQL | Petite base (1 vCPU, 2 Go) ≈ 6,80 €/mois au tarif standard, soit ≈ 10 € en HDS | Offre « Business » à 2 nœuds (DB1-4) ≈ 0,19 €/h, soit **≈ 138 € HT/mois** (calcul : prix horaire × 730 h) |
| Application Node | Petite instance : prix non relevé | Instance ou Kubernetes : prix non relevé |
| Connexion (Keycloak) | Keycloak géré dès **47 €/mois**, 100 utilisateurs actifs inclus, puis 0,05 € par utilisateur. Une évolution de tarif est annoncée au 1er novembre 2026, non relevée | À installer soi-même |
| **Estimation pour démarrer** | **≈ 300 à 450 €/mois HT**, connexion comprise | **≈ 250 à 400 €/mois HT** hors support Business, connexion non comprise |

Ces montants sont des estimations, pas des prix contractuels. Pour 1 000 utilisateurs actifs, la connexion Clever Cloud ajouterait ≈ 45 €/mois au tarif relevé.

Sources : [Clever Cloud — HDS](https://www.clever.cloud/health-hds/), [Clever Cloud — singularités (avril 2026)](https://www.clever.cloud/blog/company/2026/04/08/what-makes-clever-cloud-unique/), [Clever Cloud vs AWS](https://www.clever.cloud/clever-cloud-vs-aws/), [Keycloak géré](https://www.clever.cloud/product/managed-keycloak-as-a-service/), [OVHcloud — tarifs Public Cloud](https://us.ovhcloud.com/public-cloud/prices/), [OVHcloud — évolution des prix](https://blog.ovhcloud.com/en/posts/pricing-evolution-of-public-cloud-bare-metal-and-vps-at-ovhcloud/), [OVHcloud — calcul du prix des bases](https://docs.ovhcloud.com/en/guides/public-cloud/databases/pricing), [OVHcloud — certification HDS](https://docs.ovhcloud.com/en/guides/account-and-service-management/account-information/hds-certification).

## Fournisseur de connexion pour les patients (B-01)

**Recommandation : Keycloak, logiciel libre, géré par le même hébergeur HDS** (offre Keycloak de Clever Cloud).

- Keycloak parle le standard OpenID Connect déjà intégré dans le code (sprint 12) : aucun développement spécifique.
- Il gère la double authentification (application d'authentification, clé de sécurité).
- Les identités restent chez le même hébergeur, en France, ce qui évite un sous-traitant de plus.
- Le logiciel est libre : on peut changer d'hébergeur sans changer de système de connexion.

**À vérifier auprès de Clever Cloud :** que l'offre Keycloak est bien **dans le périmètre de la certification HDS**. Il faudra aussi vérifier, à l'essai, que Keycloak transmet bien l'information de double authentification (`amr`) exigée par le code.

Écartés :
- **FranceConnect** : son ouverture au privé est limitée aux cas où une loi impose de vérifier l'identité ([Le Monde Informatique](https://www.lemondeinformatique.fr/actualites/lire-franceconnect-s-ouvre-timidement-au-secteur-prive-79204.html), [CGU fournisseurs de service](https://partenaires.franceconnect.gouv.fr/files/CGU_FS_v3.9.pdf)), ce qui ne semble pas notre cas. À confirmer auprès de la DINUM.
- **Pro Santé Connect** : réservé aux professionnels de santé, à garder pour un futur accès soignant.
- **Services américains** (Auth0, Firebase…) : identités hors de l'hébergement de santé.

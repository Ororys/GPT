# Sprint 11 — Jour local, axe temporel proportionnel, lever de chaise et masse grasse

Date : 18 novembre 2026. Données exclusivement fictives. Le fondateur a demandé de trancher les points ouverts « grâce à des recherches et des données objectives ». Chaque décision ci-dessous indique sa source et ce qui n'a pas pu être vérifié.

## Décisions et sources

| Point | Décision | Fondement |
|---|---|---|
| C-01 fuseau | Un instant appartient au **jour calendaire du fuseau IANA du dossier** (Europe/Paris par défaut : centre à Bordeaux), changements d'heure compris. Une valeur connue au jour près (`measuredPrecision=day`) garde sa date et n'est jamais décalée. | Health Connect stocke pour chaque enregistrement un instant et un décalage de fuseau (`startZoneOffset`, `endZoneOffset`), précisément pour restituer l'heure locale. [Android — SleepSessionRecord](https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/SleepSessionRecord), [sessions de sommeil](https://developer.android.com/health-and-fitness/health-connect/features/sleep-sessions). La démo n'a pas de décalage par appareil : le fuseau du dossier en tient lieu. |
| Axe des graphiques | **Axe temporel proportionnel** (ECharts `time`) : un an d'écart se voit comme un an. | Un axe par catégories espaçait également des points distants d'un jour ou d'un an, ce qui suggérait une évolution plus rapide qu'elle ne l'est (constat du sprint 10). |
| Lever de chaise | **Cinq levers de chaise chronométrés (s)** : bras croisés, aussi vite que possible, arrêt si appui des bras ou au-delà de 60 s. Aucun seuil affiché. | Test associé à la préhension dans le cadre EWGSOP2 (axe R05). Protocole décrit dans l'étude de Tromsø, [BMC Geriatrics 2020](https://bmcgeriatr.biomedcentral.com/articles/10.1186/s12877-020-01860-w) ; seuil EWGSOP2 > 15 s recensé dans [ce tableau comparatif](https://pmc.ncbi.nlm.nih.gov/articles/PMC9219260/table/tbl2), **volontairement non affiché** (ce serait une interprétation). Alternative écartée : le test de 30 s du [formulaire CDC STEADI](https://www.nj.gov/humanservices/doas/forms/STEADI-Assessment-30Sec-508.pdf), orienté risque de chute plutôt que force/fonction. |
| Préhension | Protocole aligné sur **Southampton** : 3 essais par main, meilleure des 6 valeurs. | Protocole utilisé dans l'étude de Tromsø citée ci-dessus. |
| Masse grasse | **Estimation par impédancemétrie**, libellée comme telle ; conditions de mesure déclarées non standardisées. Le passeport rappelle que la BIA n'est pas validée aux IMC extrêmes ni en cas d'hydratation anormale. | Kyle et al., *Bioelectrical impedance analysis — part II*, Clin Nutr 2004;23:1430 ([notice](https://eprints.soton.ac.uk/25739)). **Non vérifié** : les conditions standardisées détaillées (jeûne, miction, repos). Elles ne sont donc pas inventées dans le protocole. |

Rapport de la recherche : les sources secondaires (copies du formulaire CDC, études qui appliquent EWGSOP2) ont été préférées à des pages non identifiables. Le texte original du consensus EWGSOP2 (Cruz-Jentoft et al., *Age and Ageing* 2019) n'a pas été consulté directement.

## Réalisé

- Module `modules/observations/time.ts` : `localDay`, `dayOf` (précision), `addDays`, `weekStart`, `zoneOf`. Appliqué au passeport (couverture, périodes sans donnée), au résumé (nuits), à la vue d'ensemble (une valeur de sommeil par jour local), au sport (semaines locales), à la fenêtre source et à l'affichage des dates.
- `HealthRecord.timeZone` (Europe/Paris dans les fixtures, stocké dans les métadonnées du dossier pour les nouvelles bases ; valeur par défaut sinon).
- Migration additive **`007_local_day_overlaps.sql`** : `personal.local_day` et `api_pdf_overlaps` remplacée avec la même règle ; un fuseau inconnu retombe sur Europe/Paris. Démo mobile alignée.
- Graphiques : axe temporel, libellés et tableau accessible en heure de Paris (« Heure de Paris · temps proportionnel · lacunes conservées »).
- Mesures du centre : + 5 levers de chaise, + masse grasse estimée (6 séries au total) ; bandeau « paramètres suivis » au lieu de « biomarqueurs ».

## Vérifications exécutées dans cette session

- Statique, build : OK.
- Unitaires : 39/39, dont jour local (heure d'été/hiver, minuit, New York), précision au jour non décalée, arithmétique calendaire, nuit à 23 h 30 UTC rattachée au lendemain à Paris.
- PostgreSQL : 21/21, dont `local_day` sur les mêmes cas et fuseau renvoyé par `api_pdf_overlaps` ; stockage HTTP 2/2.
- Navigateur : 21/21 sur PostgreSQL ; 15 + 6 ignorés en local. Démo mobile : 10/10, types et build OK.

## Limites

Un seul fuseau par dossier : un voyage n'est pas représenté (il faudrait le décalage par mesure, comme Health Connect). L'affichage suppose un fuseau à l'est d'UTC pour les valeurs au jour près (vrai pour Paris) ; un fuseau à l'ouest demanderait un affichage tenant compte de la précision partout. Aucun seuil, norme ou interprétation pour les mesures du centre. Les protocoles restent fictifs et non validés par un professionnel.

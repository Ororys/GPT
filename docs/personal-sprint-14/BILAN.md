# Sprint 14 — Données du téléphone affichées, sans double comptage

Date : 18 novembre 2026. Suite directe du sprint 13 : les données lues dans Santé (iPhone) ou Health Connect (Android) apparaissent dans les pages Vue d'ensemble et Sport, **dans des panneaux distincts** du jeu synthétique.

## Défauts évités avant affichage

Le format renvoyé par le plugin ([définitions](https://capgo.app/docs/plugins/health/)) aurait produit des chiffres faux si on avait simplement additionné :

- **Sommeil** : segments avec un état (`inBed`, `asleep`, `awake`, `rem`, `deep`, `light`) qui se chevauchent, et plusieurs sources (montre, iPhone). Désormais, seul le temps endormi (asleep, light, deep, REM) est compté. Les intervalles sont fusionnés (aucune minute comptée deux fois) et la nuit est rattachée au jour local du réveil, siestes comprises.
- **Pas et distance** : l'iPhone et la montre comptent chacun. L'application stocke uniquement le **total quotidien calculé par la plateforme** (`queryAggregated`, tranche jour), qui dédoublonne. Si plusieurs totaux existent pour un jour (import en cours de journée, deux téléphones), le plus grand est retenu : un total cumulé ne fait que croître.
- **VFC** : HealthKit mesure SDNN, Health Connect RMSSD. Il y a deux séries distinctes, chacune nommée par sa méthode, jamais moyennées ensemble.
- Identifiant d'enregistrement : `platformId` (UUID HealthKit, identifiant Health Connect) quand il existe.

## Réalisé

- Migration additive **`010_device_daily.sql`** : colonnes `sleep_state` et `aggregation`. Contrainte de forme (pas et distance en total quotidien, sommeil avec état), appliquée aux nouvelles lignes (`NOT VALID`, les lignes 009 restent intactes). `api_device_import` est mis à jour ; `api_device_records` permet une lecture bornée à 400 jours et 20 000 lignes.
- Module pur `modules/device/daily.ts` : agrégation par jour local du dossier (règle C-01).
- `record.device` est calculé côté serveur (mode PostgreSQL) sur 90 jours.
- Panneaux « Nuits et cœur, tels que mesurés » (Vue d'ensemble) et « Pas et distance au quotidien » (Sport), affichés seulement s'il y a des données, y compris pour un dossier sans données fictives.
- Graphiques : au moins un jour entre deux graduations pour les séries quotidiennes (les dates se répétaient sur des périodes courtes).

## Vérifications exécutées dans cette session

- Unitaires : 50/50, dont temps au lit exclu, montre + iPhone fusionnés (7 h et non 12 h), total quotidien maximal retenu, échantillon brut de pas ignoré, VFC séparée par méthode, jour local à Paris.
- PostgreSQL : 24/24 (contrainte de forme, lecture bornée, cloisonnement) ; stockage HTTP 2/2.
- Navigateur : 23/23 sur PostgreSQL (import puis affichage : 6 h de sommeil, 8 421 pas, VFC SDNN 44 ms), 15 + 8 ignorés en local, connexion réelle 6/6. Configuration native 3/3.

## Limites

Pas de lecture sur un vrai téléphone dans cette session. Un seul fuseau par dossier. Les séances d'entraînement du téléphone ne sont pas lues (permission non demandée). Le résumé de consultation et le passeport n'incluent pas encore les données du téléphone.

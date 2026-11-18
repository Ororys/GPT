# Sprint 04 — PDF natif : banc synthétique élargi et cas ambigus

Date : 18 novembre 2026. Reprise par Claude Code. Données exclusivement fictives. Les cinq pages, leur découpage et le design sont conservés ; aucune migration SQL ajoutée.

## Point de départ vérifié

Avant toute modification, dans un conteneur Linux avec Node 24.22.3 et PostgreSQL 16.15 (grappe jetable locale, pas Docker Compose) :

- typecheck, Oxlint, Prettier, build Next : OK ;
- 20 tests unitaires, 15 tests PostgreSQL, 14 tests Playwright sur PostgreSQL : tous réussis.

Seul ajustement d'environnement : `playwright.config.ts` accepte une variable facultative `HC_PLAYWRIGHT_CHROMIUM` (chemin d'un Chromium déjà installé). Sans elle, le comportement est inchangé.

## Constats sur le parseur `pdf-native-v1` (sprint 03)

1. Une ligne de tableau non reconnue (paramètre inconnu, valeur `< 4`, référence absente ou unilatérale `> 20`) disparaissait sans trace.
2. Seules la **première** date « PRELEVEMENT » et la **première** mention « DOSSIER SYNTHETIQUE » étaient lues : une seconde date contradictoire ou un second dossier passaient inaperçus.
3. Un même paramètre présent deux fois avec deux valeurs donnait deux observations ajoutables.
4. Le titre du document était figé à « 17 novembre 2026 », y compris pour un PDF sans texte.
5. Un tableau en vraies colonnes (une zone de texte par cellule) n'était pas lu.

## Réalisé

- **Reconstitution des lignes** par ligne de base (±2 pt), haut → bas puis gauche → droite. Une ligne d'une seule zone garde son texte exact : les citations source du sprint 03 sont identiques. Une ligne reconstituée depuis des colonnes le signale (`ROW_RECONSTRUCTED_FROM_COLUMNS`) et sa zone couvre toutes les cellules.
- **Aucune ligne silencieusement ignorée** : toute ligne tabulaire non reprise est listée (`unrecognized`, page + texte) et affichée « lue(s) mais non reprise(s) ». Rien n'en est déduit.
- **Valeurs non numériques** : `< 4` → `VALUE_QUALIFIER_NOT_SUPPORTED`, valeur `null`, jamais convertie ni approchée.
- **Références** : seule une plage `bas - haut` est structurée. Absente ou unilatérale → l'observation est enregistrée **sans** référence structurée, le texte d'origine reste dans la citation source (note informative, non bloquante).
- **Doublon intra-document** : toutes les occurrences d'un paramètre répété sont bloquées (`DUPLICATE_IN_DOCUMENT`) ; aucune n'est choisie.
- **Dates** : toutes les occurrences doivent être un vrai jour calendaire et concorder. Sinon `MEASUREMENT_DATE_INVALID` ou `MEASUREMENT_DATE_AMBIGUOUS`, aucun résultat ajoutable, avertissement listant les dates trouvées.
- **Dossier** : toute mention d'un autre dossier dans le PDF entraîne un refus, pas seulement la première.
- **Titre** dérivé de la date lue ; « date à vérifier » sinon (plus de date affichée sans source).
- **Revue** : motif de blocage précis par résultat (au lieu de « unité incompatible » pour tout), notes, avertissements, valeur « — » quand elle n'est pas numérique.
- **Corpus** : trois PDF synthétiques ajoutés à la liste blanche SHA-256, générés séparément pour que les octets des cinq PDF existants ne changent pas :
  - `colonnes` — tableau en colonnes, référence `> 20`, paramètre non pris en charge (glycémie) ;
  - `ambigus` — ferritine répétée (64 et 46), HbA1c `< 4`, ligne de commentaire ;
  - `dates` — deux pages, deux dates de prélèvement différentes.

La liste blanche reste en place. Les nouveaux PDF y entrent par le même seed idempotent (`db:prepare`), sans migration.

## Compatibilité

- Empreintes des 5 PDF du sprint 03 verrouillées par un test (une base existante en dépend).
- Propositions de ces 5 PDF comparées avant/après : candidats, valeurs, citations, zones identiques ; seuls ajouts `unrecognized: []` et titre « date à vérifier » pour le PDF sans texte.
- Les propositions déjà stockées (immutables) restent valides : `unrecognized` et `notes` sont optionnels.
- Aucune modification SQL ; la confirmation continue de n'accepter que les candidats `eligible` avec observation.

## Vérifications exécutées dans cette session

Logs dans `evidence/` (URL de base masquée).

- Statique : typecheck, Oxlint, Prettier — OK (`static.log`).
- Unitaires : 26/26 (`unit.log`), dont 6 nouveaux.
- PostgreSQL 16.15 réel : 16/16 (`postgres.log`), dont 1 nouveau : liste blanche, refus SQL des doublons / valeurs `<` / dates ambiguës, observation sans référence structurée.
- Navigateur sur PostgreSQL : 15/15 (`browser.log`), dont 1 nouveau ; capture `pdf-ambigus.png`.
- Build Next : OK.

Non exécutés : Docker Compose, CI distante, tests historiques racine, démo mobile (non modifiée).

## Limites conservées

Toujours un format de tableau contrôlé sur un corpus de 8 PDF synthétiques : aucune performance d'extraction générale n'est annoncée. Pas d'OCR, de LLM ni de fournisseur. Confiance absente. Pas de correction manuelle de valeur. Pas de détection de doublons **entre** documents (deux PDF du même jour avec le même paramètre). Les nouveaux cas ne sont pas reportés dans `demo-mobile/` (variante séparée, non republiable sans accès Sites).

## Suite proposée

1. Revue/correction versionnée : nouvelle valeur liée au candidat d'origine (`replacesCandidateId`), texte et valeur originaux conservés, historique de rectification en SQL.
2. Signalement non bloquant des doublons inter-documents (même paramètre, même jour, autre PDF) à la mise en revue.
3. Report des cas du sprint 04 dans la démo mobile, si souhaité.

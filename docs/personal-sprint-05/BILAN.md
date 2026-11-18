# Sprint 05 — Correction versionnée des résultats lus dans un PDF

Date : 18 novembre 2026. Données exclusivement fictives. Pages, découpage et design conservés : la correction vit dans la fenêtre « source » existante.

## Réalisé

- **Migration additive `003_observation_correction.sql`** : table `personal.observation_correction` (version, valeur, unité, motif obligatoire 3–300 caractères, auteur, horodatage). Propriétaire `hc_personal_owner`, RLS forcée, triggers d'immuabilité, aucun accès direct du rôle API.
- **`personal.api_correct_observation`** (SECURITY DEFINER, garde de sujet) :
  - corrige uniquement les observations `native-pdf` ; séries synthétiques et imports structurés refusés ;
  - même unité que l'observation, aucune conversion (pas de champ unité côté API) ;
  - verrou transactionnel par observation et version attendue : un formulaire périmé est refusé (`conflict`, HTTP 409) ;
  - une valeur identique à la valeur en vigueur est refusée ;
  - audit `correct_observation` avec numéro de version.
- **Lecture** (`api_get_record` remplacée dans la migration) : la valeur affichée est la dernière version ; l'historique complet est joint (`corrections`). La ligne `observation`, sa valeur d'origine, son texte source et son statut `needs-review` ne sont jamais modifiés.
- **Time Machine** : une correction est connue à partir de son horodatage. À une date antérieure, la valeur lue (ou la version alors en vigueur) est affichée.
- **Interface** : colonne « Revue » avec « Corriger » pour les seuls résultats PDF (mode PostgreSQL), formulaire avec citation source et page, unité fixe, motif. Valeurs exactes dans la fenêtre source (« 56,5 µg/L · corrigée v1 · lu 58 »), historique dépliable. Une correction ne vaut pas validation médicale.
- **API** : `POST /api/observations/correct`, Origin vérifiée, taille bornée, schéma strict (virgule française acceptée, pas d'exposant ni de signe).

## Corrections au passage

- `apiError` renvoyait 500 / `INTERNAL_ERROR` pour `REVIEW_CONFLICT` et `PDF_REQUIRES_POSTGRES` : les messages prévus dans l'interface ne pouvaient pas s'afficher. Ils renvoient désormais 409.
- Le test de somme de contrôle des migrations restaurait toutes les lignes avec l'empreinte de la première ; restauration par nom et nouveau `prepare` pour le prouver.

## Vérifications exécutées dans cette session

Node 24.22.3, PostgreSQL 16.15 local jetable, Chromium préinstallé (`HC_PLAYWRIGHT_CHROMIUM`). Logs dans `evidence/` (URL masquée).

- Statique : typecheck, Oxlint, Prettier ; build Next : OK.
- Unitaires : 28/28, dont validation de requête et Time Machine des corrections.
- PostgreSQL : 17/17, dont refus (non-PDF, sans motif, négatif, identique, autre dossier, version périmée), six écritures concurrentes sur la même version (une seule acceptée), historique, valeur d'origine intacte, immuabilité, audit.
- Navigateur sur PostgreSQL : 16/16, dont parcours de correction complet et refus HTTP 409 d'une version périmée ; capture `correction.png`.

Non exécutés : Docker Compose, CI distante, tests historiques racine, démo mobile (non modifiée).

## Limites

Identité toujours démonstrative : l'auteur est le sujet de session fictif. Pas de suppression ni d'annulation de version (on corrige à nouveau, l'historique reste). Les corrections n'existent pas en mode fichiers local ni dans la démo mobile. La précision de saisie (6 décimales) n'est pas rapprochée de la précision du laboratoire. Aucune validation médicale.

## Suite proposée

1. Signaler, sans bloquer, les doublons entre documents (même paramètre, même jour, autre PDF) lors de la revue.
2. Afficher un repère « corrigée » dans les pages Biologie, sans changer leur découpage, si le fondateur le souhaite.

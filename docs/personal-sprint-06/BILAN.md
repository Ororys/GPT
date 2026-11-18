# Sprint 06 — Signalement des doublons entre documents

Date : 18 novembre 2026. Données exclusivement fictives. Pages, découpage et design conservés.

## Réalisé

- **Migration additive `004_pdf_overlap.sql`** : fonction `personal.api_pdf_overlaps` (SECURITY DEFINER, garde de sujet, RLS). Pour chaque candidat ajoutable d'un PDF mis en revue, elle liste les observations du dossier ayant **le même paramètre le même jour (UTC)** et venant d'un **autre** document, avec la valeur en vigueur (correction comprise), l'unité et le titre du document.
- **Calcul à la lecture** : rien n'est stocké dans la proposition (immuable), puisque d'autres documents peuvent arriver après la mise en revue. Rien n'est fusionné, remplacé ni choisi.
- **Revue** : le signalement apparaît sous le résultat (« Déjà dans le dossier le même jour (UTC) : 1,27 g/L · Bilan PDF · 17 novembre 2026 · valeur différente »). Le résultat reste ajoutable, mais il est **décoché par défaut** : l'ajouter demande un choix explicite.

## Vérifications exécutées dans cette session

Node 24.22.3, PostgreSQL 16.15 local jetable, Chromium préinstallé. Logs dans `evidence/` (URL masquée).

- Statique : typecheck, Oxlint, Prettier ; build : OK.
- Unitaires : 28/28.
- PostgreSQL : 18/18, dont signalement des trois paramètres communs entre deux PDF du 17/11, absence d'auto-signalement, absence pour un autre jour, aucune insertion, refus inter-dossier et SHA inconnu.
- Navigateur sur PostgreSQL : 17/17, dont signalement, décochage par défaut et ajout explicite possible ; capture `overlap.png`.

Non exécutés : Docker Compose, CI distante, tests historiques racine, démo mobile.

## Limites

Le « même jour » est le jour UTC : le fuseau du patient n'est pas connu (C-01 reste ouvert). Le rapprochement porte sur le code du paramètre, pas sur la méthode analytique ni le laboratoire. Une valeur identique est signalée « valeur identique », pas déclarée doublon certain. Les imports JSON/structurés ne sont pas signalés lors de leur propre import (le contrôle ne concerne que la revue PDF).

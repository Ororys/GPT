# Sprint 16 — Audit d'accessibilité complet (WCAG 2.1 AA automatisé)

Date : 18 novembre 2026 (travail autonome). Backlog U-01.

## Audit

Test automatisé axe-core (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) sur les **6 pages × 2 thèmes × 2 tailles d'écran** (1280 px et 390 px), puis sur les fenêtres d'import, de source et de passeport.

Premier passage : 36 constats, provenant de 4 éléments partagés.

| Règle | Élément | Correction |
|---|---|---|
| `label-content-name-mismatch` (WCAG 2.5.3, nom accessible ≠ texte visible) | logo « convergence » | le texte visible devient le nom, complété par « , accueil » en texte masqué (`.sr-only`, classe ajoutée : elle n'existait pas) |
| idem | bouton avatar « AM » | « AM, ouvrir les paramètres » |
| idem | bouton « Tableau accessible » / « Graphique » des graphiques | noms commençant par le texte visible |
| `button-name` (nom vide) | recherche globale sur téléphone (texte masqué à 390 px) | nom explicite « Retrouver dans mon histoire » |

Second passage : **0 violation** sur les 24 combinaisons et les 3 fenêtres.

## Vérifications

Lint, format et 52 tests unitaires OK. Navigateur : 24/24 sur PostgreSQL, 16 + 8 ignorés en local, 6/6 connexion réelle.

## Limites

Un audit automatisé ne couvre qu'une partie des critères WCAG. Ne sont pas vérifiés : lecteur d'écran réel (VoiceOver, TalkBack), ordre de lecture des graphiques, zoom 200 %, compréhension des libellés. Un audit manuel reste à faire avant ouverture.

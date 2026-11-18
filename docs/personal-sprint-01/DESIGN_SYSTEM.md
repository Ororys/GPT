# Design system — Convergence Personal

Nom de travail, sans recherche de marque ni positionnement commercial prétendument validé.

## Intentions

Un outil de lecture de son histoire : calme, précis et personnel. Fond profond légèrement végétal, surfaces mates et accent sauge. Le clair utilise un fond ivoire grisé et des surfaces blanches, avec des contrastes ajustés séparément ; ce n'est pas une inversion automatique du sombre. Le symbole de trois traits évoque des sources distinctes réunies, sans emprunter une identité existante.

| Token | Sombre | Clair |
|---|---|---|
| Fond | `#101817` | `#f3f5f0` |
| Sidebar | `#111b19` | `#edf1e9` |
| Surface | `#17221f` | `#ffffff` |
| Texte | `#eff3ed` | `#1b3027` |
| Texte secondaire | `#a1b2a9` | `#53695c` |
| Accent | `#a6e1c6` | `#286a4d` |
| Biologie | `#b9a6e1` | `#74558d` |
| Mouvement secondaire | `#9bb7ee` | `#456d9b` |
| Contexte / attente | `#e0c397` | `#865d25` |

Source exacte : variables de `apps/personal/src/app/globals.css`. Les couleurs distinguent des domaines ; elles ne qualifient pas des résultats « bons » ou « mauvais ».

Typographie : Inter Variable auto-hébergée, chiffres tabulaires, unités secondaires, titres sans graisse excessive. Rayons 8–16 px, espacements cohérents, traits discrets, pas de verre ou d'animation permanente. Le mouvement est coupé avec `prefers-reduced-motion`.

## Composition

Desktop : sidebar rétractable, en-tête, panneau éditorial, quatre repères chiffrés, courbe principale et bilan sourcé, activités et timeline. Mobile : navigation dédiée en bas et introduction raccourcie pour faire remonter les mesures. Les tableaux défilent dans leur propre conteneur, pas dans la page entière. Les graphiques offrent une alternative tabulaire et des unités explicites.

Composants réutilisables : Panel, Pill, SectionHeading, Modal, Empty, Notice, SourceButton, Skeleton, DataChart, EvidenceModal et ImportModal.

Les sources, statuts de vérification et limites sont visibles près des données. Aucun indicateur global de santé. Les états de dossier vide, filtres vides, chargement, import en cours et erreur de fichier sont réels. Le filtre « erreur d'extraction » n'invente aucun document en erreur : il affiche un état vide, puisqu'aucune extraction n'existe encore.

## Vérification

Captures desktop et mobile, tests de débordement, navigation clavier, focus de dialogue et contrôles accessibles. Audit Axe sur la vue d'ensemble sombre et claire ; ce test ne constitue pas un audit WCAG complet. Pas de test Safari, lecteur d'écran ou appareil mobile physique.

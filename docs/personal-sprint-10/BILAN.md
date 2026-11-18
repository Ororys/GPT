# Sprint 10 — Mesures du centre dans la page Biologie

Date : 18 novembre 2026. Données exclusivement fictives. Décision du fondateur : ajouter les mesures du centre comme nouvelles séries de la page Biologie, sans toucher aux autres pages.

Répond aux recoupements R01 (adiposité ↔ métabolisme), R03 (cardio-rénal) et R05 (fonction musculaire) au niveau V1 : **juxtaposition descriptive**, sans calcul, seuil ni score.

## Réalisé

- **Quatre séries** dans le catalogue existant, catégorie « Mesures du centre » : tour de taille (cm), pression artérielle systolique et diastolique (mmHg), force de préhension (kg).
- **Deux bilans annuels fictifs** (22 octobre 2025, 28 octobre 2026) : le compte rendu de 2026 existait déjà sans résultat, celui de 2025 est ajouté. Chaque valeur pointe vers son compte rendu (page, texte source, PDF généré).
- **Protocole explicite sur chaque valeur** (champ `method` existant), par exemple « Tensiomètre automatique, assis après 5 min de repos, moyenne de 3 mesures… (protocole fictif) ». **Aucune plage de référence** : il n'en existe pas pour ces mesures dans ce prototype, et aucune n'est inventée.
- **Affichages** : carte « Protocole de la mesure sélectionnée » à la place de la carte de référence ; fenêtre source « Sans référence · protocole » ; résumé de consultation avec une section dédiée et ses protocoles ; passeport de qualité avec le protocole et la note « plusieurs protocoles » si l'un change.
- **Aucun changement de schéma** : même modèle d'observation, même table, mêmes contrôles. Le seed idempotent ajoute les séries et le document aux bases existantes ; `labBiomarkers` reste la seule liste utilisée par l'analyse des PDF.
- **Défaut corrigé** : l'axe des graphiques affichait « 22 oct. → 28 oct. » pour deux points distants d'un an (et le même problème existait déjà pour les bilans sur trois ans). L'année est ajoutée dès que la série couvre plusieurs années.

## Vérifications exécutées dans cette session

- Statique, build : OK.
- Unitaires : 35/35, dont invariants (44 observations ; valeurs de laboratoire avec référence, mesures du centre avec protocole et sans référence), passeport (protocole, changement signalé), texte réel du résumé PDF (section, protocole, source).
- PostgreSQL : 20/20 (décomptes mis à jour : 8 documents, 44 observations) ; stockage HTTP : 2/2.
- Navigateur : 21/21 sur PostgreSQL ; 15 réussis + 6 ignorés en mode local. Capture `centre-measures.png`.

## Limites

Deux visites seulement : pas de « trajectoire » au sens du rapport R10. Pas de mesure de masse grasse ni de lever de chaise (protocoles et appareils à définir). Les protocoles sont fictifs et non validés. Les graphiques utilisent un axe par catégories : l'espacement des points n'est pas proportionnel au temps (comportement existant, à revoir si souhaité). Aucune interprétation de la pression artérielle.

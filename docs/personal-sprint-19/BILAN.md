# Sprint 19 — PDF : ordre des colonnes, milliers et libellés de date

Date : 18 novembre 2026 (travail autonome, priorité « consolider le parcours PDF » de CLAUDE.md).

- **Ordre des colonnes lu dans l'en-tête** : les en-têtes Paramètre/Analyse/Examen, Résultat/Valeur, Unité et Référence sont reconnus sans accents ni casse ; l'ordre reste valable sur les pages suivantes. Un en-tête incomplet (sans unité) ou dupliqué n'est pas utilisé. Sans en-tête, l'ordre habituel s'applique.
- **Séparateur de milliers français** (« 1 250 », espace normale, insécable ou fine) : accepté seulement en groupes de trois chiffres exactement. « 1 25 », « 12 3456 » et les doubles espaces sont refusés (valeur non numérique, jamais devinée).
- **Libellés de date** : « PRELEVEMENT : », « Prélevé le », « Date de prélèvement : », « prélèvement du », avec les séparateurs `/`, `.` ou `-`. Toutes les occurrences doivent toujours concorder ; « Edité le » n'est pas une date de prélèvement.
- **Nouveau PDF synthétique `variantes`** (Analyse | Valeurs de référence | Résultat | Unité, ferritine « 1 250 », « Prélevé le 05.11.2026 »), ajouté à la liste blanche par le seed existant.
- **Non-régression** : les sorties des 8 PDF existants ont été comparées avant et après, et sont **identiques à l'octet près**. Les empreintes des PDF des sprints 04 et 19 sont désormais verrouillées par test, en plus de celles du sprint 03.

Vérifications : 57 tests unitaires, 25/25 PostgreSQL (liste blanche incluant `variantes`), navigateur 25/25 sur PostgreSQL et 17 + 8 ignorés en local.

Limites inchangées : un format de tableau contrôlé, un corpus synthétique de 9 PDF, aucune performance d'extraction générale annoncée, pas d'OCR.

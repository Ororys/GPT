# Sprint 08 — Passeport de qualité (R12)

Date : 18 novembre 2026. Données exclusivement fictives. Pages et découpage conservés : le passeport s'ouvre depuis le bandeau « La qualité commence par la transparence » de la vue d'ensemble.

Répond à la vision §7 (« passeport de qualité : provenance, temps de mesure, couverture, méthode, unités, appareil ; données manquantes et non comparables mises en évidence ») et au recoupement R12.

## Réalisé

- **Modèle pur `modules/quality/passport.ts`** :
  - biologie, sur tout l'historique : nombre de résultats, première et dernière date, unités, laboratoires, documents, mode d'obtention (jeu synthétique, import structuré, PDF natif), à vérifier, corrigés ;
  - quotidien, sur 90 jours : couverture en jours distincts, plus longue période sans donnée (jours calendaires, fenêtre bornée), appareils ;
  - notes techniques de comparabilité : unités multiples, plusieurs laboratoires, plusieurs appareils, estimation du fabricant, VFC propre à sa méthode, méthode analytique non indiquée.
  - Pour les activités, aucun « trou » n'est calculé : un jour sans activité n'est pas une donnée manquante.
- **Fenêtre `QualityPassportModal`** (Radix Dialog existant), tableau et cartes, audit Axe AA sans violation.
- **Bandeau corrigé** : il affichait le nombre total de nuits comme « nuits sur 90 jours » et « 6 biomarqueurs » écrit en dur ; les deux sont maintenant calculés.

Aucune migration, aucune nouvelle route : le passeport est calculé à partir du dossier déjà lu.

## Vérifications exécutées dans cette session

- Statique, build : OK.
- Unitaires : 34/34, dont calcul de la plus longue période sans donnée (bornes, fin de fenêtre, fuseau), totaux cohérents, détection unités/laboratoires/appareils multiples, dossier vide.
- PostgreSQL : 19/19 (inchangé).
- Navigateur : 19/19 sur PostgreSQL ; 14 réussis + 5 ignorés en mode fichiers local. Capture `passport.png`.

Un premier passage en mode local a échoué : le test supposait des résultats PDF présents (état laissé par les tests PostgreSQL). Il s'appuie désormais sur une propriété du jeu synthétique présente dans les deux modes.

## Limites

Jours calculés en UTC (C-01). La couverture est un nombre de jours avec au moins une valeur, pas une durée de port de la montre. Pas de version d'algorithme fabricant (non fournie par les fixtures). Pas de notion de protocole de mesure (centre) tant que les mesures du centre ne sont pas modélisées.

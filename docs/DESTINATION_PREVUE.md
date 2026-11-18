# Destination prévue — Convergence Personal V1 (projet à faire relire)

Décision du fondateur (18 novembre 2026) : **la V1 reste strictement descriptive**. Ce texte formalise cette décision pour une revue par un spécialiste réglementaire (B-05). Il ne constitue ni une qualification, ni une déclaration de conformité. La qualification dépend de la destination revendiquée par le fabricant (MDCG 2019-11 rév. 1, juin 2025).

## Destination prévue (proposition)

Convergence Personal V1 est un logiciel destiné aux particuliers. Il leur permet de **rassembler, conserver, afficher et exporter** leurs propres données de santé et de bien-être : bilans biologiques, comptes rendus et mesures d'un centre, données d'activité et de sommeil. Chaque donnée est accompagnée de sa **provenance** (document, page, appareil, protocole, date), de ses **limites** (unités non converties, estimations d'appareil, données manquantes) et de son **historique** (corrections versionnées).

Le logiciel **ne fournit aucune information destinée à des fins de diagnostic, de prévention, de surveillance, de prédiction, de pronostic, de traitement ou d'atténuation d'une maladie**. En particulier, il ne :

- calcule aucun score, risque, classification ni seuil ;
- compare aucune valeur à une norme, sauf à afficher la plage de référence imprimée par le laboratoire sur son propre document ;
- n'émet aucune alerte, recommandation, orientation ni conseil de modification de traitement ;
- ne déduit aucun lien de cause à effet entre les données affichées côte à côte ;
- ne décrit aucune évolution par des termes interprétatifs (« hausse », « amélioration », « risque », « anormal »…).

Utilisateurs prévus : adultes, pour leur propre dossier. Le logiciel n'est pas destiné aux situations d'urgence et ne remplace pas un avis médical. Le résumé exportable sert à **préparer un échange** avec un professionnel, qui reste seul juge de son interprétation.

## Comment le code applique cette destination

| Engagement | Mise en œuvre vérifiable |
|---|---|
| Aucun score, seuil ni alerte | Aucune règle de calcul clinique dans le code ; seuils sourcés volontairement non affichés (sprint 11) |
| Pas de vocabulaire interprétatif | Test automatique sur le texte réel du résumé PDF (`tests/summary.test.ts`) |
| Références propres au laboratoire | Plage attachée à chaque résultat, jamais globale ; aucune plage pour les mesures du centre |
| Provenance et limites visibles | Fenêtre source, passeport de qualité, protocoles, corrections versionnées |
| Données du téléphone | Lecture seule de 5 types, totaux fournis par Santé ou Health Connect, sans calcul ajouté (sprint 14) |
| Aucune extraction automatique présentée comme validée | Résultats PDF « à vérifier », confiance absente, sélection explicite |

## Ce qui ferait sortir de cette destination (V2, programme séparé)

Toute fonction de seuil (EWGSOP2, KDIGO, SCORE2…), d'alerte, de tendance qualifiée, d'orientation, ou de détection, y compris si elle s'adresse à un professionnel. Une telle fonction exigerait une nouvelle qualification, et probablement un marquage CE et une évaluation clinique.

## Points à faire valider

1. Le libellé de la destination et des utilisateurs prévus.
2. L'affichage de la plage de référence du laboratoire (reproduction du document, sans comparaison calculée).
3. Les libellés de l'interface et du résumé, et les couleurs de séries : chaque paramètre a une couleur fixe d'identification, mais un orange (celui de l'HbA1c) pourrait être lu à tort comme une alerte.

## Relecture du 18 novembre 2026 (Claude, non juriste)

Corrections faites dans ce texte :
- ajout de « atténuation d'une maladie », pour reprendre la liste complète de la définition du dispositif médical (article 2 du règlement 2017/745) ;
- ajout de la mention « pas pour les urgences, ne remplace pas un avis médical » ;
- ajout des données du téléphone dans le tableau de mise en œuvre.

Points relevés à trancher, sans modification du texte :
1. **Adultes** : le texte vise les adultes, mais l'application ne vérifie pas l'âge (voir `AIPD_PROJET.md`).
2. **Courbes dans le temps** : afficher une série de valeurs n'est pas une interprétation, mais le mot « surveillance » figure dans la liste des finalités exclues. La personne qui relit doit confirmer qu'un graphique sans seuil ni alerte reste hors de cette finalité.
3. **Mesures du centre** : préciser qui est le « centre » (partenaire, professionnel) et qui est responsable de la mesure.
4. **Couleur orange de l'HbA1c** : la question reste ouverte (point 3 ci-dessus).

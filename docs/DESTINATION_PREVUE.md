# Destination prévue — Convergence Personal V1 (projet à faire relire)

Décision du fondateur (18 novembre 2026) : **la V1 reste strictement descriptive**. Ce texte formalise cette décision pour une revue par un spécialiste réglementaire (B-05). Il ne constitue ni une qualification, ni une déclaration de conformité. La qualification dépend de la destination revendiquée par le fabricant (MDCG 2019-11 rév. 1, juin 2025).

## Destination prévue (proposition)

Convergence Personal V1 est un logiciel destiné aux particuliers. Il leur permet de **rassembler, conserver, afficher et exporter** leurs propres données de santé et de bien-être : bilans biologiques, comptes rendus et mesures d'un centre, données d'activité et de sommeil. Chaque donnée est accompagnée de sa **provenance** (document, page, appareil, protocole, date), de ses **limites** (unités non converties, estimations d'appareil, données manquantes) et de son **historique** (corrections versionnées).

Le logiciel **ne fournit aucune information destinée à des fins de diagnostic, de prévention, de surveillance, de prédiction, de pronostic ou de traitement**. En particulier, il ne :

- calcule aucun score, risque, classification ni seuil ;
- compare aucune valeur à une norme, sauf à afficher la plage de référence imprimée par le laboratoire sur son propre document ;
- n'émet aucune alerte, recommandation, orientation ni conseil de modification de traitement ;
- ne déduit aucun lien de cause à effet entre les données affichées côte à côte ;
- ne décrit aucune évolution par des termes interprétatifs (« hausse », « amélioration », « risque », « anormal »…).

Utilisateurs prévus : adultes, pour leur propre dossier. Le résumé exportable sert à **préparer un échange** avec un professionnel, qui reste seul juge de son interprétation.

## Comment le code applique cette destination

| Engagement | Mise en œuvre vérifiable |
|---|---|
| Aucun score, seuil ni alerte | Aucune règle de calcul clinique dans le code ; seuils sourcés volontairement non affichés (sprint 11) |
| Pas de vocabulaire interprétatif | Test automatique sur le texte réel du résumé PDF (`tests/summary.test.ts`) |
| Références propres au laboratoire | Plage attachée à chaque résultat, jamais globale ; aucune plage pour les mesures du centre |
| Provenance et limites visibles | Fenêtre source, passeport de qualité, protocoles, corrections versionnées |
| Aucune extraction automatique présentée comme validée | Résultats PDF « à vérifier », confiance absente, sélection explicite |

## Ce qui ferait sortir de cette destination (V2, programme séparé)

Toute fonction de seuil (EWGSOP2, KDIGO, SCORE2…), d'alerte, de tendance qualifiée, d'orientation, ou de détection, y compris si elle s'adresse à un professionnel. Une telle fonction exigerait une nouvelle qualification, et probablement un marquage CE et une évaluation clinique.

## Points à faire valider

1. Le libellé de la destination et des utilisateurs prévus.
2. L'affichage de la plage de référence du laboratoire (reproduction du document, sans comparaison calculée).
3. Les libellés de l'interface et du résumé, et les couleurs de séries : chaque paramètre a une couleur fixe d'identification, mais un orange (celui de l'HbA1c) pourrait être lu à tort comme une alerte.

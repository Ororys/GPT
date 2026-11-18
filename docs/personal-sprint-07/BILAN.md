# Sprint 07 — Résumé factuel pour consultation

Date : 18 novembre 2026. Données exclusivement fictives. Pages et découpage conservés : un contrôle est ajouté dans Paramètres, à côté de l'export JSON.

Répond à la vision §7 (« résumé factuel sourcé préparatoire à une consultation, sans diagnostic ni indication thérapeutique ») et au backlog U-02 (export PDF).

## Réalisé

- **Modèle pur `modules/summary/model.ts`** : sélection et comptage uniquement, sur 90 jours, 12 ou 24 mois.
  - biologie par paramètre, valeurs en ordre chronologique, chacune avec date, document source, page, référence du laboratoire, statut « à vérifier » et correction éventuelle (version + valeur lue) ;
  - paramètres sans mesure sur la période listés explicitement ;
  - plusieurs unités pour un paramètre : signalées, jamais converties ni comparées ;
  - quotidien : nuits enregistrées / jours de la période (couverture), moyennes des seules nuits disponibles, méthode de VFC et appareil ; activités ;
  - événements notés, qualité (documents, à vérifier, corrigés).
- **PDF `modules/summary/pdf.ts`** (pdf-lib, multipage, retour à la ligne), avec limites rappelées : dates au jour près, méthodes analytiques non fournies, pas de conversion, mise en parallèle ≠ causalité, données fictives.
- **Route `GET /api/summary?period=90|365|730`** : session requise, période contrôlée (422 sinon), audit `export_summary`, `Cache-Control: no-store`.
- **Migration additive `005_audit_summary_export.sql`** : la liste blanche SQL des événements d'audit refusait `export_summary` (constaté par le test navigateur sur PostgreSQL). Elle est étendue d'un seul événement ; les autres restent refusés.
- **Paramètres** : choix de période et bouton « Télécharger le résumé ».

## Vérifications exécutées dans cette session

Logs dans `evidence/` ; exemple de résumé `resume-consultation-365j.pdf` et capture de la page 1.

- Statique, build : OK.
- Unitaires : 31/31, dont sélection, sources, lacunes, unités mixtes, correction, et extraction du texte réel du PDF avec contrôle d'absence de vocabulaire interprétatif (« hausse », « baisse », « risque », « anormal », « élevé »…).
- PostgreSQL : 19/19, dont audit `export_summary` accepté et événement inconnu refusé.
- Navigateur : 18/18 sur PostgreSQL ; 13 réussis + 5 ignorés (PDF/corrections, PostgreSQL requis) en mode fichiers local.

## Limites

Le contrôle de vocabulaire est une liste de mots, pas une revue réglementaire : les libellés restent à relire (B-05). Le résumé n'inclut pas encore de graphique. Les moyennes du quotidien ne pondèrent pas la couverture ; la couverture est affichée à côté. Aucune signature ni horodatage qualifié du document.

# Bloquants externes : recommandations sourcées (18 novembre 2026)

Note de décision préparée à la demande du fondateur : « statue grâce à tes recherches et données objectives ». Aucun compte n'a été créé, aucun contrat signé, aucune dépense engagée. Ce document **recommande** ; les décisions juridiques et réglementaires restent à valider par les personnes compétentes (`BLOCKERS.md`). Les sources sont celles effectivement consultées ; ce qui n'a pas pu être vérifié est signalé.

## Synthèse

| Bloquant | Recommandation | Peut-on avancer sans dépense ? |
|---|---|---|
| B-05 Qualification MDR | Garder la V1 **strictement descriptive** et l'écrire dans une « destination prévue » formelle ; faire relire par un spécialiste avant toute exposition. | Oui : rédaction de la destination prévue et revue des libellés. |
| B-02 Hébergement santé | Choisir un hébergeur **figurant sur la liste ANS avec un certificat au référentiel HDS v2** couvrant les activités nécessaires. | Présélection oui ; contrat = dépense. |
| B-03 RGPD | Prévoir une **AIPD** avant tout traitement réel. | Oui : démarrer l'AIPD sur le prototype. |
| B-01 Identité | Patients : OIDC standard avec MFA chez un fournisseur hébergé de façon conforme. Professionnels : **Pro Santé Connect** (gratuit, OIDC). | Intégration PSC possible en environnement de test après demande de raccordement. |
| B-08 Connecteurs | HealthKit et Health Connect exigent des **applications natives**. Garmin : accès sur approbation, **nouvelles demandes signalées en pause**. | Non pour Garmin ; prototypes natifs possibles mais hors de ce dépôt. |

## B-05 — Qualification réglementaire (MDR)

- **Fait** : la révision 1 du guide MDCG 2019-11 (qualification et classification des logiciels) a été publiée le 17 juin 2025 ; elle ne change pas la logique de qualification. C'est la **destination prévue** revendiquée par le fabricant qui détermine si le logiciel est un dispositif médical. [Commission européenne](https://health.ec.europa.eu/latest-updates/update-mdcg-2019-11-rev1-qualification-and-classification-software-regulation-eu-2017745-and-2025-06-17_en), [analyse Emergo](https://www.emergobyul.com/news/european-revision-primary-software-guidance-mdcg-2019-11-revision-1-small-changes-meaningful).
- **Recommandation** : formaliser une destination prévue limitée à « conserver, présenter et exporter des données de santé personnelles avec leur provenance, sans interprétation ». Le code applique déjà cette limite : pas de seuil, de score ou de vocabulaire interprétatif (test sur le texte du résumé PDF). Toute fonction d'alerte, de seuil (EWGSOP2, KDIGO, SCORE2…) ou d'orientation relève de la V2 et d'une nouvelle qualification.
- **À vérifier par un spécialiste** : les exemples du guide sur les applications de bien-être, non consultés directement ici.

## B-02 — Hébergement de données de santé (HDS)

- **Fait** : depuis le 16 mai 2026, seuls les certificats HDS attestant le **référentiel v2** sont valides ; l'ANS publie la liste des hébergeurs certifiés (411 en mai 2026) en indiquant la version du référentiel. Un référentiel v2.1 est en concertation (loi SREN). [Liste ANS](https://esante.gouv.fr/offres-services/hds/liste-des-hebergeurs-certifies), [webinaire ANS mars 2026](https://esante.gouv.fr/sites/default/files/media/document/20260318%20Webinaire%20HDS%20-%20v1.0_0.pdf), [offre HDS](https://esante.gouv.fr/ens/offre/hds).
- **Recommandation** : présélectionner 2 ou 3 hébergeurs de la liste ANS certifiés v2, sur les activités nécessaires (infrastructure + infogérance PostgreSQL managé + sauvegarde), avec une date de validité vérifiée. L'architecture actuelle (Next.js + PostgreSQL 16, aucun service externe) s'y transpose sans changement. Ne retenir aucune information de cabinet qui contredirait les dates de l'ANS.
- **Dépense** : contrat d'hébergement. **Décision du fondateur.**

## B-03 — RGPD

- **Fait** : selon la CNIL, une AIPD doit être réalisée pour la majorité des traitements de données de santé ; la CNIL publie une liste des traitements qui l'exigent et une liste de ceux qui en sont exemptés. [CNIL — exigences générales santé](https://cnil.fr/fr/sante-exigences-generales), [liste AIPD requise](https://www.cnil.fr/sites/default/files/atoms/files/liste-traitements-avec-aipd-requise-v2.pdf).
- **Recommandation** : lancer l'AIPD dès maintenant, sur la base du prototype. Le dépôt fournit déjà la matière : flux de données, RLS, audit, autorisations versionnées par source (sprint 09), absence de suppression (B-04). Désigner un DPO ou un conseil.
- **Non vérifié** : le contenu détaillé de la liste CNIL (seul l'en-tête du PDF a été lu).

## B-01 — Identité

- **Fait** : Pro Santé Connect est le fournisseur d'identité national des professionnels de santé. Il utilise OpenID Connect, propose les flux Code et CIBA (mobile), et le service est gratuit et maintenu par l'ANS. Le raccordement suit une demande auprès de l'ANS, avec une e-CPS de test. [ANS — Pro Santé Connect](https://esante.gouv.fr/produits-services/pro-sante-connect), [FAQ raccordement](https://esante.gouv.fr/faq/je-voudrais-ajouter-pro-sante-connect-comme-moyen-didentification-electronique-sur-un-service-numerique-comment-faire), [présentation CIBA](https://industriels.esante.gouv.fr/sites/default/files/media/document/ANS_PSC_Presentation%20int%C3%A9gration%20CIBA.pdf).
- **Recommandation** : PSC pour le futur accès professionnel (B-07). Pour les patients (B2C), un fournisseur OIDC avec MFA, hébergé de façon compatible HDS. Le code est prêt pour ce remplacement : identité isolée dans `modules/identity`, sujet SQL contrôlé par `personal.guard`. Il faudra lier le sujet à un jeton vérifié côté base (backlog S-02).
- **Non tranché** : le fournisseur patient précis, faute de comparaison sourcée dans cette session.

## B-08 — Connecteurs

- **Fait** : Health Connect s'utilise depuis une application Android et stocke un instant et un décalage de fuseau par enregistrement ([Android](https://developer.android.com/health-and-fitness/health-connect/features/sleep-sessions)). L'accès à l'API santé de Garmin est soumis à approbation ; des sources de septembre 2026 signalent une **pause des nouvelles demandes**, et des refus sans explication ont été rapportés. [Garmin Health API](https://developer.garmin.com/gc-developer-program/health-api), [the5krunner](https://the5krunner.com/2026/09/14/garmin-developer-api-access-paused/), [Terra](https://tryterra.co/blog/garmin-connect-developer-program-pause).
- **Recommandation** : ne pas bâtir la feuille de route sur Garmin à court terme. Prioriser Health Connect (Android) et HealthKit (iOS) via une application compagnon native, qui transmettrait instant + décalage. Le modèle actuel est prêt pour ce format : règle du jour local du sprint 11, autorisations par source du sprint 09.
- **Non vérifié ici** : les conditions HealthKit (connaissance générale : API disponible dans les apps iOS, pas depuis le web), à confirmer sur la documentation Apple.

## Ce qui reste hors code et à la main du fondateur

1. Rédiger et faire relire la destination prévue (B-05).
2. Choisir un hébergeur HDS v2 et signer (B-02, dépense).
3. Lancer l'AIPD et désigner un DPO ou un conseil (B-03).
4. Demander le raccordement Pro Santé Connect (B-01, B-07).
5. Décider du lancement d'applications natives Android/iOS (B-08).
6. Revue de sécurité indépendante avant toute exposition (B-10, dépense).

## Suite donnée par le fondateur (18 novembre 2026)

- B-05 : V1 strictement descriptive confirmée ; destination prévue rédigée dans [DESTINATION_PREVUE.md](DESTINATION_PREVUE.md), à faire relire.
- B-02 : comparatif demandé, voir [COMPARATIF_HDS.md](COMPARATIF_HDS.md).
- B-08 : applications Android et iOS souhaitées.
- B-01 : vraie connexion patient prioritaire dans le code.

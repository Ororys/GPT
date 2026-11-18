# Bloquants — décisions ou interventions humaines requises

Aucun de ces points ne peut être levé par du code seul. Tant qu'ils sont ouverts : **données synthétiques uniquement**.

| ID | Bloquant | Ce qu'il faut | Qui |
|---|---|---|---|
| B-01 | Identité réelle | Choisir un fournisseur d'identité (OIDC, Pro Santé Connect pour les professionnels à étudier), MFA, enrôlement, révocation de session. Nécessite un compte externe et des secrets. | Fondateur + sécurité |
| B-02 | Hébergement de données de santé | Hébergeur certifié HDS, contrats de sous-traitance, chiffrement, sauvegardes, PRA. Dépense. | Fondateur + juridique |
| B-03 | RGPD | Base légale, finalités, AIPD, registre, information, DPO. | Juridique / DPO |
| B-04 | Conservation contre effacement | L'historique est techniquement immuable ; arbitrer durées de conservation, effacement, rectification. | Juridique + médecin |
| B-05 | Qualification MDR de la V1 | Avis d'un spécialiste : l'affichage d'écarts et de rapprochements reste-t-il hors dispositif médical ? Les libellés doivent être relus. | Réglementaire |
| B-06 | Unités et terminologies | Rattachement LOINC/UCUM et règles de conversion validés sur valeurs de référence par un biologiste. D'ici là, toute unité non canonique est refusée. | Biologiste |
| B-07 | Matrice d'accès soignants | Valider le périmètre IDE (aujourd'hui : mesures sans lecture), les délégations et l'accès d'urgence. | Responsable médical |
| B-08 | Connecteurs réels | Applications natives iOS/Android, comptes développeur, programme Garmin, convention de laboratoire, licence d'export FotoFinder. Aucun accès n'a été inventé. | Fondateur + fournisseurs |
| B-09 | V2 clinique | Destination médicale, gestion des risques, évaluation clinique, système qualité. Aucun code V2 n'existe ; `clinical_module` est verrouillé non exécutable. | Médical + réglementaire |
| B-10 | Revue de sécurité indépendante et test d'intrusion | Prestataire externe avant toute exposition réseau. Dépense. | Fondateur |
| B-11 | Confirmation Docker sur votre poste | Lancer `docker compose up --build` avec le `Dockerfile` livré (non exécutable tel quel ici, voir TEST_REPORT.md). | Vous |


## Compléments v3.1

B-11 reste ouvert : Docker est absent de cette session, aucune construction Docker n'est revendiquée. Les tests locaux utilisent PostgreSQL compilé et Chromium téléchargé. Le workflow GitHub est livré, pas exécuté sur un compte externe.

Avant toute migration d'une base existante : examiner les versions multiples d'un même identifiant source et les horodatages fractionnaires v3.0 perdus ; aucune réparation automatique ne peut inventer l'information manquante. Validation de restauration, rétention, audit externe, fuseaux patients et règles d'agrégation restent nécessaires.


## Nouvel espace B2C — 18 novembre 2026

L'adaptateur personnel est volontairement synthétique avec reçus locaux mono-processus. Il ne possède pas encore de persistance PostgreSQL et n'est pas un stockage médical exploitable. L'import JSON de démo n'est pas une extraction PDF. Fournisseurs, OCR, IA, partage professionnel et vraie identité restent non opérationnels. Tous les blocages de production et l'interdiction des données réelles restent applicables.


## Actualisation sprint 02 / 0.2

La limite « nouvel espace sans PostgreSQL » de la version 0.1 est levée. L'identité demeure fictive, les rôles API font confiance au sujet transmis et l'audit n'est pas indépendant de l'appelant ni de l'administrateur. Aucun fournisseur, OCR/LLM, document réel, sauvegarde/PRA ou conformité n'est validé. L'exécution locale a utilisé PostgreSQL 16.11, pas le nouveau Compose. Les reçus fichiers anciens sont conservés mais non repris automatiquement.

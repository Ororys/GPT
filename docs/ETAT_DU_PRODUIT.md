# Où en est Convergence — état au 19 novembre 2026

Document de synthèse pour le fondateur, en langage simple. Référence technique de l'API : `API_PERSONAL.md`. Le détail de chaque étape est dans `docs/personal-sprint-NN/BILAN.md`, avec ses preuves de tests.

## Ce que fait le produit aujourd'hui

**Au lancement (décision du 19 novembre 2026) : une application Android et iPhone dont les données restent chiffrées sur le téléphone**, sans serveur ni compte, déverrouillée par un code. Le site web montre la démonstration aux profils fictifs. La version hébergée (serveur, vraie connexion) est conservée pour plus tard.

| Fonction | État |
|---|---|
| Vue d'ensemble, Biologie, Sport, Documents, Timeline, Paramètres | En place (5 pages + réglages, design d'origine conservé) |
| Application « sur le téléphone » | Premier lancement (majorité, information), code, rangement des PDF, export, suppression d'un document ou de tout, retrait d'une autorisation avec effacement (sprint 23) |
| Lecture de PDF de laboratoire | Texte natif, format de tableau contrôlé, 9 PDF de test fictifs. Revue avant ajout, blocage des cas ambigus, correction versionnée, doublons signalés |
| Mesures du centre | Tour de taille, tension, préhension, 5 levers de chaise, masse grasse : avec protocole, sans norme inventée |
| Données du téléphone | Lues dans Santé (iPhone) et Health Connect (Android) en lecture seule : sommeil, FC au repos, VFC, pas, distance. Sans double comptage, synchronisées à l'ouverture de l'application |
| Résumé pour consultation | PDF factuel avec sources et lacunes, sans interprétation |
| Passeport de qualité | Provenance, couverture et comparabilité de chaque série |
| Autorisations | Par source (PDF, import, téléphone), révocables, appliquées par la base de données |
| Connexion réelle | Fournisseur d'identité standard avec double authentification obligatoire ; profils fictifs pour la démonstration |
| Sécurité | Cloisonnement par dossier en base, historique non modifiable, base qui vérifie elle-même la session, en-têtes de sécurité |
| Export | Export complet de toutes les données du dossier (droit d'accès) |
| Accessibilité | Audit automatique WCAG AA : 0 défaut sur toutes les pages, en thème clair et sombre, sur ordinateur et téléphone |
| Sauvegarde | Exercice automatique : sauvegarde puis restauration identique, protections conservées |

## Ce qui est vérifié automatiquement à chaque modification (GitHub)

- 58 tests de logique, 26 tests sur une vraie base PostgreSQL, un exercice de sauvegarde et restauration ;
- 26 parcours dans un vrai navigateur, plus 6 parcours de connexion réelle et l'audit d'accessibilité ;
- la compilation des applications Android et iPhone.

## Ce qui n'est pas encore vérifié

- Le fonctionnement sur un **vrai téléphone** : lecture de Santé ou Health Connect, rendu sous l'encoche.
- Un audit d'accessibilité **manuel** (lecteur d'écran réel).
- Une revue de sécurité **indépendante** (test d'intrusion).

## Ce qui ne dépend que de vous

1. **Hébergement de santé** : choisir un hébergeur certifié HDS et demander des devis. Clever Cloud est en premier choix, pour environ 300 à 450 €/mois HT estimés, connexion comprise (voir `COMPARATIF_HDS.md`). Sans hébergement, l'application ne peut pas recevoir de vraies personnes.
2. **Fournisseur d'identité** pour les patients : Keycloak géré par l'hébergeur est recommandé (voir `COMPARATIF_HDS.md`).
3. **Relecture réglementaire** de la destination prévue (`DESTINATION_PREVUE.md`), déjà relue et complétée une première fois.
4. **RGPD** : analyse complète et liste d'actions dans `ANALYSE_RGPD.md`, projet d'AIPD dans `AIPD_PROJET.md`, à faire valider par un avocat ou un DPO. Écart majeur : il est impossible aujourd'hui de supprimer un compte.
5. **Comptes de publication** : Apple Developer (99 $/an) et Google Play (25 $, une fois).
6. **Visibilité du dépôt GitHub** : il est public, alors qu'il contient les dossiers maîtres et les documents d'entreprise.

## Questions gardées pour votre réveil

1. **Dépôt public** : on le passe en privé ? Attention : GitHub facture alors les machines Mac de compilation iPhone au-delà d'un quota gratuit.
2. **Démo mobile Sites** : elle est restée à l'état du sprint 11, faute d'accès pour la republier. Faut-il la maintenir, ou l'abandonner au profit des vraies applications ?
3. **Séances d'entraînement du téléphone** : faut-il aussi lire les séances (course, vélo) ? Cela demande une autorisation de plus sur le téléphone.
4. **Couleur des séries** : l'orange de l'HbA1c peut être lu comme une alerte. Faut-il passer à une palette sans couleurs « signal » ?
5. **Mode paysage sur téléphone** : est-ce une priorité ?

# Plan : lancement « données sur le téléphone » et RGPD (19 novembre 2026)

**Décision du fondateur :** pour le lancement, les données de santé restent sur le téléphone, avec un écran de connexion propre à l'application, afin de ne rien payer en hébergement. Ce document était un plan ; **sa réalisation est décrite dans `personal-sprint-23/BILAN.md`** (étapes 1, 2 et 4 faites, étape 3 sans la biométrie). La version serveur (PostgreSQL, OIDC) est **conservée telle quelle** dans le dépôt pour plus tard : synchronisation, partage avec un soignant.

## Ce que la décision change

| Sujet | Avant | Au lancement |
|---|---|---|
| Où sont les données | Serveur (PostgreSQL), donc hébergeur HDS obligatoire | **Sur le téléphone, chiffrées**. Aucun serveur ne reçoit de donnée de santé, donc pas de HDS |
| Coût d'hébergement | ≈ 300 à 450 €/mois estimés | **0 €**. Restent les comptes Apple (99 $/an) et Google Play (25 $, une fois) |
| Connexion | Fournisseur d'identité + double authentification | **Verrouillage de l'application** : code + empreinte ou Face ID, sans compte |
| Version web | Même site que l'application | **Démonstration avec profils fictifs** uniquement |
| RGPD | La société détient toutes les données : DPO, AIPD et registre obligatoires | La société **n'a accès à aucune donnée** : obligations fortement réduites, **à faire confirmer par un avocat** |
| Pages et design | — | **Inchangés** |

### Pourquoi un verrouillage plutôt qu'un compte

Un vrai compte (e-mail et mot de passe) exige un serveur pour le stocker. Il y aurait donc un coût, des données personnelles chez nous et une cible d'attaque, pour protéger des données qui ne sont de toute façon pas sur le serveur. Sur le téléphone, la bonne protection est un **verrou local** : code de l'application plus biométrie, avec une clé de chiffrement gardée dans la puce sécurisée du téléphone (Keychain sur iPhone, Keystore sur Android).

## Étapes de développement

### Étape 1 — Moteur de stockage sur le téléphone
- Créer un « dépôt local » qui offre les mêmes opérations que l'API actuelle : dossier, PDF (analyse, confirmation), corrections, autorisations, données du téléphone, export, résumé.
- Recoder en TypeScript les règles que la base garantit aujourd'hui : historique en ajout seul, corrections versionnées, autorisation exigée par source, doublons signalés, jour local.
- Chiffrer le stockage, avec une clé conservée dans Keychain ou Keystore.
- Adapter au navigateur le peu de code propre au serveur (`node:crypto` remplacé par WebCrypto). La lecture PDF (unpdf) et le résumé PDF (pdf-lib) fonctionnent déjà dans un navigateur.
- **Tests** : reprendre les garanties des tests PostgreSQL en tests du dépôt local (immuabilité, autorisation, versions, doublons, jour local).

### Étape 2 — Application sans serveur
- Remplacer les 12 appels `fetch('/api/…')` des écrans par une interface unique, avec deux implémentations : « HTTP » pour la démo web et le futur serveur, « locale » pour l'application.
- Produire une version statique des pages (export Next.js) embarquée dans l'application. Capacitor n'ouvre plus d'adresse distante.
- **Android : retirer la permission Internet.** C'est une preuve vérifiable que rien ne sort du téléphone, contrôlée par un test sur le manifeste. Sur iPhone, une politique de contenu interdira toute connexion externe.

### Étape 3 — Verrouillage
- Création d'un code au premier lancement, puis déverrouillage par biométrie.
- Verrouillage automatique en arrière-plan.
- Code jamais stocké en clair : il est dérivé avec PBKDF2 via WebCrypto. Le choix du module biométrique Capacitor reste à faire, avec une version publiée depuis au moins deux semaines.
- **Code oublié** : sans serveur, les données sont irrécupérables. Il faudra le dire clairement et proposer l'export.

### Étape 4 — Fonctions RGPD
| # | Fonction | Article |
|---|---|---|
| R1 | **Premier lancement** : déclaration de majorité (18 ans), écran d'information clair, puis autorisations par source (déjà codées), avec la version du texte enregistrée | 7, 8, 13 |
| R2 | **« Supprimer toutes mes données »** : effacement du stockage, des PDF et de la clé, après confirmation, avec un test qui vérifie qu'il ne reste rien | 17 |
| R3 | **Retrait d'une autorisation** : choix entre « arrêter » et « arrêter et effacer les données de cette source » | 7.3, 17.1.b |
| R4 | **Export** : fichier complet et résumé PDF, à enregistrer où l'utilisateur veut (feuille de partage). C'est aussi sa sauvegarde | 15, 20 |
| R5 | **Rectification et suppression** d'une saisie ou d'une mesure, historique conservé | 16, 17 |
| R6 | **Aucune sortie de données** : pas de mesure d'audience ni de rapport de plantage, test sur les permissions et la politique de contenu | 25 |
| R7 | **Sauvegardes cloud exclues** : données exclues des sauvegardes automatiques iCloud et Google. Évite un transfert non voulu ; les règles d'Apple encadrent le stockage des données Santé dans iCloud | 32 |
| R8 | **Politique de confidentialité** intégrée à l'application et déclarations des magasins (« aucune donnée collectée ») | 13 |

### Étape 5 — Tests et intégration continue
- Tests unitaires du dépôt local, des tests navigateur sur la version statique avec un faux pont téléphone, la compilation Android et iPhone sur GitHub.
- La version serveur garde ses tests actuels.

### Étape 6 — Documents
- Mettre à jour `ANALYSE_RGPD.md` et `AIPD_PROJET.md` : la société devient éditeur d'un logiciel sans accès aux données.
- Mettre à jour `CLAUDE.md` et `ETAT_DU_PRODUIT.md`.

## Points bloquants hors code pour un vrai lancement

1. **PDF de vrais laboratoires** : le lecteur ne reconnaît aujourd'hui que des PDF de test fictifs (liste blanche). Pour de vrais bilans, il faut développer la lecture des formats des grands laboratoires, ce qui demande des exemples anonymisés fournis légalement. En attendant, l'ajout de PDF réels reste désactivé, ou limité à l'archivage du document sans lecture des valeurs.
2. **Mesures du centre** : sans serveur, il faut décider comment elles arrivent sur le téléphone (saisie par l'utilisateur, fichier remis par le centre).
3. **Avis d'avocat** sur le statut RGPD de l'éditeur dans ce modèle, et relecture de la destination prévue (MDR).
4. **Comptes Apple et Google**, et vérification des règles HealthKit et Health Connect à jour.
5. **Perte du téléphone = perte des données** si l'utilisateur n'a pas exporté : le dire à l'écran.

## Ordre proposé

Étapes 1 et 2 d'abord, car tout en dépend. Ensuite R2, R1 et l'étape 3, puis le reste de l'étape 4 et les étapes 5 et 6. Chaque étape est testée et poussée séparément ; la démo web reste fonctionnelle à chaque étape.

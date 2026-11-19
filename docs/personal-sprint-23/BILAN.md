# Sprint 23 — Lancement « données sur le téléphone » et fonctions RGPD (19 novembre 2026)

## Décisions du fondateur

- Au lancement, les données restent **sur le téléphone**, sans hébergement payant.
- Connexion : **verrouillage de l'application par code**, sans compte (option 1 du plan).
- Site web : **démonstration aux profils fictifs** uniquement (option 2).
- PDF : **rangement** ; lecture par **IA en ligne**, en **lecture seule** (sans interprétation), demandée pour plus tard.

## Ce qui est livré

| Élément | Où |
|---|---|
| Coffre chiffré sur le téléphone : AES-256-GCM, clé enveloppée par un code de 6 à 12 chiffres (PBKDF2-SHA-256, 600 000 itérations), code jamais stocké, nom de chaque entrée authentifié | `src/modules/local/vault.ts` |
| Dépôt local : autorisations versionnées, import téléphone idempotent (index chiffré, noms d'entrées aléatoires), PDF conservés tels quels, export, suppression | `src/modules/local/store.ts` |
| Premier lancement : information (version enregistrée), déclaration de majorité, prénom facultatif, création du code | `src/components/device-gate.tsx` |
| Verrouillage : écran de code, verrouillage après 2 minutes en arrière-plan ou au rechargement, attente de 30 s après 5 erreurs, « Code oublié : tout effacer » | idem |
| Rangement d'un PDF : nom, type, date, origine, nombre de pages compté sur le téléphone ; valeurs non lues | `src/components/pdf-add-modal.tsx` |
| Paramètres : autorisations avec « Retirer » ou « Retirer et effacer », import Santé ou Health Connect, export complet, résumé PDF généré sur le téléphone, verrouiller, « Supprimer toutes mes données » | `src/components/device-settings.tsx` |
| Fenêtre source : ouvrir le PDF déchiffré, « Supprimer ce document » | `src/components/evidence-modal.tsx` |
| Pages statiques embarquées (`npm run build:mobile`), politique de contenu `connect-src 'self'` : la page ne peut contacter qu'elle-même | `scripts/build-mobile.ts` |
| Application : pages embarquées par défaut, mode hébergé conservé via `CONVERGENCE_SERVER_URL` | `apps/mobile/capacitor.config.ts` |
| Données exclues des sauvegardes Google (`allowBackup=false`, règles d'extraction) et iCloud (`isExcludedFromBackup` sur le stockage de la WebView) | manifeste Android, `AppDelegate.swift` |

La version hébergée (PostgreSQL, OIDC, routes `/api`) n'est pas modifiée et garde tous ses tests.

## Correspondance avec le plan RGPD

| Action du plan | État |
|---|---|
| R1 Premier lancement (majorité, information versionnée, autorisations) | Fait |
| R2 Supprimer toutes mes données | Fait, avec un test qui vérifie que la base du navigateur est vide |
| R3 Retrait avec effacement | Fait |
| R4 Export complet | Fait (JSON, PDF inclus) |
| R5 Suppression d'un document | Fait. La rectification des valeurs viendra avec la lecture des PDF |
| R6 Aucune sortie de données | Fait : politique de contenu, et test E2E qui échoue à toute requête hors de l'origine |
| R7 Sauvegardes cloud exclues | Configuré, vérifié par un test sur les fichiers ; **à confirmer sur un vrai téléphone** |
| R8 Politique de confidentialité intégrée | Texte d'information intégré ; la politique définitive reste à rédiger par un juriste |
| Biométrie (Face ID, empreinte) | **Non fait** : demande un module natif supplémentaire, à tester sur un vrai téléphone |

## Preuves

- `tests/local-store.test.ts` : 8 tests (code, chiffrement sans rien de lisible ni d'empreinte en clair, majorité, autorisations, PDF, téléphone, retrait avec effacement, export puis suppression totale).
- `tests/device.spec.ts` (Chromium, format Pixel 7, sur les pages statiques) : parcours complet, et audit d'accessibilité WCAG A/AA sur trois écrans.
- `apps/mobile/tests/config.test.ts` : 5 tests (pages embarquées par défaut, sauvegardes exclues).
- Suite unitaire complète : 66/66.

## Limites connues

1. **Rien n'est encore vérifié sur un vrai téléphone** : ouverture d'un PDF et téléchargement d'un export depuis la WebView Android, exclusion effective des sauvegardes, performance du chiffrement sur un téléphone ancien.
2. La clé est protégée par le code seul : un code de 6 chiffres reste devinable par force brute si quelqu'un copie le stockage du téléphone, malgré les 600 000 itérations. Il faudra garder la clé dans le Keychain ou le Keystore (avec la biométrie) et recommander un code plus long.
3. **Lecture des PDF par IA en ligne : non codée.** Elle demande un compte et une clé chez un fournisseur d'IA (dépense), un petit serveur relais pour ne pas mettre la clé dans l'application (hébergement, donc plus « 0 € »), un contrat sans conservation des données, et une mise à jour de l'analyse RGPD, puisque le PDF quitterait le téléphone.
4. Au démarrage, l'application ouvre toujours la page d'accueil ; recharger une autre page n'est pas prévu dans l'application.

## Intégration continue (GitHub, 19 novembre 2026)

Tout est vert sur les commits `d2e7dd2` et `ca8fc4f` :
- « Personal B2C prototype » : l'étape `build:mobile` puis `test:e2e:device` passe (run 44431172123), avec le reste de la suite (PostgreSQL, connexion réelle, démo web, sauvegarde) ;
- « Mobile apps » : les compilations Android et iPhone réussissent avec les pages embarquées (runs 44431066039 et 44431172213).

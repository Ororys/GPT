# Sprint 13 — Applications Android et iOS (Capacitor) et données santé du téléphone

Date : 18 novembre 2026. Décision du fondateur : l'application entière doit exister en application mobile, en plus du site web.

## Choix d'architecture

- **Capacitor 8** (`apps/mobile`) : l'application native ouvre le même serveur que le site. Mêmes écrans, même session, mêmes contrôles Host/Origin et CSP : il n'y a pas de seconde API à sécuriser. Une page hors ligne s'affiche si le serveur est injoignable. HTTPS est obligatoire hors développement local (adresse fixée à la compilation par `CONVERGENCE_SERVER_URL`).
- **Santé du téléphone** : `@capgo/capacitor-health` (HealthKit sur iOS, Health Connect sur Android). Versions choisies parmi celles publiées depuis au moins deux semaines (Capacitor 8.6.0, plugin 8.11.14). [Documentation du plugin](https://capgo.app/docs/plugins/health/).
- **Minimisation** : le plugin déclare 47 permissions de lecture et d'écriture. 41 sont retirées (`tools:node="remove"`) : **aucune écriture**, lecture limitée à sommeil, FC au repos, VFC, pas et distance. minSdk 26 (exigence Health Connect). Côté iOS : droit HealthKit, messages d'usage en français.
- **Alternative écartée** : réécrire l'interface en React Native, ce qui aurait doublé le code et retardé la parité avec le web.

## Serveur

- Migration additive **`009_device_records.sql`** : table `device_record` en ajout seul, idempotente (clé SHA-256), sous RLS, avec des unités imposées et sans conversion. Nouvelle autorisation **`device-health`**, jamais accordée par la préparation de la démo ; elle est contrôlée par trigger.
- `POST/GET /api/device-imports` : schéma strict, 500 enregistrements maximum par envoi, dates futures refusées.
- Pont natif `modules/device/bridge.ts`, chargé seulement dans l'application. Panneau « Données santé du téléphone » dans Paramètres. Une autorisation jamais accordée affiche « Non autorisé » (et non plus « Retiré »).
- Les données reçues **ne sont pas mélangées** aux séries synthétiques des pages Sport et Vue d'ensemble : leur affichage est une étape distincte.

## Vérifications

Dans cette session :
- 46 tests unitaires, 23 PostgreSQL, 22 navigateur sur PostgreSQL, 15 + 7 ignorés en local, 6 connexion réelle.
- 3 tests de configuration native : HTTPS, permissions Android restantes exactement les 5 attendues, HealthKit et messages iOS.

Sur GitHub Actions (commit `d536a93`) :
- vérifications et **build Android debug réussis** (APK en artefact) ;
- tests web et serveur réussis, y compris le parcours de connexion réelle ;
- build iOS simulateur : **non exécuté**. Sur les deux runs (`d536a93`, `a8ec596`), aucune machine macOS n'a été attribuée par GitHub : le job est resté en file d'attente 15 minutes, puis a été annulé sans exécuter une seule étape. Ce n'est pas un échec de compilation. Le code iOS n'est donc **pas encore vérifié** ; il faudra relancer le job, ou compiler sur un Mac.
- build Android : réussi deux fois.

**Non vérifié** : la lecture réelle de Santé ou Health Connect sur un téléphone. Aucun appareil ni émulateur n'est disponible ici (pas de KVM, `dl.google.com` bloqué).

## Pour une installation réelle

1. Un serveur hébergé en HTTPS chez un hébergeur HDS (B-02), pour la variable `CONVERGENCE_SERVER_URL`.
2. Une signature : compte Apple Developer (99 $/an, HealthKit exige un profil signé) et compte Google Play (25 $, une fois).
3. Une vraie politique de confidentialité (`www/privacypolicy.html` est explicitement provisoire), puis l'AIPD.
4. Des tests sur appareils réels avant toute publication.

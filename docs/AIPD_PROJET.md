# Analyse d'impact (AIPD) — projet de travail, 18 novembre 2026

**Statut : brouillon rédigé à partir du code, à reprendre et valider par un DPO ou un conseil.** Ce document ne vaut ni AIPD validée, ni déclaration de conformité RGPD. Il suit le plan de la méthode CNIL (contexte, principes fondamentaux, risques, plan d'action) pour gagner du temps. Le prototype ne traite aujourd'hui **que des données fictives**.

## 1. Contexte

| Élément | Contenu |
|---|---|
| Traitement | Dossier de santé personnel : rassembler, conserver, afficher et exporter ses propres données (voir `DESTINATION_PREVUE.md`) |
| Responsable de traitement | La société éditrice (à nommer) |
| Personnes concernées | Particuliers adultes, pour leur propre dossier |
| Pourquoi une AIPD | Données de santé (article 9) traitées à grande échelle pour des personnes potentiellement vulnérables : la CNIL classe ce type de traitement parmi ceux qui exigent une AIPD |
| Sous-traitants prévus | Hébergeur certifié HDS (application + base), fournisseur d'identité (voir `COMPARATIF_HDS.md`) |
| Hors du traitement | Apple et Google : les données du téléphone sont lues sur l'appareil puis envoyées à notre serveur, pas à eux. GitHub ne contient que du code et des données fictives |

### Données traitées (relevé dans le code)

| Catégorie | Où | Exemples |
|---|---|---|
| Identité de connexion | `personal.actor`, migration 008 | Identifiant pseudonyme du fournisseur d'identité (`sub`), sans e-mail ni nom stocké par l'application |
| Biologie | `observation`, `document`, `pdf_intake`, `pdf_review`, `observation_correction` | Résultats, unités, plages du laboratoire, PDF d'origine, corrections et motifs |
| Mesures du centre | `observation` | Tour de taille, tension, préhension, levers de chaise, masse grasse |
| Activité, sommeil, événements | `activity`, `sleep_session`, `life_event` | Séances, nuits, événements de vie saisis |
| Données du téléphone | `device_record` | Sommeil, FC au repos, VFC, pas, distance (5 types, lecture seule) |
| Autorisations | `source_consent` | Accord ou retrait par source, versionné |
| Journal | `audit` | Qui a lu ou exporté quoi, quand |

## 2. Principes fondamentaux

| Principe | Situation actuelle | Écart |
|---|---|---|
| Finalité déterminée | Une seule : dossier personnel descriptif | — |
| Base légale | À fixer. Proposition : **consentement explicite** (art. 9.2.a) pour les données de santé, contrat (art. 6.1.b) pour le compte | Rédiger le recueil du consentement et le conserver |
| Minimisation | 5 types de données du téléphone seulement ; pas d'e-mail ni de nom stocké ; pas de traceur publicitaire | Vérifier ce que le fournisseur d'identité conserve de son côté |
| Exactitude / rectification | Correction versionnée des résultats lus dans un PDF | **Pas de rectification pour les autres données** (mesures, activité) |
| Durée de conservation | **Non définie** | À fixer, y compris pour le journal (B-04) |
| Information | Page « données de santé » dans l'application mobile, marquée « prototype » | Politique de confidentialité définitive à écrire |
| Accès et portabilité (art. 15, 20) | Export complet JSON du dossier | — |
| Retrait du consentement | Par source, dans les paramètres, appliqué par la base | Le retrait arrête les nouvelles entrées mais **ne supprime rien** |
| **Effacement (art. 17)** | **Impossible aujourd'hui** : l'historique est immuable par conception | **Écart majeur**, voir plan d'action |
| Mineurs | Aucune vérification d'âge | À trancher : clause d'utilisation et contrôle à l'inscription |
| Transferts hors UE | Aucun si l'hébergeur et l'identité restent en France | À confirmer contractuellement |

## 3. Risques

Échelle CNIL : négligeable, limitée, importante, maximale. Évaluation préliminaire, **avant** hébergement réel.

| Risque | Sources | Mesures existantes | Gravité | Vraisemblance |
|---|---|---|---|---|
| Accès illégitime | Session volée, faille applicative, administrateur | Double authentification exigée, cloisonnement par dossier en base (RLS), base qui vérifie la session signée, rôle applicatif sans accès direct, en-têtes de sécurité, contrôle Host/Origin | Maximale | Limitée (à confirmer par test d'intrusion) |
| Modification non désirée | Erreur d'import, attaque | Historique non modifiable, corrections versionnées avec motif, PDF limités à une liste blanche | Importante | Limitée |
| Disparition | Panne, erreur d'exploitation | Exercice automatique de sauvegarde et restauration | Importante | Limitée, à condition que l'hébergeur garantisse sauvegardes et PRA |

## 4. Plan d'action proposé

| # | Action | Responsable | Code ? |
|---|---|---|---|
| 1 | **Suppression du compte et du dossier** sur demande, avec trace minimale de la demande. Concilier avec l'immuabilité (suppression complète du dossier, pas de modification ligne à ligne) | Juridique, puis développement | Oui, nouvelle migration |
| 2 | Fixer les durées de conservation (dossier, PDF, journal) et la purge du journal | Juridique | Oui ensuite |
| 3 | Rédiger le consentement explicite et la politique de confidentialité | Juridique | Textes |
| 4 | Contrôle d'âge à l'inscription | Fondateur | Oui |
| 5 | Contrats de sous-traitance (article 28) avec l'hébergeur et le fournisseur d'identité | Fondateur | Non |
| 6 | Procédure de violation de données (notification CNIL sous 72 h) | Fondateur + DPO | Non |
| 7 | Test d'intrusion avant toute ouverture (B-10) | Prestataire | Non |
| 8 | Registre des traitements et désignation d'un DPO | Fondateur | Non |

Le point 1 est le seul **bloquant d'architecture**. Je recommande de ne pas le coder avant la décision juridique sur les durées et la forme de l'effacement (B-04). Un code écrit avant cette décision risquerait d'être refait.

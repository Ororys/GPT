# Sprint 24 — Lecture des PDF par une IA en ligne (19 novembre 2026)

## Décisions du fondateur

- Fournisseur : **OpenAI**. Le fondateur se charge du contrat.
- L'IA **recopie seulement** les valeurs (aucune interprétation) ; l'application récupère sa réponse pour **classer** les valeurs et les afficher dans le dossier.
- Accord **à chaque envoi**, plus une autorisation « Lecture des PDF par une IA » retirable.
- Petit **serveur relais** pour garder la clé hors de l'application.
- Pas de bouton « Partager ».

## Ce qui est livré

| Élément | Où |
|---|---|
| Contrat de transcription partagé : instructions (« tu ne l'interprètes jamais »), schéma strict sans champ d'avis, rubriques de classement fermées, version de l'information | `apps/personal/src/modules/ai/contract.ts` |
| Relais sans stockage : origine, version d'accord, type, taille et limite horaire contrôlées ; appel OpenAI `store: false` en sortie structurée stricte ; réponse validée ; seuls les codes d'erreur sont journalisés | `apps/relay/` |
| Conversion prudente de la réponse : nombre strict (« < 0,5 » et texte bloqués), unité imprimée conservée (seul μ/µ harmonisé), unité différente du catalogue bloquée, paramètre en double bloqué, référence seulement si imprimée « a - b », date = date du document saisie par la personne | `apps/personal/src/modules/ai/candidates.ts` |
| Classement : les 6 paramètres du catalogue sont reconnus, les autres deviennent des séries propres au dossier (même libellé et même unité = même série), rangées par rubrique | idem |
| Écran : accord à cocher à chaque envoi, revue ligne par ligne avec la raison de chaque blocage, ajout des seules lignes choisies, marquées « à vérifier », confiance absente | `apps/personal/src/components/ai-read-modal.tsx` |
| Stockage : valeurs chiffrées sur le téléphone, journal des lectures (fournisseur, modèle, version), effacement au retrait de l'autorisation ou à la suppression du document | `apps/personal/src/modules/local/store.ts` |
| Politique de contenu : la page peut contacter le relais configuré, et rien d'autre | `scripts/build-mobile.ts` |

Corrections apportées en passant :
- les tableaux défilants de Biologie et Sport sont accessibles au clavier ;
- la page Biologie ne suppose plus que la ferritine et le LDL existent.

## Preuves

- `apps/relay/tests/relay.test.ts` : 6 tests (envoi accepté avec `store: false` et sortie structurée stricte ; refus pour origine, accord, type ; pré-vérification CORS ; limite horaire ; réponse hors contrat rejetée ; configuration obligatoire).
- `tests/ai-candidates.test.ts` : 5 tests (contrat sans champ d'avis, nombres stricts, blocages, ajout limité aux choix, suppression).
- `tests/device.spec.ts` : parcours navigateur application → **vrai relais** → faux OpenAI local. Il vérifie : rien d'envoyé sans autorisation, un seul envoi, aucun contact direct avec le fournisseur, valeur affichée en Biologie, accessibilité.
- Suite unitaire : 71/71. Démo web inchangée : 26/26 parcours avec base de données, 18 en mode fichiers (8 sautés comme prévu).

## Ce qui n'est PAS vérifié

- **Aucun appel réel à OpenAI n'a été fait** : pas de clé, pas de compte, aucune dépense. La forme de la requête suit la documentation de l'API Responses (fichier PDF en base64, sortie `json_schema` stricte) ; elle devra être confirmée au premier essai réel.
- La qualité de la transcription sur de vrais bilans est inconnue. C'est pourquoi chaque valeur reste « à vérifier » et chaque ligne doit être choisie.
- Le relais n'est hébergé nulle part : c'est une décision du fondateur (coût, lieu, avis juridique HDS).

## À faire par le fondateur

1. Créer un **projet API OpenAI** (un abonnement ChatGPT ne suffit pas : l'API a son propre contrat et sa facturation), accepter le DPA, demander la résidence UE et la conservation nulle.
2. Faire valider par un avocat le point HDS et les transferts (voir `ANALYSE_RGPD.md`, section 10).
3. Choisir où héberger le relais.

## Intégration continue (GitHub, 19 novembre 2026)

Tout est vert sur le commit `336b0e3` :
- « Personal B2C prototype » (run 44449484275) : tests du relais, construction avec le relais de test, parcours navigateur application → relais → faux OpenAI, et le reste de la suite ;
- « Mobile apps » (run 44449484330) : compilations Android et iPhone ;
- « Synthetic validation » (run 44449484207).

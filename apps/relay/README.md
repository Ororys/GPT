# Relais IA de Convergence (sprint 24)

Petit serveur sans stockage entre l'application mobile et OpenAI. Il sert à **garder la clé OpenAI hors de l'application** et à contrôler ce qui est envoyé. Il ne conserve rien : pas de base, pas de fichier, pas de journal du PDF ni de la réponse (seuls les codes d'erreur sont journalisés). OpenAI est appelé avec `store: false`.

## Ce qu'il fait

`POST /v1/transcribe` (corps : le PDF, `content-type: application/pdf`) :
1. refuse si l'origine n'est pas celle de l'application, si l'en-tête `x-convergence-consent` ne porte pas la version d'information en vigueur, si ce n'est pas un PDF ou s'il dépasse 10 Mo ;
2. limite le nombre d'envois par adresse et par heure (20 par défaut) ;
3. demande à OpenAI (API Responses, sortie structurée stricte) une **transcription seule** : libellé, valeur et unité imprimées, références imprimées, page, rubrique de classement, sans aucune interprétation ;
4. vérifie la réponse contre le contrat (`apps/personal/src/modules/ai/contract.ts`) avant de la renvoyer. L'application la vérifie à nouveau.

## Configuration (variables d'environnement, jamais versionnées)

| Variable | Rôle |
|---|---|
| `OPENAI_API_KEY` | Clé d'un **projet API OpenAI** (pas un abonnement ChatGPT) |
| `OPENAI_MODEL` | Modèle choisi, capable de lire des PDF |
| `OPENAI_BASE_URL` | Facultatif : point d'accès européen si le projet est en résidence UE |
| `RELAY_ALLOWED_ORIGINS` | Origines de l'application, par exemple `https://localhost,capacitor://localhost` |
| `RELAY_HOURLY_LIMIT` | Facultatif : envois par adresse et par heure |
| `PORT` | Port d'écoute (8787 par défaut) |

L'application connaît l'adresse du relais à la construction : `NEXT_PUBLIC_HC_AI_RELAY_URL=https://… npm run build:mobile`. Sans cette variable, le bouton affiche « Lecture par IA non configurée ».

## Avant une mise en service (décisions du fondateur)

- Créer un projet API chez OpenAI, accepter son **accord de traitement (DPA)**, et demander si possible la **résidence européenne** et la **conservation nulle** (« zero data retention »), qui sont soumises à approbation.
- Choisir l'hébergement du relais (HTTPS obligatoire) et faire valider le point HDS par un avocat (`docs/ANALYSE_RGPD.md`, section 10).
- Protéger le relais contre les abus : la limite par adresse est un minimum. L'attestation d'application (Play Integrity, App Attest) reste à ajouter.

## Tests

`npm run test:relay` dans `apps/personal` (avec un faux OpenAI, sans réseau ni clé). Le parcours complet application → relais → faux OpenAI est couvert par `npm run build:mobile:test && npm run test:e2e:device`.

# Sprint 03 — PDF synthétiques et relais Claude Code

Date : 18 novembre 2026. Données exclusivement fictives. Organisation des pages conservée à la demande du fondateur.

## Réalisé

Extraction du texte natif de véritables PDF du corpus contrôlé, pages et texte source visibles, sélection explicite des résultats, intégration atomique et idempotente, conservation des octets originaux dans PostgreSQL. Le mode mobile utilise la session et reconstitue les PDF connus à l’identique ; il ne constitue pas un stockage PostgreSQL durable.

Les PDF inconnus et les profils incompatibles sont refusés avant extraction. Les unités incompatibles ne sont pas converties. La variante typographique μ/µ est normalisée en conservant l’unité originale. Aucune heure de mesure n’est inventée : précision au jour, minuit UTC utilisé seulement comme ancre technique. La méthode analytique inconnue reste distincte de la méthode d’extraction. Une confirmation utilisateur ne vaut pas validation médicale.

## Vérifications exécutées

- Application : 20 tests unitaires réussis.
- PostgreSQL réel 16.11 : 15 tests d’intégration réussis (dont 5 PDF).
- Navigateur sur PostgreSQL : 14 tests réussis, dont revue PDF et limites sans OCR.
- Démo Worker : 9 tests réussis.
- TypeScript et build application et Worker : réussis.
- Audit npm du sprint : aucune vulnérabilité signalée dans la réponse de l’outil.

Les logs fournis constituent les résultats de cette session. Docker Compose et la CI distante n’ont pas été exécutés dans cette session. Les tests historiques racine ne sont pas comptés comme réexécutés ici. Une capture de revue PDF est fournie ; elle ne constitue pas un audit d’accessibilité complet.

## Limites et suite

Analyseur de lignes contrôlées, non universel pour les laboratoires français. Corpus petit, sans estimation de précision clinique ; aucune performance d’extraction générale annoncée. Le cas sans texte signale le besoin d’OCR, sans OCR opérationnel. Aucun fournisseur externe ou modèle IA n’est appelé. La confiance n’est pas calibrée et reste absente. Aucun document médical réel accepté.

Authentification de démonstration, hébergement santé, consentement juridique, fournisseurs réels, dédoublonnage inter-fournisseurs, conversion d’unités validée, fuseaux patients et validation réglementaire restent des blocages. Aucune conformité HDS, RGPD ou MDR revendiquée.

Prochain incrément : enrichir le corpus synthétique et les cas limites, puis développer une revue des corrections avec provenance et historique. Ne pas réorganiser les données ni lancer tous les modules simultanément.

Le relais est décrit dans `HANDOFF_CLAUDE_CODE.md`, avec consignes permanentes `CLAUDE.md` et prompt prêt à utiliser `PROMPT_REPRISE_CLAUDE.md`. L’archive ajoute `demo-mobile/`, copie du dépôt hébergé distinct ; les droits Sites et secrets ne sont pas transférés.

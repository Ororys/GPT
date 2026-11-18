# Health Convergence — consignes de reprise

## Mission et priorités utilisateur

Construire un produit B2C de santé personnelle premium, V1 strictement descriptive. Le fondateur a validé le premier rendu et demande de **continuer le développement, sans retravailler pour l'instant l'organisation des données et des pages**. Ne pas entreprendre une refonte d'architecture ou de navigation en guise de reprise.

Données exclusivement synthétiques. Aucun diagnostic, score de maladie, prescription, conseil de modification de traitement ou qualification médicale automatisée. Aucune conformité HDS, RGPD, MDR ou AI Act revendiquée. Ne jamais remplacer une fonction réelle par une simulation en la présentant comme opérationnelle.

Agir de façon autonome sur les corrections ordinaires et tester les changements importants. Ne pas publier publiquement, modifier le DNS, créer un compte, engager une dépense, utiliser un secret ou traiter des données réelles sans autorisation appropriée. La démo Sites existante est autorisée **privée, propriétaire uniquement**, jamais publique par défaut.

## Lire en premier

1. `HANDOFF_CLAUDE_CODE.md` — carte du dépôt, commandes et limites.
2. `docs/personal-sprint-03/BILAN.md` puis `docs/personal-sprint-04/BILAN.md` — incréments PDF et preuves.
3. `apps/personal/README.md` et `apps/personal/AGENTS.md`.
4. `SECURITY.md`, `BLOCKERS.md`, `ARCHITECTURE.md` et `TEST_REPORT.md`.
5. `docs/personal-sprint-02/BILAN.md` pour le raccordement PostgreSQL.

L'historique documentaire et les anciens audits sont conservés. Ce sont des rapports de sessions précédentes, pas des tests que vous avez exécutés vous-même.

## Trois périmètres à distinguer

- **Racine / API historique** : Node, schéma `hc`, migrations `sql/001–006`, CSV et rapports. Ne pas casser les comportements ou réécrire les migrations appliquées.
- **`apps/personal`** : application Next.js/React/TypeScript, PostgreSQL par défaut, schéma `personal`, migrations propres dans `apps/personal/sql`. Le rôle runtime ne doit être ni administrateur ni propriétaire, et ne lit pas directement les tables. Les services et fonctions SQL contrôlent l'accès.
- **Démo mobile** : source séparée, fournie dans `demo-mobile/` dans l'archive de reprise (emplacement d'origine : `/workspace/sites/convergence-mobile-demo`). Réutilise les composants, mais tourne en Worker et sert des données synthétiques ; les ajouts restent en session de navigateur. **Ce n'est pas la version PostgreSQL hébergée.** Le routage, la valeur de `storage` et l'accès Sites doivent être préservés lorsqu'on y reporte des changements.

La démo est à https://convergence-mobile-demo.waxyphlox4.chatgpt.site . Le code ne donne pas à lui seul le droit de republier : l'authentification Sites est externe et les identifiants temporaires ne sont pas livrés.

## Incrément PDF actuel

Lecture réelle du texte natif avec unpdf/PDF.js, uniquement sur un corpus PDF synthétique accepté par SHA-256. Pages, zones, texte source, valeur et unité originale sont conservés. Les candidats ne deviennent des observations qu'après sélection explicite. Ils restent `needs-review`, sans validation médicale. La confiance est `null` : ne pas inventer un pourcentage.

- Pas d'OCR, aucun modèle IA ou fournisseur externe.
- Un document sans texte donne « OCR nécessaire », sans valeur inventée.
- Une unité incompatible reste bloquée ; aucune conversion numérique.
- Seule l'équivalence typographique `μ`/`µ` est harmonisée, avec unité originale conservée.
- La date est connue au jour près : minuit UTC est un ancrage technique et `measuredPrecision=day` le précise. Ne pas en déduire une heure de prélèvement.
- La méthode de mesure n'étant pas fournie, elle est `lab_method_not_reported`. Elle est distincte de la méthode d'extraction `pdf-native-v1`.
- Le parser actuel reconnaît un format de tableau contrôlé, pas tous les laboratoires français. Ne pas retirer la restriction d'empreinte pour « rendre l'import plus pratique ».
- Depuis le sprint 04 : lignes non reprises listées, valeurs « < », doublons intra-document et dates multiples/invalides bloqués ; jamais de choix automatique entre deux valeurs ou deux dates. Les empreintes des PDF existants sont verrouillées par test : ne pas modifier leur générateur.
- Pas encore de correction manuelle de valeur et d'historique de rectification ; ne pas écraser le texte ou les valeurs originales pour l'ajouter.

## Discipline technique

Node **24+** pour l'espace personnel et les outils PDF (unpdf 2.2). TypeScript strict, Oxlint, Prettier, tests Node/tsx, PostgreSQL réel et Playwright. Lire les guides locaux Next.js avant les changements de framework : la version installée peut différer de vos habitudes.

Ne jamais versionner `.env*`, `.local`, `node_modules`, traces de navigateur, credentials Git/Sites, mots de passe ou cookies. La configuration de migration `.env.database` n'est pas chargée par le runtime Next. Elle doit rester distincte des accès applicatifs.

Ne pas désactiver RLS, les triggers d'immuabilité, la vérification Host/Origin ou le refus des rôles privilégiés pour faire passer les tests. Le mode fichiers est explicite (`HC_PERSONAL_STORAGE=local`), jamais un fallback à une panne PostgreSQL.

L'identité reste démonstrative ; le rôle API peut choisir le sujet SQL. L'audit en base reste annulable dans une transaction contrôlée par un appelant et n'est pas inviolable face à l'administrateur. Ces points ne sont pas résolus par la présente livraison.

## Prochain travail raisonnable

Consolider le parcours PDF et son banc synthétique : autres mises en page, cas ambigus, dates, doublons et revue/correction versionnée. Conserver le design et le découpage actuel. Ne pas lancer simultanément assistant IA, intégrations fabricants, portail B2B ou réorganisation du dossier.

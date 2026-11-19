# Health Convergence — consignes de reprise

## Mission et priorités utilisateur

Construire un produit B2C de santé personnelle premium, V1 strictement descriptive. Le fondateur a validé le premier rendu et demande de **continuer le développement, sans retravailler pour l'instant l'organisation des données et des pages**. Ne pas entreprendre une refonte d'architecture ou de navigation en guise de reprise.

Données exclusivement synthétiques. Aucun diagnostic, score de maladie, prescription, conseil de modification de traitement ou qualification médicale automatisée. Aucune conformité HDS, RGPD, MDR ou AI Act revendiquée. Ne jamais remplacer une fonction réelle par une simulation en la présentant comme opérationnelle.

Agir de façon autonome sur les corrections ordinaires et tester les changements importants. Ne pas publier publiquement, modifier le DNS, créer un compte, engager une dépense, utiliser un secret ou traiter des données réelles sans autorisation appropriée. La démo Sites existante est autorisée **privée, propriétaire uniquement**, jamais publique par défaut.

## Lire en premier

1. `docs/ETAT_DU_PRODUIT.md` — synthèse à jour pour le fondateur ; `HANDOFF_CLAUDE_CODE.md` — carte d'origine du dépôt.
2. `docs/personal-sprint-03/BILAN.md`, `docs/personal-sprint-04/BILAN.md` `docs/personal-sprint-05/BILAN.md`, `docs/personal-sprint-06/BILAN.md`, `docs/personal-sprint-07/BILAN.md`, `docs/personal-sprint-08/BILAN.md`, `docs/personal-sprint-09/BILAN.md`, `docs/personal-sprint-10/BILAN.md`, `docs/personal-sprint-11/BILAN.md`, `docs/personal-sprint-12/BILAN.md`, `docs/personal-sprint-13/BILAN.md` puis `docs/personal-sprint-14/BILAN.md` — incréments PDF, correction versionnée, doublons inter-documents, résumé de consultation, passeport de qualité, autorisations, mesures du centre, jour local, connexion réelle, applications mobiles, données du téléphone et preuves.
3. `apps/personal/README.md` et `apps/personal/AGENTS.md`.
4. `SECURITY.md`, `BLOCKERS.md`, `docs/DECISIONS_BLOQUANTS.md`, `ARCHITECTURE.md` et `TEST_REPORT.md`.
5. `docs/personal-sprint-02/BILAN.md` pour le raccordement PostgreSQL.

L'historique documentaire et les anciens audits sont conservés. Ce sont des rapports de sessions précédentes, pas des tests que vous avez exécutés vous-même.

## Applications mobiles (sprint 13)

Décision du fondateur : l'application entière existe en mobile (Android, iOS) **et** en web. `apps/mobile` (Capacitor) ouvre le même serveur que le site : ne pas créer d'interface mobile séparée. Lecture santé du téléphone en lecture seule, limitée aux 5 types de `modules/device/model.ts` ; toute nouvelle permission native doit être justifiée et testée (`apps/mobile/tests/config.test.ts`). L'autorisation `device-health` n'est jamais accordée par défaut. Depuis le sprint 14 : ne jamais additionner des échantillons bruts de pas/distance (totaux quotidiens de la plateforme uniquement), ne compter que le temps endormi en fusionnant les chevauchements, ne jamais mélanger VFC SDNN et RMSSD ; les données du téléphone restent dans leurs propres panneaux (`components/phone-panels.tsx`).

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
- Depuis le sprint 19 : ordre des colonnes pris dans l'en-tête, milliers stricts (groupes de 3), libellés de date variés ; les sorties des PDF existants doivent rester identiques (comparer avant/après) et toutes les empreintes sont verrouillées par test.
- Depuis le sprint 05 : correction versionnée (`003_observation_correction.sql`) des seuls résultats `native-pdf`, même unité, motif obligatoire, version attendue contrôlée. La table `observation` n'est jamais modifiée ; `api_get_record` superpose la dernière version et joint l'historique ; `valueKnownAt` applique la Time Machine. Ne pas réécrire la migration appliquée : toute évolution passe par une nouvelle migration.
- Depuis le sprint 06 : `api_pdf_overlaps` (`004_pdf_overlap.sql`) signale à la lecture, sans rien stocker ni fusionner, un même paramètre le même jour UTC dans un autre document ; le candidat est décoché par défaut.

## Résumé de consultation (sprint 07)

`modules/summary` sélectionne et compte, sans calcul d'évolution, seuil, score ni vocabulaire interprétatif (un test extrait le texte du PDF et vérifie l'absence de mots comme « hausse », « risque », « anormal »). Tout nouvel événement d'audit doit être ajouté à la liste blanche SQL de `api_audit` par une nouvelle migration.

## Passeport de qualité (sprint 08)

`modules/quality/passport.ts` décrit provenance, couverture et comparabilité ; jamais de signification médicale. Un jour sans activité n'est pas une donnée manquante. Les tests E2E doivent passer en mode PostgreSQL **et** en mode fichiers local.

## Autorisations (sprint 09)

`006_source_consent.sql` : toute nouvelle entrée de données doit être couverte par un trigger `require_consent` sur sa table d'arrivée. Ne jamais présenter comme autorisable une source qui n'existe pas (montres, fabricants). Le retrait ne supprime rien.

## Mesures du centre (sprint 10)

Décision du fondateur : séries de la page Biologie, catégorie « Mesures du centre », dans le modèle d'observation existant. Protocole obligatoire dans `method`, **jamais de plage de référence inventée**, aucune interprétation de la pression artérielle. `labBiomarkers` (laboratoire, PDF) et `biomarkers` (catalogue complet) sont distincts.

## Jour local et temps (sprint 11)

Tout regroupement par jour passe par `modules/observations/time.ts` (TS) ou `personal.local_day` (SQL) : jour calendaire du fuseau du dossier, valeur au jour près jamais décalée. Ne plus utiliser `slice(0, 10)` sur un instant. Les graphiques utilisent un axe temporel proportionnel. Aucun seuil (EWGSOP2, STEADI…) n'est affiché, même sourcé.

## Discipline technique

Node **24+** pour l'espace personnel et les outils PDF (unpdf 2.2). TypeScript strict, Oxlint, Prettier, tests Node/tsx, PostgreSQL réel et Playwright. Lire les guides locaux Next.js avant les changements de framework : la version installée peut différer de vos habitudes.

Ne jamais versionner `.env*`, `.local`, `node_modules`, traces de navigateur, credentials Git/Sites, mots de passe ou cookies. La configuration de migration `.env.database` n'est pas chargée par le runtime Next. Elle doit rester distincte des accès applicatifs.

Ne pas désactiver RLS, les triggers d'immuabilité, la vérification Host/Origin ou le refus des rôles privilégiés pour faire passer les tests. Le mode fichiers est explicite (`HC_PERSONAL_STORAGE=local`), jamais un fallback à une panne PostgreSQL.

Depuis le sprint 12, une connexion réelle OIDC (PKCE, `amr` exigé, rattachement contrôlé, `008_oidc_identity.sql`) existe derrière `HC_PERSONAL_AUTH=oidc` ; la démonstration reste le défaut. Ne jamais ajouter de rattachement automatique d'une identité à un dossier. Les redirections utilisent l'origine publique configurée, jamais `request.url`. Depuis le sprint 21 (S-02), quand `db:prepare` a installé la clé (`HC_PERSONAL_SESSION_SECRET`), `personal.guard` exige la preuve de session signée transmise par `databaseCall` (`hc.session_proof`) : ne jamais contourner `databaseCall` ni désactiver cette vérification ; toute nouvelle fonction d'API doit passer par `personal.guard`. L'audit en base reste annulable dans une transaction contrôlée par un appelant et n'est pas inviolable face à l'administrateur. Ces points ne sont pas résolus par la présente livraison.

## Lancement « données sur le téléphone » (sprint 23)

Décision du fondateur (19 novembre 2026) : au lancement, les données de santé restent **sur le téléphone**, chiffrées, sans serveur ni compte. Coût d'hébergement nul ; la version web reste la démonstration aux profils fictifs. La version hébergée (PostgreSQL, OIDC, routes `/api`) est **conservée** pour plus tard : ne pas la supprimer.

- `npm run build:mobile` (apps/personal) produit les pages statiques dans `apps/mobile/dist` avec `NEXT_PUBLIC_HC_RUNTIME=device`. Capacitor les embarque sauf si `CONVERGENCE_SERVER_URL` est défini (mode hébergé).
- `modules/local/` : coffre chiffré (AES-256-GCM, clé enveloppée par PBKDF2-SHA-256 600 000 itérations à partir du code de 6 à 12 chiffres, jamais stocké), dépôt local (`store.ts`) avec autorisations versionnées, import téléphone idempotent, PDF conservés tels quels. Les noms d'entrées ne doivent rien révéler du contenu (identifiants aléatoires, index chiffré).
- Fonctions RGPD : premier lancement (majorité, information versionnée `NOTICE_VERSION`), retrait avec ou sans effacement, suppression d'un document, export complet, « Supprimer toutes mes données », code oublié = tout effacer. Aucune requête hors de l'origine de la page (CSP `connect-src 'self'`, test E2E). Données exclues des sauvegardes iCloud et Google.
- Les PDF sont rangés tels quels. Depuis le sprint 24, une **transcription par OpenAI** (décision du fondateur) est possible pour un bilan : autorisation `ai-reading` + accord coché à chaque envoi, via `apps/relay` (sans stockage, `store: false`, clé côté relais uniquement). Contrat dans `modules/ai/contract.ts` : **transcription seule, jamais d'interprétation** ; ne pas ajouter de champ d'avis, de seuil ou de commentaire. La réponse est revérifiée dans l'app (`modules/ai/candidates.ts` : nombres stricts, pas de conversion, doublons bloqués) ; seules les lignes choisies sont ajoutées, `needs-review`, confiance `null`. Aucun appel réel n'a été testé (pas de clé) : ne jamais présenter la fonction comme opérationnelle avant un essai réel. L'exception à « aucun modèle IA » de l'incrément PDF ne vaut que pour ce parcours sur le téléphone ; le lecteur natif reste sans IA.
- Tests : `tests/local-store.test.ts`, `tests/ai-candidates.test.ts`, `npm run test:relay`, `npm run test:e2e:device` après `build:mobile:test`.

## Prochain travail raisonnable

Consolider le parcours PDF et son banc synthétique : autres mises en page, cas ambigus, dates, doublons et revue/correction versionnée. Conserver le design et le découpage actuel. Ne pas lancer simultanément assistant IA, intégrations fabricants, portail B2B ou réorganisation du dossier.

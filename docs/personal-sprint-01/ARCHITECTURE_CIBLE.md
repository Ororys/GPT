# Architecture B2C — incrément 0.1

## Ce qui fonctionne maintenant

```text
Navigateur : React, composants accessibles Radix, graphiques ECharts
       │ routes Next.js, requêtes same-origin
       ▼
Identité de démonstration : cookie HttpOnly signé, SameSite=Strict, expiration
       ▼
Services de dossier : contrôle du sujet et du personId côté serveur
       ├── journal local, événements sans valeurs médicales
       └── repository explicitement synthétique
             ├── fixtures déterministes communes aux cinq pages
             └── reçus d'import privés .local/, remplacement atomique du fichier
```

L'import accepte uniquement les octets du fichier de démonstration fourni (SHA-256 vérifié avant enregistrement). Aucun téléversement médical arbitraire n'est disponible. Le fichier importé conserve une valeur originale, unité, méthode, document, page, texte source, statut et dates. La confiance est `null` car aucune calibration de modèle n'existe. Les valeurs ne deviennent jamais des données médicales validées. Les PDF sont réellement générés et servis, mais depuis les fixtures : ils ne sont pas le résultat d'un OCR ou d'une extraction.

Le repository local est prévu pour **un processus Node** de démonstration. La file de sérialisation en mémoire et le rename atomique ne constituent ni une transaction PostgreSQL, ni une garantie multi-instance. Le journal n'est pas inviolable et la clé de session générée en mémoire invalide les sessions au redémarrage.

## Choix techniques

- **Next.js 16 / React 19 / TypeScript strict** : application routée et API dans un monolithe modulaire, sans service externe.
- **CSS personnalisé + Tailwind 4** : tokens propres, thèmes explicitement conçus, pas de thème shadcn standard. Les composants n'imposent pas une dépendance à tout shadcn.
- **Radix Dialog** : gestion de focus, fermeture clavier, titres et descriptions des modales. Les contrôles simples restent natifs.
- **Inter Variable distribuée localement** : aucun appel à un service de polices dans le navigateur.
- **ECharts 6 en Canvas** : séries temporelles, axes distincts, lacunes, zoom, infobulles et échantillonnage LTTB. Préparation indexée des séries, tableau accessible paginé. Banc réel à 10 000 points synthétiques dans `/lab/chart`, sans promesse chiffrée de performance.
- **Zod** : contrats de données et import. Pas de conversion silencieuse.
- **Oxlint + Prettier + TypeScript** : contrôles de code, formatage et types. Oxlint remplace la chaîne ESLint initialement installée qui tirait une version vulnérable de picomatch sans correctif publié dans le registre consulté. La préférence `prefer-tag-over-role` est désactivée car les graphiques Canvas nécessitent un conteneur ARIA ; les autres règles restent actives.
- **Node test runner via tsx / Playwright / Axe** : calculs purs, sécurité HTTP et parcours sur le build de production.

Ni Prisma, ni file de jobs, ni stockage cloud ne sont introduits pour simuler une infrastructure qui n'existe pas encore. PostgreSQL reste la cible ; l'API SQL historique et ses tests sont conservés. Pas de microservices prématurés.

## Frontières

- `identity` : session fictive signée, scopes limités au dossier personnel.
- `health-records` : modèles, fixtures, repository et service autorisé.
- `observations` : sélecteurs, calculs déterministes et préparation graphique.
- `documents` : contrat d'import et génération PDF.
- `timeline` : liens et dates d'événement/connaissance ; le filtre Time Machine exige les deux dates.
- `audit` : événements locaux sans contenu des résultats.
- `organizations`, `sharing` : contrats cibles seulement, non activés.
- `extraction` : interface de fournisseurs et candidats sourcés ; aucune implémentation OCR/LLM.
- `activities`, `sleep` : représentés par des types communs du dossier ; extraction en services dédiés au prochain incrément métier.
- `assistant` : aucun fournisseur ni appel distant.

Les composants UI n'importent jamais le repository serveur ; ils reçoivent un DTO issu de services contrôlés. Les fichiers serveur utilisent `server-only`. Les styles inline restent autorisés pour les graphiques, mais les scripts de production utilisent des nonces par requête, sans unsafe-eval. Le rendu des pages est dynamique pour préserver ces nonces. Le contrôle Host autorise uniquement les hôtes locaux par défaut ; les mutations vérifient Origin contre l'hôte validé.

## Modèle cible PostgreSQL, non appliqué dans ce sprint

Conserver Person/Identity/User séparés ; Organization/Membership ne donnent aucun accès implicite au dossier. Prévoir :

| Domaine | Entités cibles |
|---|---|
| Identité | User, Identity, Profile, Organization, Membership |
| Sources | DataSource, ConnectedAccount, ImportBatch, ImportReceipt |
| Documents | Document, DocumentPage, ExtractionJob, ExtractedField, ExtractionReview, FieldRevision |
| Mesures | ObservationDefinition, MeasurementUnit, Observation, ReferenceRange, CalculationVersion |
| Quotidien | Activity, ActivitySample, SleepSession, SymptomEntry, MedicationRecord, HealthEvent |
| Liens | TimelineEvent, EvidenceLink, Insight |
| Autorisations | ConsentRecord, AccessGrant, AuditEvent |

Chaque entité de dossier porte person_id, dates d'événement/réception/import et provenance. Les observations corrigées seront versionnées, sans effacer leur origine ; règles de suppression et rétention à valider juridiquement. Les références de laboratoire sont attachées à un résultat et sa méthode, jamais une norme universelle globale. Index cible `(person_id, metric_code, measured_at)` et `(person_id, known_at)` ; unicité d'import par personne/source/identifiant/version. Les samples d'activité ont un index `(activity_id, timestamp)`.

L'accès professionnel devra combiner identité, grant explicite, portée, validité et révocation ; un rôle de membre d'organisation ne suffit pas. Tester patients croisés, organisations croisées et révocation à chaque intégration. RLS et fonctions SQL existantes devront être étendues par migrations additives testées ; aucune compatibilité FHIR complète n'est revendiquée.

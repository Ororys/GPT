# Convergence — démo mobile privée

Version de démonstration distincte de l'application PostgreSQL dans /workspace/HealthConvergence. Le site est privé et son accès est contrôlé par Sites. Les profils sont fictifs, pas des identités médicales.

Les écrans et graphiques sont repris du prototype. Les API de cette démo servent uniquement des fixtures synthétiques. L'import accepte exclusivement le fichier fourni ; l'ajout est conservé dans un cookie de session HttpOnly de ce navigateur. Aucune persistance PostgreSQL, stockage de documents réels, OCR, IA médicale ou connexion fabricant n'est revendiqué ici. Aucun envoi de données réelles n'est autorisé.

`npm ci && npm test && npm run build` produit dist/server/index.js, Worker autonome avec assets intégrés. Aucun secret de la version locale n'est copié. Les helpers Sites n'étaient pas installés dans cet environnement ; le manifeste natif et le contrat Worker sont utilisés directement, avec Git authentifié en mémoire et archive de déploiement.

## Report des sprints 04 à 10 (18 novembre 2026)

Synchronisé depuis `apps/personal` en conservant les adaptations mobiles (navigation sans Next, `storage=mobile-demo-session`, textes de session) :

- corpus PDF élargi (colonnes, ambigus, deux dates) et revue avec motifs de blocage ;
- signalement des doublons entre documents, calculé à partir de la session du navigateur ;
- résumé PDF pour consultation (`/api/summary`) et passeport de qualité ;
- mesures du centre dans Biologie ;
- correction versionnée et autorisations : **non disponibles** ici (PostgreSQL requis), l'interface le dit.

`npm test` (10 tests), `npx tsc --noEmit` et `npm run build` réussis. **Non republié** : la mise à jour du site privé exige l'accès Sites, absent de cette session.

# Convergence — démo mobile privée

Version de démonstration distincte de l'application PostgreSQL dans /workspace/HealthConvergence. Le site est privé et son accès est contrôlé par Sites. Les profils sont fictifs, pas des identités médicales.

Les écrans et graphiques sont repris du prototype. Les API de cette démo servent uniquement des fixtures synthétiques. L'import accepte exclusivement le fichier fourni ; l'ajout est conservé dans un cookie de session HttpOnly de ce navigateur. Aucune persistance PostgreSQL, stockage de documents réels, OCR, IA médicale ou connexion fabricant n'est revendiqué ici. Aucun envoi de données réelles n'est autorisé.

`npm ci && npm test && npm run build` produit dist/server/index.js, Worker autonome avec assets intégrés. Aucun secret de la version locale n'est copié. Les helpers Sites n'étaient pas installés dans cet environnement ; le manifeste natif et le contrat Worker sont utilisés directement, avec Git authentifié en mémoire et archive de déploiement.

# Sprint 17 — Confort de l'application native (encoche, barres système) et CI de la démo mobile

Date : 18 novembre 2026 (travail autonome).

- **`viewport-fit=cover`** via l'export `viewport` de Next (vérifié dans la documentation locale de Next) et couleurs de barre système alignées sur les fonds des thèmes (#101817 sombre, #f3f5f0 clair).
- **Zones sûres** : la barre du haut est décalée de `env(safe-area-inset-top)` (encoche, barre d'état). La navigation mobile utilisait déjà `env(safe-area-inset-bottom)`, mais sans `viewport-fit=cover` cette valeur valait 0 sur iPhone. Sur ordinateur et dans les navigateurs sans encoche, ces valeurs valent 0 : la mise en page ne change pas (vérifié par test).
- **Android** : `SystemBars.insetsHandling = "css"` et indice initial `cover` dans `capacitor.config.ts`, conformément aux options documentées de Capacitor 8 (Android 15+ affiche les applications bord à bord).
- Une règle de marges latérales envisagée a été écartée : elle aurait effacé les marges existantes. Le mode paysage reste à traiter.
- **CI** : job `demo-mobile` (tests du Worker, types, build) ajouté au workflow mobile. La démo mobile n'est pas resynchronisée avec les sprints 12 à 17 : son Worker n'a ni connexion réelle ni données du téléphone, et une copie aveugle des composants casserait son démarrage (`/api/auth/status` absent).

Vérifications : configuration native 3/3 (dont SystemBars), navigateur 17 + 8 ignorés en local (dont `viewport-fit`, deux `theme-color`, aucun décalage sur ordinateur). **Non vérifié** : rendu sur un vrai iPhone ou Android à encoche.

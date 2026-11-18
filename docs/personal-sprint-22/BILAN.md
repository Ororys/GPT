# Sprint 22 — Synchronisation automatique du téléphone à l'ouverture de l'application

Date : 18 novembre 2026 (travail autonome).

- À l'ouverture de **l'application mobile**, les 7 derniers jours de données du téléphone sont importés automatiquement si l'autorisation « Données santé du téléphone » est accordée et si la dernière synchronisation date de plus de 6 heures. Le dossier est rafraîchi si de nouvelles données arrivent.
- Règle isolée et testée (`modules/device/sync-policy.ts`) : jamais dans un navigateur, jamais sans autorisation, au plus toutes les 6 heures. Une date illisible ou située dans le futur déclenche une synchronisation : on ne se fie pas à une horloge incohérente.
- Silencieux en cas d'échec : l'import manuel dans Paramètres reste disponible et explique les erreurs. Les règles du sprint 14 (totaux quotidiens, temps endormi seulement, VFC par méthode) s'appliquent à l'identique.

Vérifications : 58 unitaires (dont 7 cas de la règle), navigateur 26/26 (PostgreSQL) et 18 + 8 ignorés (local) : le site n'est pas affecté. **Non vérifié** : le déclenchement réel dans l'application, faute de téléphone ici.

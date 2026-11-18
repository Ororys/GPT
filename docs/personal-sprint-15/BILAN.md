# Sprint 15 — Données du téléphone dans le résumé et le passeport

Date : 18 novembre 2026 (travail autonome demandé par le fondateur).

- **Résumé de consultation** : section « Données du téléphone » (source, jours mesurés, moyenne des seuls jours présents, rappel de méthode : temps endormi seulement, totaux quotidiens de la plateforme, VFC propre à la plateforme). Absente s'il n'y a pas de données. Aucun mot interprétatif (test sur le texte réel du PDF).
- **Passeport de qualité** : tableau « Téléphone · 90 derniers jours » (couverture, plus longue période sans donnée calculée sur les jours locaux déjà calculés, source, notes `ASLEEP_ONLY`, `PLATFORM_DAILY_TOTAL`, `HRV_METHOD_SPECIFIC`, estimation du fabricant).
- Le serveur lit 400 jours de données du téléphone (au lieu de 90), pour couvrir les résumés sur 12 mois. La lecture SQL reste bornée.

Vérifications : 52 tests unitaires, 23 navigateur sur PostgreSQL (import → panneaux → passeport → PDF), 15 + 8 ignorés en local. Aucune migration.

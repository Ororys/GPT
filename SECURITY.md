# Sécurité — état v3.0

**Ce logiciel n'est pas autorisé à recevoir des données de santé réelles.** Aucune conformité HDS, RGPD ou MDR n'est revendiquée. Voir BLOCKERS.md.

## Modèle appliqué (et testé sur PostgreSQL 16)

| Couche | Mécanisme | Test |
|---|---|---|
| Rôles SQL | `hc_admin` (migrations, seed) ; `hc_owner` (propriétaire, sans connexion, ni superutilisateur ni BYPASSRLS) ; `hc_api_login` (API, aucun droit sur les tables) | `test_pg_boundary` 1–2 |
| Frontière | Seules les fonctions `hc.api_*` (`SECURITY DEFINER`, `search_path` figé) sont exécutables par l'API | idem |
| Autorisation | `hc.authz` décide en base : patient = son dossier ; médecin = prise en charge active ; IDE = mesures seulement ; administratif, fondateur, service = rien | `test_pg_boundary` 4, 6 |
| Défense en profondeur | RLS forcée : les tables de dossier ne montrent que la personne placée en portée de transaction après autorisation | `test_pg_boundary` 3 |
| Audit | Accès autorisés **et refusés** journalisés durablement, sans valeur de mesure ; journal non modifiable ; consultable par le patient | `test_pg_boundary` 5, 7 |
| Immuabilité | UPDATE, DELETE, TRUNCATE refusés sur observations, provenance, accusés, rapports | `test_pg_boundary` 7 |
| Verrou synthétique | `CHECK (synthetic)` en base ; l'API refuse de démarrer sans `HC_SYNTHETIC_ONLY=true` ou avec un rôle SQL privilégié | `test_pg_boundary` 8 |
| Consentement source | Import refusé sans connexion active ; seul le patient autorise ou révoque | `test_pg_import` 5 |
| HTTP | Jeton en en-tête (pas de cookie, donc pas de CSRF), contrôle de `Host`, CSP sans `unsafe-inline`, erreurs sans détail interne, tailles bornées, paramètres en liste blanche, neutralisation des formules dans l'export CSV | `test_http_api` |
| Réseau | Écoute et ports publiés sur `127.0.0.1` uniquement | `compose.yaml` |
| Secrets | Générés aléatoirement en local (`npm run env:init`), jamais versionnés | `.gitignore` |

## Risques résiduels connus

1. **Identité de démonstration** : jetons HS256 à secret partagé et sélecteur de profil. Ce n'est pas une authentification (B-01).
2. **Confiance dans l'API** : `p_subject` est fourni par l'API ; un rôle API compromis peut usurper un sujet (S-02).
3. **Rôle de migration** : superutilisateur dans le conteneur, il contourne la RLS. Il n'est jamais donné à l'API, mais l'audit n'est pas inviolable face à lui (S-04).
4. **Pas de TLS, pas de limitation de débit, pas de verrouillage de compte** : acceptable uniquement en boucle locale (S-03).
5. **Immuabilité et droit à l'effacement** : non arbitrés ; décision juridique requise (B-04).
6. **Aucun test d'intrusion ni revue indépendante.**

## Règles pour les contributeurs

- Aucune donnée réelle, aucun secret dans le dépôt, aucune donnée envoyée à une IA ou à un service externe.
- Toute nouvelle lecture ou écriture passe par une fonction `hc.api_*` commençant par `hc.guard`, avec un test de refus.
- Aucune fonction de score, d'alerte, de seuil clinique ou de recommandation en V1.


## Précisions issues de la revue indépendante v3.1

- Le booléen `synthetic` ne peut pas reconnaître une donnée réelle : l'interdiction d'en importer reste organisationnelle, pas une garantie de classification automatique.
- L'audit d'un refus persiste lorsque l'appel SQL est validé (autocommit dans PgRepository). Le rôle API peut ouvrir une transaction puis l'annuler : le journal en base n'est pas indépendant de l'appelant. Un journal externe et une identité liée à la base restent nécessaires.
- Les triggers protègent les opérations ordinaires. Un superutilisateur ou le propriétaire peut désactiver les triggers ou changer les politiques ; aucune inviolabilité face à l'administrateur n'est garantie.
- Pas de flux sortant fournisseur actif : aucune URL arbitraire n'est récupérée par le serveur actuel. L'absence de SSRF constatée sur ce périmètre ne valide pas les futurs adaptateurs.
- Les requêtes métier sont paramétrées, le DOM utilise des nœuds texte et une CSP stricte. Les tests ne constituent pas un pentest exhaustif.


## Espace personnel 0.2

Le runtime utilise un rôle SQL distinct et refuse les connexions privilégiées ou disposant d'accès direct aux tables personnelles. Les fonctions de dossier contrôlent le sujet actif et sa personne, puis posent une portée RLS. Les mutations ordinaires des résultats et du journal sont refusées. L'import de démonstration est limité par empreinte et whitelist SQL. Les fichiers de migration administrateur sont séparés de l'environnement chargé par Next, mais cette séparation de configuration locale n'est pas une frontière contre une application compromise partageant le même UID. Les limites d'identité de démo et d'audit transactionnel restent ouvertes. Une indisponibilité SQL renvoie 503, jamais un dossier reconstruit depuis les fixtures.

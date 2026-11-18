Tu reprends Health Convergence / Convergence Personal.

Lis d'abord CLAUDE.md, HANDOFF_CLAUDE_CODE.md et docs/personal-sprint-03/BILAN.md. Inspecte le code avant de proposer une refonte. Les rapports de tests existants sont des preuves de sessions antérieures, pas des tests que tu as toi-même exécutés.

Continue le développement de façon concrète, autonome et testée. La priorité actuelle est de consolider le parcours documentaire PDF natif : import synthétique borné, résultats proposés avec page et texte source, revue explicite, persistance et idempotence. Choisis ensuite un incrément limité à partir du backlog.

Le fondateur a demandé de retravailler l'organisation des données plus tard : conserve pour l'instant les cinq pages, leur découpage et le design actuel. Ne lance pas une réorganisation générale du produit ou des bases.

Préserve le backend PostgreSQL, ses contrôles SQL et les tests. La démo mobile est une variante séparée, privée et sur données synthétiques ; ne la présente pas comme une version PostgreSQL hébergée. Aucun document réel, diagnostic, score médical, prescription, OCR/LLM simulé ni intégration fournisseur inventée.

Ne retire pas la whitelist des PDF de démonstration. N'annonce aucune performance d'extraction générale, calibration ou conformité sans mesure appropriée. Les fichiers .env et les droits de publication ne sont pas dans l'archive ; ne me demande pas de coller des mots de passe dans la conversation.

Commence par vérifier l'installation et les tests nécessaires, explique brièvement ce que tu as vérifié, puis réalise un incrément fonctionnel. Ne t'arrête pas à un plan théorique. Avant une dépense, un compte externe, une modification DNS, un déploiement public ou un traitement de données réelles, demande mon accord.

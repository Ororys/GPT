# Analyse RGPD approfondie — Convergence Personal V1 (18 novembre 2026)

**Avertissement.** Cette analyse a été rédigée par Claude, une IA, selon la méthode d'un juriste en protection des données. **Ce n'est pas une consultation d'avocat.** Elle s'appuie sur le RGPD, la loi Informatique et Libertés, le Code de la santé publique et les publications de la CNIL et de l'ANS. Elle doit être validée par un avocat ou un DPO avant tout traitement de données réelles. Les points non vérifiés sur le texte officiel sont signalés « à vérifier ». Le projet d'AIPD correspondant est dans `AIPD_PROJET.md`.

## 1. Qualification

| Question | Analyse | Conclusion |
|---|---|---|
| Données de santé ? | Article 4.15 du RGPD : données relatives à la santé physique ou mentale qui révèlent des informations sur l'état de santé. Les résultats de biologie, la tension, la masse grasse, la VFC et le sommeil en font partie par nature. Les pas et la distance, pris isolément, sont plus discutables, mais leur réunion dans un dossier de santé les fait entrer dans la catégorie | **Toutes les données du dossier sont à traiter comme des données de santé** (article 9) |
| Responsable de traitement | La société éditrice détermine les finalités et les moyens : stockage, structure, durée, sécurité. L'exemption « usage domestique » protège l'utilisateur, pas l'éditeur | **La société est responsable de traitement** |
| Sous-traitants | Hébergeur, fournisseur d'identité, et tout futur service d'envoi d'e-mails ou de suivi d'erreurs | Contrats de l'article 28 obligatoires |
| Destinataires | Aucun : le dossier n'est partagé avec personne. Apple et Google ne reçoivent rien de l'application, puisque les données sont lues sur le téléphone puis envoyées à notre serveur | À maintenir ; tout partage futur, avec un soignant par exemple, fera l'objet d'une nouvelle analyse |
| Prise de décision automatisée (art. 22) | Aucune décision, aucun score | Non applicable |
| Hébergement HDS (art. L.1111-8 CSP) | Le texte vise l'hébergement, **pour le compte de la personne concernée**, de données de santé recueillies lors d'activités de prévention, de diagnostic ou de soins. Un bilan de laboratoire en est l'exemple type | **Hébergeur certifié HDS obligatoire** dès la première donnée réelle. L'hébergement sans certification est une infraction pénale (art. L.1115-1 CSP : 3 ans et 45 000 €, *à vérifier sur Légifrance*) |

## 2. Base légale

- **Article 6 (licéité)** : exécution du contrat (art. 6.1.b) pour le compte et le service.
- **Article 9 (données sensibles)** : seule l'exception du **consentement explicite** (art. 9.2.a) convient. L'exception « médecine préventive » (art. 9.2.h) suppose un professionnel tenu au secret, ce qui n'est pas le cas ici.

Conséquences pratiques :
1. Le consentement doit être **distinct** de l'acceptation des conditions générales, **explicite** (case à cocher ou geste dédié), **éclairé** et **granulaire**. Le découpage par source du sprint 09 (PDF, import, téléphone) va dans ce sens : c'est un atout.
2. Le consentement doit pouvoir être **retiré aussi facilement qu'il a été donné** (art. 7.3) : c'est le cas dans les paramètres.
3. **Le retrait doit pouvoir entraîner l'effacement** (art. 17.1.b) lorsqu'aucune autre base ne justifie la conservation. Aujourd'hui, le retrait arrête les nouvelles entrées mais **ne supprime rien** : **non conforme en l'état**.
4. La preuve du consentement doit être conservée (art. 7.1) : la table versionnée `source_consent` le permet, mais il faut y joindre la **version du texte** présenté.

## 3. Principes de l'article 5

| Principe | Constat | Appréciation |
|---|---|---|
| Licéité, loyauté, transparence | Pas encore de politique de confidentialité définitive | **À faire** |
| Limitation des finalités | Finalité unique et descriptive, formalisée dans `DESTINATION_PREVUE.md` | Conforme sur le principe |
| Minimisation | 5 types de données du téléphone, ni nom ni e-mail stocké par l'application, aucun traceur publicitaire | Bon niveau |
| Exactitude | Correction versionnée des résultats PDF ; rien pour les autres données | Partiel |
| Limitation de la conservation | Aucune durée définie, historique immuable | **Non conforme** |
| Intégrité et confidentialité | RLS, double authentification, session vérifiée par la base, historique non modifiable, sauvegarde testée | Bon niveau technique, à confirmer par audit |
| Responsabilité (*accountability*) | Documentation technique riche ; registre, DPO et AIPD absents | **À faire** |

## 4. Droits des personnes (art. 12 à 22)

Réponse sous **un mois**, gratuite (art. 12).

| Droit | État | Action |
|---|---|---|
| Information (art. 13) | Page provisoire dans l'application mobile | Politique complète : identité du responsable, DPO, finalité, base légale, durées, droits, réclamation CNIL, sous-traitants, absence de transfert |
| Accès (art. 15) | Export complet | Conforme ; ajouter une copie lisible (le résumé PDF peut servir) |
| Rectification (art. 16) | PDF seulement | Étendre à la saisie manuelle et aux mesures, ou prévoir une procédure par le support |
| **Effacement (art. 17)** | **Impossible** | **Bloquant** : suppression complète du compte et du dossier |
| Limitation (art. 18) | Absent | Pouvoir « geler » un dossier, en lecture seule, pendant une contestation |
| Portabilité (art. 20) | Export JSON structuré | Conforme ; un format standard de santé (FHIR) serait un plus, pas une obligation |
| Directives post mortem (art. 85 loi I&L) | Absent | Mentionner ce droit dans la politique de confidentialité |

## 5. Sécurité (art. 32) et violations (art. 33 et 34)

Points forts : cloisonnement par dossier dans la base, rôle applicatif sans accès direct aux tables, preuve de session vérifiée par la base, double authentification, historique non modifiable, exercice de restauration automatisé, liste blanche des PDF.

Lacunes :
1. **Accès de l'équipe** : l'administrateur de la base peut tout lire. Il faut une politique d'accès en production : qui, pourquoi, avec journal et double authentification.
2. **Journal** : la CNIL recommande de conserver les traces d'accès **de six mois à un an** (délibération 2021-122). Il faut une purge automatique.
3. **Chiffrement au repos et clés** : à obtenir de l'hébergeur et à décrire. Ce n'est pas exigé par le texte, mais c'est attendu pour des données de santé.
4. **Test d'intrusion** avant ouverture (B-10).
5. **Procédure de violation** : registre interne des incidents, notification à la CNIL **sous 72 heures**, information des personnes si le risque est élevé.

## 6. Gouvernance

| Obligation | Applicable ? | Pourquoi |
|---|---|---|
| **DPO** (art. 37) | **Oui, obligatoire** | Activité de base consistant en un traitement à grande échelle de données de santé. Un DPO externe mutualisé est admis |
| **AIPD** (art. 35) | **Oui, obligatoire** | Données de santé de personnes potentiellement vulnérables ; liste CNIL |
| Consultation préalable de la CNIL (art. 36) | Seulement si un risque élevé subsiste après les mesures | À décider à la fin de l'AIPD |
| Registre des traitements (art. 30) | Oui | Données sensibles |
| Protection dès la conception (art. 25) | Oui | Déjà largement appliquée : à documenter |

## 7. Points spécifiques au produit

- **Mineurs** : la majorité numérique française est fixée à 15 ans (art. 45 loi I&L), mais **réserver le service aux majeurs** est plus simple et plus prudent pour des données de santé. Il faut une déclaration d'âge à l'inscription.
- **Cookies** : le seul cookie (session, HttpOnly) est strictement nécessaire, donc exempté de consentement (art. 82 loi I&L). Ajouter un outil de mesure d'audience ou de suivi d'erreurs changerait l'analyse.
- **Magasins d'applications** : Google Play exige une déclaration « Sécurité des données » et le respect de la politique Health Connect (usage limité, pas de publicité). Apple encadre l'usage des données Santé (pas de publicité, pas de stockage des données Santé dans iCloud selon ses règles de revue). *Conditions à relire sur les textes à jour avant publication.*
- **Transferts hors UE** : aucun si l'hébergeur et le fournisseur d'identité sont en France. **Ne pas ajouter** d'outils américains (analytique, suivi d'erreurs, e-mail) sans analyse.
- **Démo Sites** : elle ne contient que des données fictives et ne doit jamais en recevoir de réelles.
- **À surveiller** : le règlement européen sur l'espace des données de santé (EHDS, 2025/327), qui prévoit un étiquetage des applications de bien-être interopérables avec les dossiers médicaux ; le règlement sur l'IA si une fonction d'IA est ajoutée ; le règlement sur les dispositifs médicaux si la destination change.

## 8. Risques en cas de manquement

Amende administrative jusqu'à **20 millions d'euros ou 4 % du chiffre d'affaires mondial** (art. 83), sanctions pénales pour l'hébergement sans certificat HDS, et surtout un risque d'image fort sur des données de santé.

## 9. Actions à mener

### A. Bloquant : avant la première donnée réelle

| # | Action | Qui | Code ? | Coût indicatif |
|---|---|---|---|---|
| A1 | Désigner un **DPO** (externe possible) | Fondateur | Non | Abonnement DPO externe, à chiffrer |
| A2 | Finaliser et valider l'**AIPD** (`AIPD_PROJET.md`) | DPO | Non | Inclus |
| A3 | Signer avec un **hébergeur HDS** et un fournisseur d'identité, avec contrats de l'article 28 | Fondateur | Non | Voir `COMPARATIF_HDS.md` |
| A4 | Décider des **durées de conservation** (dossier, PDF, journal de 6 mois à 1 an, comptes inactifs) | DPO + fondateur | Ensuite oui | — |
| A5 | **Suppression du compte et du dossier**, et effacement au retrait d'un consentement si la personne le demande | Développement, après A4 | **Oui** | — |
| A6 | **Écran de consentement explicite** séparé des conditions générales, avec version du texte conservée | Juriste + développement | **Oui** | — |
| A7 | **Politique de confidentialité** et conditions générales définitives | Juriste | Textes | Rédaction juridique |
| A8 | **Déclaration de majorité** à l'inscription | Développement | **Oui** | — |
| A9 | **Registre des traitements** | DPO | Non | — |
| A10 | Politique d'**accès de l'équipe** à la production | Fondateur + DPO | Non | — |

### B. Avant le lancement public

| # | Action | Qui | Code ? |
|---|---|---|---|
| B1 | **Test d'intrusion** indépendant | Prestataire | Non |
| B2 | **Procédure de violation** (72 h) et registre des incidents | DPO | Non |
| B3 | **Purge automatique du journal** selon la durée retenue | Développement | Oui |
| B4 | **Gel du dossier** (limitation, art. 18) | Développement | Oui |
| B5 | Rectification au-delà des PDF, ou procédure via le support | Développement | Oui |
| B6 | Déclarations **Google Play** (Sécurité des données, Health Connect) et **Apple** (confidentialité, Santé) | Fondateur | Non |
| B7 | Mention des **directives post mortem** et du droit de réclamation auprès de la CNIL | Juriste | Textes |
| B8 | Relecture réglementaire de la destination prévue (MDR) | Spécialiste | Non |

### C. En continu

- Revoir l'AIPD à chaque nouvelle source ou fonction, par exemple les séances de sport du téléphone ou le partage avec un soignant.
- Aucun outil tiers (analytique, e-mail, suivi d'erreurs) sans contrat de l'article 28 ni analyse des transferts.
- Revue annuelle des accès et un exercice de restauration par trimestre.

## Sources

- [CNIL — santé, exigences générales](https://cnil.fr/fr/sante-exigences-generales) ; [liste des traitements avec AIPD obligatoire](https://www.cnil.fr/sites/default/files/atoms/files/liste-traitements-avec-aipd-requise-v2.pdf)
- [CNIL — recommandation journalisation](https://www.cnil.fr/sites/cnil/files/atoms/files/recommandation_-_journalisation.pdf) ; [annonce de la CNIL](https://cnil.fr/la-cnil-publie-une-recommandation-relative-aux-mesures-de-journalisation)
- [Article L.1111-8 CSP (Légifrance)](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049577902) ; [ANS — champ d'application HDS](https://esante.gouv.fr/faq/quel-est-le-champ-dapplication-de-la-legislation-relative-lhebergement-de-donnees-de-sante-caractere-personnel)
- [Village de la Justice — HDS et RGPD](https://www.village-justice.com/articles/hebergement-donnee-sante-rgpd,30355.html)
- Textes cités de mémoire et à vérifier sur Légifrance ou EUR-Lex : articles 4, 5, 6, 7, 9, 12 à 22, 25, 28, 30, 32 à 37 et 83 du RGPD ; articles 45, 82 et 85 de la loi Informatique et Libertés ; article L.1115-1 CSP.

## 10. Lecture des PDF par une IA en ligne (analyse du 19 novembre 2026)

Demande du fondateur : faire lire les valeurs d'un PDF par une IA en ligne, **sans interprétation**. Cette fonction n'est pas codée. Ci-dessous, ce qu'elle exigerait. Ce n'est pas un avis d'avocat.

**Pourquoi ce n'est pas comme un utilisateur qui envoie lui-même son bilan à ChatGPT.** Dans ce cas, c'est un usage personnel (exemption domestique de l'article 2.2.c) : la personne choisit le service, et la société éditrice de Convergence n'intervient pas. Si c'est **notre application** qui envoie le PDF, c'est la société qui choisit le fournisseur, le moyen et la finalité : elle devient **responsable de ce traitement**, et le fournisseur d'IA devient son **sous-traitant**.

**Le consentement ne remplace pas le contrat.** Ce sont deux obligations distinctes :

| Obligation | Rôle | La case à cocher suffit-elle ? |
|---|---|---|
| Base légale (art. 6 et 9.2.a) | Rendre l'envoi licite | **Oui**, si le consentement est explicite, distinct, éclairé (fournisseur nommé, pays, durée de conservation) et retirable |
| Contrat de sous-traitance (art. 28) | Encadrer ce que le fournisseur fait des données | **Non**, obligatoire en plus. En pratique : accepter le DPA (accord de traitement) du fournisseur, qui est en général standard |
| Transferts hors UE (art. 44 et suivants) | Si le fournisseur est américain | **Non** : il faut une base de transfert (certification Data Privacy Framework du fournisseur, ou clauses types). Le consentement (art. 49) ne vaut que pour des transferts occasionnels |
| Information (art. 13) | Dire à qui part le PDF | Texte à ajouter à côté de la case |
| AIPD (art. 35) | Évaluer le nouveau risque | Mise à jour obligatoire |
| Sécurité (art. 32) | Protéger l'envoi | Chiffrement en transit, aucune conservation sur notre relais |

**Point à faire trancher par un avocat : l'hébergement HDS.** Si le fournisseur d'IA ou notre serveur relais **conserve** le PDF (journaux, historique), cela peut être qualifié d'hébergement de données de santé, donc certificat HDS exigé. Un traitement **à la volée sans conservation** (option « zéro conservation » du fournisseur) réduit fortement ce risque, sans certitude juridique.

**Recommandation.**
1. Choisir un fournisseur qui offre un DPA, une **option zéro conservation** et, idéalement, un traitement **dans l'UE** (un fournisseur européen évite la question des transferts). À vérifier fournisseur par fournisseur.
2. Une case à cocher **à chaque envoi** (ou une autorisation « Lecture par IA » distincte, retirable comme les autres), nommant le fournisseur.
3. Un relais minimal qui ne garde rien et ne journalise pas le contenu.
4. Mettre à jour l'AIPD et la politique de confidentialité avant d'activer la fonction.

**Alternative sans aucune de ces obligations pour la société** : un bouton « Partager » qui ouvre le PDF dans l'application d'IA que la personne choisit elle-même (ChatGPT, Le Chat…), puis la personne saisit les valeurs dans Convergence. C'est moins pratique, mais c'est alors son propre usage.

### Choix d'OpenAI (19 novembre 2026) : points propres à ce fournisseur

Sources secondaires, à confirmer sur les documents contractuels d'OpenAI :
- **Un abonnement ChatGPT n'est pas le contrat de l'API.** Il faut un projet sur la plateforme API, dont le DPA (avec les clauses types de l'UE) s'accepte dans les réglages. Les clients de l'EEE contractent avec OpenAI Ireland.
- Par défaut, les contenus de l'API peuvent être conservés **jusqu'à 30 jours** pour la surveillance des abus. La **conservation nulle** et la **résidence européenne** sont accordées sur demande.
- Une source indique qu'OpenAI **n'est pas certifiée** Data Privacy Framework : les transferts reposeraient alors sur les clauses types, avec une **analyse d'impact des transferts** à mener.
- Le relais appelle l'API avec `store: false`, ce qui évite l'historique côté OpenAI, mais pas forcément la conservation pour la surveillance des abus. D'où l'intérêt de la conservation nulle, et du point HDS à faire valider.

Sources : [OpenAI — résidence en Europe](https://openai.com/index/introducing-data-residency-in-europe/), [Sovergate — conservation nulle et résidence UE](https://sovergate.com/blog/openai-zero-data-retention-eu-data-residency), [iubenda — OpenAI et RGPD](https://www.iubenda.com/en/blog/openai-gdpr-compliance/).

# Traçabilité — jalons 0 à 8

Source des exigences : les puces des jalons 0 à 8 dans `docs/cahier-des-charges.md` (section 20), lues dans `/cursor/stores/bc-0a7536e0-0186-49a8-b73b-163a6a3c2a89/docs/cahier-des-charges.md`. Une puce qui mélange des états différents est coupée en plusieurs lignes. Rien ici n'ajoute une exigence absente du jalon.

États : **fait et testé**, **partiel**, **à connecter**, **non fait**.

Le tableau d'origine n'a pas relancé les tests. Les lignes Playwright et les derniers totaux ont été mis à jour après les commandes du 1er novembre 2026.

- Dernier `npm test` dans `/workspace/maisons-quebec` : 118 passés, 0 échec, le 1er novembre 2026. Le test ajouté est `src/server/sqlite-backup.test.ts`. Les cases qui citent encore 117/0 décrivent la série d'avant cette sauvegarde.
- Derniers `npm run lint`, `npm run typecheck` et `npm run build` : succès, le même jour, après ce parcours. `npm test` reste 118 passés, 0 échec.
- Dernier `npm run test:e2e` : 3 passés, 0 échec (7,4 s), le 1er novembre 2026. Le troisième parcours exécute `content.open_draft` : le brouillon reprend le corps de `lire-une-methode`, le HTML public reste le même, et les assertions déjà vertes restent en place.
- Les GET Ops du 31 octobre 2026 sont ceux écrits dans `progression.md`. Ils n'ont pas été refaits.

| Jalon | Exigence | État | Route ou module | Test qui le prouve | Dernier résultat connu | Dépendance externe |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Consulter `ops.tayoo.app` et `/docs` sans inventer leur contenu | partiel | aucun module du dépôt ; notes dans le magasin `docs/tayoo-ops-architecture.md` | aucun test du dépôt | GET du 31 octobre 2026, non relancés : racine 302 puis 200 (porte d'accès), `/docs` 302 | Cloudflare Access |
| 0 | Conventions d'auth, API, secrets et matrice d'intégration Ops | non fait | — | — | docs produit non lues | accès Ops |
| 0 | Architecture cible (public, admin, données, jobs, analytics, studio, rapports, sauvegardes) | partiel | `docs/decisions.md` du magasin, marquées provisoires | aucun test d'architecture | copie SQLite manuelle testée ; pas de sauvegarde planifiée, pas d'hébergement | docs Ops non lues |
| 0 | Choix n8n conforme à la licence, sans fork | non fait | `src/domain/automation.ts` (`requestN8nConnection`) répond seulement « à connecter » ou « non branché » | `src/domain/automation.test.ts` — « n'appelle pas n8n… » | `npm test` 117/0, non relancé ici | licence et instance n8n |
| 0 | Feuille de route des jalons, dépendances, critères, risques | partiel | `progression.md` du magasin | aucun test de roadmap | pas d'estimation, pas de plan Hostinger, pas de coût | — |
| 1 | Accueil et pages piliers en français, sans donnée inventée | fait et testé | `/`, `/vendre`, `/acheter`, `/marche`, `/outils` — `src/content/home.ts`, `src/content/pillars.ts` | `src/content/home.test.ts`, `src/content/pillars.test.ts` | `npm test` 117/0, non relancé ici | — |
| 1 | Design system, responsive, performance, accessibilité | non fait | CSS local seulement | aucun test actuel | une lecture navigateur de l'accueil le 31 octobre 2026, non relancée | — |
| 1 | Indexabilité : canonique, robots, sitemap | partiel | `src/domain/site-url.ts`, `src/app/robots.ts`, `src/app/sitemap.ts` | `src/domain/site-url.test.ts` pour l'hôte ; le sitemap complet n'a pas de test HTTP | `npm test` 117/0, non relancé ici | — |
| 1 | Bilinguisme contrôlé | non fait | `lang="fr-CA"` seulement | — | — | — |
| 1 | Authentification admin | fait et testé | `/admin/login`, `src/server/admin-access.ts` | `src/server/admin-access.test.ts`, `src/server/admin-login.test.ts` | `npm test` 117/0, non relancé ici | — |
| 1 | RBAC des cinq rôles | fait et testé | `src/server/admin-permissions.ts` | `src/server/admin-rbac.test.ts` — « applique le moindre privilège… » | `npm test` 117/0, non relancé ici | — |
| 1 | MFA des comptes privilégiés | partiel | `/admin/securite`, `src/server/totp.ts` | `src/server/totp.test.ts`, `src/server/security-ops.test.ts` | le trou est testé si le secret est vide ; les rôles non privilégiés n'ont pas de TOTP | — |
| 1 | Paramètres globaux du site | partiel | `/admin/settings`, `src/server/settings-db.ts` | `src/server/settings-db.test.ts`, `src/domain/regulatory-identity.test.ts`, `src/content/home.test.ts` | hero et identité vide testés ; menus, pied de page et campagnes absents | — |
| 1 | Journal d'audit sans donnée personnelle | fait et testé | `/admin/audit`, `src/server/admin-audit.ts` | `src/server/security-ops.test.ts` — « note qui, quoi et quand… » | `npm test` 117/0, non relancé ici | — |
| 1 | Gestion des comptes et rôles | partiel | `/admin/team` | `src/server/admin-rbac.test.ts` — amorçage et refus de désactiver le dernier propriétaire | pas de parcours navigateur des cinq rôles | — |
| 1 | Isolation du public et de l'admin | fait et testé | `src/proxy.ts`, `src/server/admin-gate.ts` | `src/server/admin-gate.test.ts` | `npm test` 117/0, non relancé ici | — |
| 1 | Secrets chiffrés, absents du dépôt | partiel | `.env.example`, TOTP et secret de webhook | `src/server/security-ops.test.ts`, `src/server/automations.test.ts` (export sans secret) | pas de contrôle automatisé de tout le dépôt | — |
| 1 | Migrations de base réversibles | fait et testé | `src/server/settings-db.ts` | `src/server/settings-db.test.ts` — « applique et annule la migration… » | `npm test` 117/0, non relancé ici | SQLite local, pas Postgres |
| 1 | Cache | non fait | — | — | — | — |
| 1 | Journaux expurgés | partiel | `src/server/job-queue.ts`, audit | `src/server/security-ops.test.ts` — l'erreur brute n'est pas recopiée | pas de journal d'exploitation complet | — |
| 1 | Jobs asynchrones | partiel | `/admin/jobs`, `src/server/job-queue.ts` | `src/server/security-ops.test.ts` — enfiler, échouer, reprendre | le travail reste dans la requête ; pas de worker séparé | — |
| 1 | Sauvegarde et restauration | non fait | — | — | — | — |
| 1 | CI et environnements séparés | partiel | `.github/workflows/ci.yml`, scripts `npm test`, `lint`, `typecheck`, `build`, `test:e2e` | le workflow n'a pas tourné : rien n'est poussé | derniers lint, types et build locaux : succès, non relancés pour cette ligne | GitHub Actions non exécuté |
| 2 | Calcul du produit net, sans promesse | fait et testé | `/vendre/calculateur-produit-net`, `src/domain/sale-proceeds.ts` | `src/domain/sale-proceeds.test.ts`, `src/domain/money-input.test.ts` | `npm test` 117/0, non relancé ici | — |
| 2 | Lien profond du calcul, sans courriel dans l'URL | fait et testé | `src/domain/net-proceeds-link.ts` | `src/domain/net-proceeds-link.test.ts` | `npm test` 117/0, non relancé ici | — |
| 2 | Funnels estimation, vendre avant d'acheter, quartiers, coût, préparation, sans donnée inventée | partiel | `/vendre/estimation-maison`, `/vendre/vendre-avant-acheter`, `/acheter/comparer-quartiers`, `/acheter/cout-total-achat`, `/vendre/preparer-sa-maison` | `src/domain/honest-funnels.test.ts` | les tests prouvent l'absence de prix et de quartier inventés, pas un parcours marché complet | barèmes et inventaires non fournis |
| 2 | Radar de prix et rendement locatif | non fait | — | — | le cahier les prévoit ; le code ne les ouvre pas | sources sous licence |
| 2 | Demande, consentement, dédoublonnage, rendez-vous | fait et testé | `src/server/acquisition.ts`, `/admin/leads` | `src/server/acquisition.test.ts` | `npm test` 117/0, non relancé ici | — |
| 2 | Notifications licites (courriel ou SMS) | non fait | — | — | — | consentement commercial, transporteur |
| 2 | Outbox et POST webhook signé, livré seulement après un 2xx | partiel | `src/server/acquisition.ts` | `src/server/webhook-delivery.test.ts`, `src/server/acquisition.test.ts` | 2xx, 500 et silence réseau testés vers `127.0.0.1` ; pas de DLQ, replay ni mapping | destination HTTPS réelle non branchée |
| 2 | Catalogue `/admin/events` limité aux événements émis | partiel | `/admin/events`, `src/domain/event-catalog.ts` | `src/domain/event-catalog.test.ts`, `src/server/event-catalog.test.ts` | consentement exigé ; pas d'événements libres | — |
| 2 | Filtres, mappings, test synthétique et surveillance des webhooks | non fait | `/admin/integrations/webhooks` enregistre une destination | pas de test de ces fonctions : elles n'existent pas | HMAC et retries couverts seulement par la ligne outbox | — |
| 3 | Brouillon, publication SSR, aperçu, versions, restauration | fait et testé | `/admin/contenu`, `/guides/[slug]`, `src/server/content-pages.ts` | `src/server/content-pages.test.ts` | `npm test` 117/0, non relancé ici | — |
| 3 | noindex si brouillon, texte court, exemple, prix sans source ou score sous le seuil | fait et testé | `src/domain/content-page.ts`, `src/domain/editorial-scores.ts` | `src/domain/content-page.test.ts`, `src/server/content-pages.test.ts` | `npm test` 117/0, non relancé ici | — |
| 3 | Média avec licence, fichier local, visible seulement si la page est publiée | fait et testé | `/admin/medias`, `/medias/[id]`, `src/server/media-library.ts` | `src/server/media-library.test.ts` | `npm test` 117/0, non relancé ici | — |
| 3 | Templates, programmation et workflow de révision | non fait | — | — | — | — |
| 3 | Hero et identité enregistrés, relus sans redéploiement | partiel | `/admin/settings`, accueil | `src/server/settings-db.test.ts`, `src/content/home.test.ts` | pas de GET HTTP relancé pour cette ligne | — |
| 3 | Menus, pied de page, campagnes, pages de confiance | non fait | — | — | — | — |
| 3 | Pages Québec–Lévis, observatoire, politique d'actualisation | non fait | `/methodologie` existe comme page pilier, pas comme observatoire | `src/content/pillars.test.ts` ne couvre pas ces contenus | — | données locales sous licence |
| 3 | Sitemap des guides indexables, sans l'adresse redirigée | fait et testé | `src/app/sitemap.ts` via `listIndexableGuidePaths` | `src/server/content-redirects.test.ts` | `npm test` 117/0, non relancé ici ; le XML HTTP du sitemap n'est pas asserté | — |
| 3 | Redirection 301, refus de boucle et de cible non publiée | fait et testé | `/admin/contenu`, `src/proxy.ts`, `src/server/content-redirects.ts` | `src/server/content-redirects.test.ts` | `npm test` 117/0, non relancé ici | — |
| 4 | Connexion OpenRouter, modèle, budget, génération | à connecter | `/admin/prompts`, `src/server/editorial-l0.ts` | `src/server/editorial-l0.test.ts` — « ne génère rien et n'appelle personne sans clé » | clé vide : « à connecter », aucun appel ; clé présente : « non branché », toujours aucun appel | `OPENROUTER_API_KEY` |
| 4 | Prompt L0 intégral, versionné, hash stable | fait et testé | `prompts/editorial/L0-core.fr-CA.md` | `src/server/editorial-l0.test.ts` — « garde le texte 1.0.0… » | `npm test` 117/0, non relancé ici | — |
| 4 | Couches L1 et L2 éditables, sans écraser L0 | fait et testé | `/admin/prompts`, `src/server/prompt-layers.ts` | `src/server/prompt-layers.test.ts` | `npm test` 117/0, non relancé ici | — |
| 4 | Couche L3, schémas de sortie, agents de recherche sourcée | non fait | — | — | — | OpenRouter |
| 4 | Trois scores 0–100 et blocage de publication | fait et testé | `/admin/contenu/[id]`, `src/domain/editorial-scores.ts` | `src/domain/editorial-scores.test.ts`, `src/server/content-pages.test.ts` | `npm test` 117/0, non relancé ici | — |
| 4 | Pexels, Unsplash et génération d'image | à connecter | `/admin/medias` | `src/domain/media-asset.test.ts`, `src/server/media-library.test.ts` | clés vides : « à connecter », transport non appelé | `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY`, `IMAGE_GENERATION_API_KEY` |
| 4 | Fichier image déposé, hors git, avec crédit | fait et testé | `data/media`, `/medias/[id]` | `src/server/media-library.test.ts` — « garde le fichier hors du dépôt… » | `npm test` 117/0, non relancé ici | — |
| 4 | Actualisation d'un article par IA, avec diff | non fait | — | — | `content.open_draft` copie un corps déjà écrit ; ce n'est pas une actualisation IA | OpenRouter |
| 4 | Tests d'hallucination, d'injection et d'image trompeuse | non fait | — | le noindex d'un prix sans source est testé, pas ces cas | — | — |
| 5 | Vues, sessions, visiteurs uniques, fuseau America/Toronto | fait et testé | `/admin/analytics`, `src/server/page-views.ts`, `src/domain/analytics-report.ts` | `src/server/analytics.test.ts`, `src/domain/analytics-report.test.ts` | `npm test` 117/0, non relancé ici | — |
| 5 | Temps engagé : secondes visibles seulement | fait et testé | `src/domain/engaged-time.ts`, `POST /temps-engage` | `src/domain/engaged-time.test.ts`, `src/server/analytics.test.ts` | sans signal, le rapport est un trou | — |
| 5 | Retour : même visiteur sur deux jours civils de Toronto | fait et testé | `src/domain/analytics-report.ts` | `src/domain/analytics-report.test.ts` — « compte un retour… » | `npm test` 117/0, non relancé ici | — |
| 5 | Search Console et Bing | non fait | trou nommé dans `NOT_COLLECTED` | aucun connecteur, donc aucun test | — | comptes Search Console et Bing |
| 5 | Cohortes, chemins de navigation, statistiques techniques | non fait | — | — | le retour à deux jours n'est pas une cohorte | — |
| 5 | Période, pages, trous, comparaison de deux périodes | fait et testé | `/admin/analytics` | `src/domain/analytics-report.test.ts` — « n'affiche un écart… » | un trou n'est pas un delta depuis zéro | — |
| 5 | Exports JSON, CSV et PDF aux mêmes totaux, barres mesurées | fait et testé | `/admin/analytics/export`, `src/domain/analytics-report.ts` | `src/domain/analytics-report.test.ts` — « mêmes totaux dans les trois exports » | `npm test` 117/0, non relancé ici | — |
| 5 | Constructeur de rapports, historique, programmation | non fait | — | — | un seul rapport de la période choisie | — |
| 5 | Taux de conversion des parcours au chemin connu | fait et testé | `src/domain/analytics-report.ts` | `src/domain/analytics-report.test.ts` — « calcule le taux… » | pas de taux par campagne ni par canal | — |
| 5 | Qualité des leads et suggestions SEO ou IA | non fait | — | — | — | — |
| 6 | Décision et connexion n8n | à connecter | `/admin/automations`, `requestN8nConnection` | `src/domain/automation.test.ts` — « n'appelle pas n8n… » | URL vide : « à connecter » ; URL présente : « non branché » | `N8N_BASE_URL`, licence |
| 6 | Tableau : nœud déclencheur relié au nœud action, même JSON que l'import | fait et testé | `/admin/automations`, `saveAutomationBoard` | `src/server/automations.test.ts` — « enregistre depuis le tableau… » | `npm test` 117/0, non relancé ici | — |
| 6 | Glisser-déposer, conditions, connecteurs libres | non fait | — | — | le tableau n'a que les deux nœuds déjà supportés | — |
| 6 | Import et export JSON, secret refusé, essai à blanc | fait et testé | `/admin/automations/export`, `src/domain/automation.ts` | `src/domain/automation.test.ts`, `src/server/automations.test.ts` | l'essai à blanc ne crée ni tâche, ni livraison, ni brouillon | — |
| 6 | Format de workflow n8n | non fait | — | — | — | n8n |
| 6 | `content.open_draft` : copie du corps publié, page publique inchangée | fait et testé | `src/server/content-pages.ts`, `src/server/automations.ts` | `src/server/automations.test.ts` — « copie le corps publié… » | `npm test` 117/0, non relancé ici | — |
| 6 | Modèles : recherche de sources, images, SEO, alerte, rapport hebdomadaire | non fait | — | — | — | OpenRouter, n8n |
| 6 | `auto_publish` refusé | fait et testé | `parseAutomation`, `parseAutomationDocument` | `src/domain/automation.test.ts`, `src/server/automations.test.ts` | `auto_publish` et `content.auto_publish` n'écrivent rien | — |
| 6 | Rollback d'une automatisation | non fait | les versions sont gardées | aucun test de restauration d'une définition | — | — |
| 6 | Journal d'exécution et droits owner / automation_manager | partiel | `automation_runs`, `/admin/automations` | `src/server/automations.test.ts` — édition réservée, exécutions enregistrées | pas d'alerte ni de budget | — |
| 7 | Parcours agentique depuis un lien profond, consentement avant la demande | fait et testé | `/vendre/calculateur-produit-net` | `src/domain/net-proceeds-link.test.ts`, `src/server/acquisition.test.ts` | `npm run test:e2e` du 1er novembre 2026 : 3 passés, 0 échec, après le dépôt d'image, `content.open_draft`, les redirections et le tableau | — |
| 7 | OpenAPI 3.1 du calcul, sans POST de lead public | fait et testé | `/openapi/produit-net` | `src/domain/openapi-produit-net.test.ts` | `npm test` 117/0, non relancé ici | — |
| 7 | WebMCP | non fait | aucune route | aucun test | marqué « non branché » dans `decisions.md`, sans protocole simulé | spécification stable absente |
| 7 | Assistant conversationnel avec sources | non fait | — | — | — | OpenRouter |
| 7 | Observatoire, newsletter, widgets, expansion territoriale | non fait | — | — | — | données et consentements |
| 7 | SEO génératif vérifié sur les pages publiques | non fait | — | — | — | moteurs de réponse |
| 8 | Tests unitaires du dépôt | partiel | `src/**/*.test.ts` | la commande `npm test` | 118 passés, 0 échec, le 1er novembre 2026 | — |
| 8 | Lint, types et build | partiel | `package.json` | `npm run lint`, `npm run typecheck`, `npm run build` | succès le 1er novembre 2026, après la sauvegarde SQLite | — |
| 8 | Trois parcours Playwright | partiel | `e2e/parcours.spec.ts` | les trois `test(...)` du fichier | `npm run test:e2e` du 1er novembre 2026 : 3 passés, 0 échec (7,4 s). Le troisième parcours exécute aussi `content.open_draft` | Chromium local |
| 8 | Parcours visiteur → lead → webhook livré → admin | partiel | `e2e/parcours.spec.ts` — « visiteur, calcul… » | le test e2e laisse l'outbox en attente ; la livraison 2xx est dans `src/server/webhook-delivery.test.ts` | `npm run test:e2e` du 1er novembre 2026 : 3 passés, 0 échec. L'outbox du visiteur reste en attente. Le 2xx local est dans `npm test` 118/0 | destination webhook réelle |
| 8 | Parcours admin → IA → médias → scores → publication | partiel | `e2e/parcours.spec.ts` — « brouillon humain… » | le test exige « à connecter » ou « non branché » et échoue si un article ou une image est fabriqué | `npm run test:e2e` du 1er novembre 2026 : 3 passés, 0 échec. Le test exige toujours « à connecter » ou « non branché » | OpenRouter, Pexels, Unsplash |
| 8 | Parcours workflow → exécution → article mis à jour → PDF | partiel | `e2e/parcours.spec.ts` — « JSON d'automatisation… » | le troisième test exécute `content.open_draft`, compare le corps du brouillon à la page publiée, et exige le même HTML public | `npm run test:e2e` du 1er novembre 2026 : 3 passés, 0 échec (7,4 s). Le brouillon reprend le corps de `lire-une-methode`. `/guides/lire-une-methode` garde le même HTML. `/guides/lire-une-methode-brouillon` répond 404. Le PDF égale encore le JSON. La page publiée n'est pas réécrite | — |
| 8 | Contrôles d'accès de bout en bout, conformité OACIQ / Loi 25 / LCAP | non fait | identité réglementaire vide testée, pas la checklist | `src/domain/regulatory-identity.test.ts` ne vaut pas une conformité | `docs/compliance-checklist.md` absent | validation humaine |
| 8 | Performance, crawl, reprise après panne | non fait | — | — | — | — |
| 8 | Guide d'exploitation, sauvegarde, coût, monitoring | partiel | `/workspace/maisons-quebec/docs/exploitation.md` et la copie du magasin `docs/exploitation.md` ; `npm run backup:sqlite` | `src/server/sqlite-backup.test.ts` — « restaure une ligne connue… » | Le guide décrit l'installation, le lancement, les commandes de test, la copie SQLite et les états « à connecter ». `hero_title` est relu dans une base temporaire ; un échec de copie laisse le fichier de destination inchangé. Pas de coût, pas de monitoring, pas de sauvegarde planifiée | — |
| 8 | Ne pas déployer ni changer le DNS sans autorisation | partiel | aucun workflow de déploiement dans le dépôt | aucun test | aucun déploiement fait pendant ces tranches ; ce n'est pas une preuve automatisée | autorisation du fondateur |

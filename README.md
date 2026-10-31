# Maisons Québec

Fondation locale du site [https://maisonsquebec.ca](https://maisonsquebec.ca). Ce n'est pas le produit fini.

Le stack est **provisoire** : Next.js (App Router), TypeScript, React. Il reste révisable quand la documentation Ops sera fournie. Aucune doc `ops.tayoo.app` n'a été lue pour ce dépôt. Il n'y a pas de base de données, pas de CRM, pas de webhook, pas de déploiement.

## Lancer

```bash
npm install
npm run dev
```

L'accueil est servi en HTML, en français (Québec). Les permis, le nom d'agence et le permis d'agence viennent des variables d'environnement. Vides, ils s'affichent comme « À compléter — donnée non fournie ».

## Vérifier

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

`npm test` exécute le calcul du produit net, l'identité réglementaire, l'origine canonique, le texte d'accueil et le garde admin.

## Ce qui répond

- Accueil public : promesse, limites, territoire de Québec–Lévis sans chiffres, formule du produit net en toutes lettres, champs réglementaires vides.
- Module `src/domain/sale-proceeds.ts` : produit net déterministe en cents, sans taux légal embarqué. L'écran du calculateur n'est pas ouvert (parcours prévu plus tard).
- `/admin` : refus **401** sans session. Le secret `ADMIN_SESSION_SECRET` vide fait échouer toute session. Il n'y a pas de page de connexion.
- `robots.txt` autorise le public et interdit `/admin`. Le sitemap ne contient que l'accueil.

## Ce qui n'est pas fait

- Authentification multifacteur, rôles réellement appliqués, comptes persistés. Une session signée, si un secret était fourni plus tard, entrerait sans second facteur et sans contrôle de rôle. Le trou est affiché sur la page admin et décrit dans le refus.
- Leads, formulaires, rendez-vous, webhooks, CRM.
- Pages piliers, guides, quartiers, SEO complet, données structurées d'agence. Seul un `WebSite` sans adresse ni permis est émis.
- Postgres, jobs, studio IA, images, analytique, automatisations.
- Dépôt distant, DNS, déploiement. Ne pas pousser ce dépôt tant que ce n'est pas demandé.

## Configuration

Copier `.env.example`. Ne pas y mettre de secret réel dans git. `SITE_URL` doit rester `https://maisonsquebec.ca`. Le code refuse `maisonquebec.ca` et tout autre hôte.

Le calcul public n'est pas une évaluation certifiée, ni un avis fiscal, ni un avis juridique. La fiscalité personnelle est exclue. Une pénalité hypothécaire inconnue n'est pas estimée.

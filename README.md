# Maisons Québec

Fondation locale du site [https://maisonsquebec.ca](https://maisonsquebec.ca). Ce n'est pas le produit fini.

Le stack est **provisoire** : Next.js (App Router), TypeScript, React. Il reste révisable quand la documentation Ops sera fournie. Aucune doc `ops.tayoo.app` n'a été lue pour ce dépôt. Les réglages du site tiennent dans un SQLite local, remplaçable. Il n'y a pas de Postgres, pas de CRM, pas de webhook, pas de déploiement.

## Lancer

```bash
npm install
npm run dev
```

L'accueil et les pages piliers sont servis en HTML, en français (Québec). Les permis, le nom d'agence et le permis d'agence restent vides tant qu'ils ne sont pas fournis. L'affichage est alors « À compléter — donnée non fournie ».

## Vérifier

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

`npm test` exécute le calcul du produit net, les pages piliers, l'identité réglementaire, les migrations SQLite, le TOTP et la connexion admin.

## Ce qui répond

- Accueil et pages `/vendre`, `/acheter`, `/marche`, `/outils`, `/guides`, `/methodologie`, `/contact`.
- Module `src/domain/sale-proceeds.ts` : produit net déterministe. L'écran du calculateur n'est pas ouvert.
- Réglages du site dans `data/site-settings.sqlite` (ou `SITE_SETTINGS_PATH`). Migration `001_site_settings`, annulable. Aucun permis n'est inséré par la migration.
- `/admin/login` : compte d'amorçage lu dans `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD` et `ADMIN_SESSION_SECRET`. Ces valeurs sont vides dans `.env.example`. Sans elles, la connexion répond 401.
- Cookie `mq_admin_session` : `HttpOnly`, `SameSite=Lax`, `Secure` seulement en HTTPS. `/admin` et `/admin/settings` répondent 401 sans ce cookie.
- TOTP : si `ADMIN_TOTP_SECRET` est vide, la session est créée sans second facteur et l'admin le dit. S'il est rempli, un code faux est refusé et un code valide marque la session comme vérifiée.

## Ce qui n'est pas fait

- Rôles réellement appliqués, plusieurs comptes, base d'utilisateurs. Le compte d'amorçage est unique et vit dans l'environnement.
- Leads, formulaires de contact, rendez-vous, webhooks, CRM, écran du calculateur.
- Pages de quartiers, guides rédigés, SEO complet, données structurées d'agence.
- Postgres, jobs, studio IA, images, analytique, automatisations.
- Dépôt distant, DNS, déploiement. Ne pas pousser ce dépôt tant que ce n'est pas demandé.

## Configuration

Copier `.env.example`. Ne pas y mettre de secret réel dans git. `SITE_URL` doit rester `https://maisonsquebec.ca`. Le code refuse `maisonquebec.ca` et tout autre hôte.

Le calcul public n'est pas une évaluation certifiée, ni un avis fiscal, ni un avis juridique. La fiscalité personnelle est exclue. Une pénalité hypothécaire inconnue n'est pas estimée.

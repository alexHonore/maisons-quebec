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
- `/admin/login` : le premier propriétaire est créé seulement par `ADMIN_BOOTSTRAP_EMAIL` et `ADMIN_BOOTSTRAP_PASSWORD`, si aucun propriétaire n'existe. Ces valeurs sont vides dans `.env.example`. Sans elles, la connexion répond 401. Les comptes suivants sont dans SQLite.
- Rôles : `owner`, `editor`, `analyst`, `integration_manager`, `automation_manager`. Le rôle effectif est relu en base. L'éditeur peut modifier le texte public, pas les permis. L'analyste lit le journal. Le gestionnaire d'automatisation peut lancer le contrôle. Le gestionnaire d'intégrations n'a pas d'action tant que les webhooks n'existent pas. Seul le propriétaire gère les comptes et les champs réglementaires.
- `/admin/jobs` : file persistée (enfiler, exécuter, échec, reprise) et journal du contrôle « champs vides ou renseignés ». Ni permis, ni courriel, ni statistique.
- `/admin/audit` : qui (identifiant), quoi, quand. Pas de courriel, pas de permis, pas de secret.
- Cookie `mq_admin_session` : `HttpOnly`, `SameSite=Lax`, `Secure` seulement en HTTPS. `/admin`, `/admin/settings`, `/admin/team` et `/admin/jobs` répondent 401 sans session.
- TOTP par compte privilégié (`owner`, `integration_manager`, `automation_manager`) : le secret est chiffré dans SQLite et n'est affiché qu'une fois, à l'enrôlement. Si `ADMIN_TOTP_SECRET` est vide et qu'aucun facteur n'est confirmé, la session n'est pas multifacteur. Le texte dit « MFA non actif ».

## Ce qui n'est pas fait

- TOTP pour les rôles non privilégiés. Le secret global reste un trou tant qu'il est vide et qu'aucun facteur de compte n'est confirmé.
- Worker séparé de la requête, sauvegardes, pages de quartiers.
- Leads, formulaires de contact, rendez-vous, webhooks, CRM, écran du calculateur.
- Pages de quartiers, guides rédigés, SEO complet, données structurées d'agence.
- Postgres, studio IA, images, analytique, automatisations.
- Dépôt distant, DNS, déploiement. Ne pas pousser ce dépôt tant que ce n'est pas demandé.

## Configuration

Copier `.env.example`. Ne pas y mettre de secret réel dans git. `SITE_URL` doit rester `https://maisonsquebec.ca`. Le code refuse `maisonquebec.ca` et tout autre hôte.

Le calcul public n'est pas une évaluation certifiée, ni un avis fiscal, ni un avis juridique. La fiscalité personnelle est exclue. Une pénalité hypothécaire inconnue n'est pas estimée.

# Maisons Québec

Fondation locale du site [https://maisonsquebec.ca](https://maisonsquebec.ca). Ce n'est pas le produit fini.

Le stack est **provisoire** : Next.js (App Router), TypeScript, React. Il reste révisable quand la documentation Ops sera fournie. Aucune doc `ops.tayoo.app` n'a été lue pour ce dépôt. Les réglages du site tiennent dans un SQLite local, remplaçable. Il n'y a pas de Postgres, pas de CRM branché, pas de déploiement. Une destination de webhook peut être enregistrée localement.

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
- `/vendre/calculateur-produit-net` : produit net hypothétique à partir de la saisie. Pas de barème officiel. Une demande de réponse est enregistrée seulement avec consentement, avant tout webhook.
- Cinq autres parcours sans barème : `/vendre/estimation-maison`, `/vendre/vendre-avant-acheter`, `/vendre/preparer-sa-maison`, `/acheter/comparer-quartiers`, `/acheter/cout-total-achat`. Ce qui manque reste « À compléter — donnée non fournie ». Même consentement, même SQLite avant webhook, même outbox.
- Dédoublonnage : courriel normalisé plus nom du funnel. Deux noms identiques avec deux courriels restent deux demandes. Une seconde soumission de la même clé peut ajouter `appointment.requested` s'il n'y en a pas encore, sans changer le nom ni le consentement. Un rendez-vous déjà demandé n'est pas écrasé. Seul le propriétaire peut confirmer un créneau réellement saisi.
- `/admin/events` : catalogue limité à `lead.created`, `appointment.requested` et `appointment.confirmed`. Lecture pour le propriétaire, l'analyste et le gestionnaire d'intégrations. Modification pour le propriétaire et le gestionnaire d'intégrations. Pas de script, pas de déclencheur arbitraire, pas de contournement du consentement.
- Réglages du site dans `data/site-settings.sqlite` (ou `SITE_SETTINGS_PATH`). Migration `001_site_settings`, annulable. Aucun permis n'est inséré par la migration.
- `/admin/login` : le premier propriétaire est créé seulement par `ADMIN_BOOTSTRAP_EMAIL` et `ADMIN_BOOTSTRAP_PASSWORD`, si aucun propriétaire n'existe. Ces valeurs sont vides dans `.env.example`. Sans elles, la connexion répond 401. Les comptes suivants sont dans SQLite.
- Rôles inchangés. Le propriétaire voit les demandes. L'analyste en voit l'état, sans nom ni courriel. L'éditeur ne les voit pas. Le propriétaire et le gestionnaire d'intégrations enregistrent une destination de webhook. Le secret n'est plus affiché ensuite. Sans destination, ou si l'envoi échoue, la demande reste en attente.
- `/admin/jobs` : file persistée (enfiler, exécuter, échec, reprise) et journal du contrôle « champs vides ou renseignés ». Ni permis, ni courriel, ni statistique.
- `/admin/contenu` : brouillon puis publication. Le public lit `/guides/[slug]` dans SQLite à chaque visite. L'aperçu privé est réservé au propriétaire et à l'éditeur. Un brouillon répond 404. Une page publiée trop faible est `noindex`. Une page publiée, assez longue, sourcée et sans chiffre non vérifié peut être indexée.
- `/admin/audit` : qui (identifiant), quoi, quand. Pas de courriel, pas de permis, pas de secret.
- Cookie `mq_admin_session` : `HttpOnly`, `SameSite=Lax`, `Secure` seulement en HTTPS. `/admin`, `/admin/settings`, `/admin/team` et `/admin/jobs` répondent 401 sans session.
- TOTP par compte privilégié (`owner`, `integration_manager`, `automation_manager`) : le secret est chiffré dans SQLite et n'est affiché qu'une fois, à l'enrôlement. Si `ADMIN_TOTP_SECRET` est vide et qu'aucun facteur n'est confirmé, la session n'est pas multifacteur. Le texte dit « MFA non actif ».

## Ce qui n'est pas fait

- TOTP pour les rôles non privilégiés. Le secret global reste un trou tant qu'il est vide et qu'aucun facteur de compte n'est confirmé.
- Worker séparé de la requête, sauvegardes, pages de quartiers.
- Le calendrier externe, le radar de prix, le rendement locatif, les barèmes officiels, les filtres de destination et un CRM.
- Versions de pages, redirections, médias, pages de quartiers sourcées, SEO complet, données structurées d'agence.
- Postgres, studio IA, images, analytique, automatisations.
- Dépôt distant, DNS, déploiement. Ne pas pousser ce dépôt tant que ce n'est pas demandé.

## Configuration

Copier `.env.example`. Ne pas y mettre de secret réel dans git. `SITE_URL` doit rester `https://maisonsquebec.ca`. Le code refuse `maisonquebec.ca` et tout autre hôte.

Le calcul public n'est pas une évaluation certifiée, ni un avis fiscal, ni un avis juridique. La fiscalité personnelle est exclue. Une pénalité hypothécaire inconnue n'est pas estimée.

import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { saveContentDraftAction, saveContentRedirectAction } from "@/app/admin/contenu/actions";
import { listContentRedirects } from "@/server/content-redirects";
import { listContentPages } from "@/server/content-pages";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contenu",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  invalid: "Le titre, le résumé ou l'adresse ne sont pas utilisables.",
  unpublished: "La redirection exige deux pages publiées.",
  loop: "Cette redirection formerait une boucle.",
  duplicate: "Cette ancienne adresse a déjà une redirection.",
  duplicate_slug: "Cette adresse est déjà utilisée.",
  published_locked: "Une page publiée ne se modifie pas avec ce rôle.",
  missing: "Page introuvable.",
  forbidden: "Action refusée.",
};

export default async function ContentIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; redirige?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "content.preview")) forbidden();
  const params = await searchParams;
  const db = settingsDatabase(process.env);
  const pages = listContentPages(db, live.user.role) ?? [];
  const published = pages.filter((page) => page.status === "published");
  const redirects = roleCan(live.user.role, "content.write") ? listContentRedirects(db) : [];

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Pages de contenu</h1>
      <p>Un brouillon n&apos;est pas public. La publication est lue dans la base à chaque visite, sans reconstruction de l&apos;application.</p>
      {params.erreur ? <p role="alert">{ERRORS[params.erreur] ?? "Enregistrement refusé."}</p> : null}
      {params.redirige === "1" ? <p role="status">Redirection enregistrée. L&apos;ancienne adresse répond 301.</p> : null}
      {pages.length === 0 ? <p>Aucune page.</p> : null}
      <ul className="plain-list">
        {pages.map((page) => (
          <li key={page.id}>
            <Link href={`/admin/contenu/${page.id}`}>{page.title}</Link>
            {" — "}
            {page.status === "published" ? "publiée" : "brouillon"}
            {" — "}
            /guides/{page.slug}
          </li>
        ))}
      </ul>
      {roleCan(live.user.role, "content.write") ? (
        <>
          <h2>Redirections</h2>
          <p>Une ancienne adresse de page publiée peut pointer vers une autre page publiée. Le public reçoit 301. Une boucle, ou une cible qui n&apos;est pas publiée, est refusée. L&apos;ancienne adresse sort du sitemap.</p>
          {redirects.length === 0 ? <p>Aucune redirection.</p> : (
            <ul className="plain-list">
              {redirects.map((item) => (
                <li key={item.fromPath}>{item.fromPath} → {item.toPath}</li>
              ))}
            </ul>
          )}
          {published.length < 2 ? <p>Il faut deux pages publiées pour créer une redirection.</p> : (
            <form className="form-grid" action={saveContentRedirectAction}>
              <label>
                Ancienne adresse
                <select name="from_path" required>
                  {published.map((page) => (
                    <option key={page.id} value={`/guides/${page.slug}`}>/guides/{page.slug}</option>
                  ))}
                </select>
              </label>
              <label>
                Nouvelle adresse
                <select name="to_path" required>
                  {published.map((page) => (
                    <option key={page.id} value={`/guides/${page.slug}`}>/guides/{page.slug}</option>
                  ))}
                </select>
              </label>
              <button type="submit">Rediriger</button>
            </form>
          )}
        </>
      ) : null}
      {roleCan(live.user.role, "content.write") ? (
        <form className="form-grid" action={saveContentDraftAction}>
          <label>
            Adresse
            <input name="slug" required autoComplete="off" />
          </label>
          <label>
            Titre
            <input name="title" required autoComplete="off" />
          </label>
          <label>
            Résumé
            <input name="description" required autoComplete="off" />
          </label>
          <label>
            Texte
            <textarea name="body" rows={8} />
          </label>
          <label>
            Source déclarée
            <input name="source_note" autoComplete="off" />
          </label>
          <label>
            <span>
              <input name="example" type="checkbox" value="on" /> Marquer comme exemple, pas comme un fait.
            </span>
          </label>
          <button type="submit">Enregistrer le brouillon</button>
        </form>
      ) : null}
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}

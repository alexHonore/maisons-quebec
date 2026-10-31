import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { attachMediaAction, generateImageAction, saveMediaAssetAction, searchPexelsAction, searchUnsplashAction } from "@/app/admin/medias/actions";
import { listContentPages } from "@/server/content-pages";
import { imageProviderStatus, listMediaAssets } from "@/server/media-library";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Médias",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  invalid: "La fiche exige un titre, une licence, un auteur et une source.",
  license_required: "Sans licence, l'actif ne peut pas être associé à une page.",
  missing: "Page ou fiche introuvable.",
  forbidden: "Action refusée.",
};

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string; associe?: string; erreur?: string; fournisseur?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "media.manage")) forbidden();
  const params = await searchParams;
  const db = settingsDatabase(process.env);
  const assets = listMediaAssets(db);
  const pages = listContentPages(db, live.user.role) ?? [];
  const providers = [
    ["Pexels", imageProviderStatus(process.env.PEXELS_API_KEY)],
    ["Unsplash", imageProviderStatus(process.env.UNSPLASH_ACCESS_KEY)],
    ["Génération d'image", imageProviderStatus(process.env.IMAGE_GENERATION_API_KEY)],
  ] as const;

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Médias</h1>
      <p>Une fiche exige une licence, un auteur et une source. Sans licence, elle ne peut pas être associée à une page. Aucune image n&apos;est téléchargée ni générée ici.</p>
      {params.enregistre === "1" ? <p role="status">Fiche enregistrée. Aucun fichier image n&apos;a été ajouté.</p> : null}
      {params.associe === "1" ? <p role="status">Fiche associée à la page.</p> : null}
      {params.erreur ? <p role="alert">{ERRORS[params.erreur] ?? "Enregistrement refusé."}</p> : null}
      {params.fournisseur === "a-connecter" ? <p role="status">À connecter. Aucune image n&apos;a été enregistrée.</p> : null}
      {params.fournisseur === "non-branche" ? <p role="status">Non branché. Aucun appel n&apos;a été fait et aucune image n&apos;a été enregistrée.</p> : null}
      <h2>Fournisseurs</h2>
      <ul className="plain-list">
        {providers.map(([name, status]) => (
          <li key={name}>
            {name} — {status === "à connecter" ? "à connecter" : "non branché"}
          </li>
        ))}
      </ul>
      <form action={searchPexelsAction}>
        <button className="button" type="submit">Rechercher Pexels</button>
      </form>
      <form action={searchUnsplashAction}>
        <button className="button" type="submit">Rechercher Unsplash</button>
      </form>
      <form action={generateImageAction}>
        <button className="button" type="submit">Générer une image</button>
      </form>
      <h2>Fiches</h2>
      {assets.length === 0 ? <p>Aucune fiche.</p> : null}
      <ul className="plain-list">
        {assets.map((asset) => (
          <li key={asset.id}>
            {asset.title} — licence {asset.license} — {asset.author} — {asset.source}
          </li>
        ))}
      </ul>
      <form className="form-grid" action={saveMediaAssetAction}>
        <label>
          Titre
          <input name="title" required autoComplete="off" />
        </label>
        <label>
          Licence
          <input name="license" required autoComplete="off" />
        </label>
        <label>
          Auteur
          <input name="author" required autoComplete="off" />
        </label>
        <label>
          Source
          <input name="source" required autoComplete="off" />
        </label>
        <button type="submit">Enregistrer la fiche</button>
      </form>
      <h2>Associer à une page</h2>
      {pages.length === 0 || assets.length === 0 ? <p>Il faut une page et une fiche avec licence.</p> : (
        <form className="form-grid" action={attachMediaAction}>
          <label>
            Page
            <select name="page_id" required>
              {pages.map((page) => (
                <option key={page.id} value={page.id}>{page.title}</option>
              ))}
            </select>
          </label>
          <label>
            Fiche
            <select name="asset_id" required>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.title}</option>
              ))}
            </select>
          </label>
          <button type="submit">Associer</button>
        </form>
      )}
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}

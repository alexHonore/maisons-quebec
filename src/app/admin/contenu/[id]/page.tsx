import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { restoreContentVersionAction, saveContentDraftAction, setContentPublishedAction } from "@/app/admin/contenu/actions";
import { ContentArticle } from "@/components/content-article";
import { listContentVersions, readContentForPreview } from "@/server/content-pages";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { SCORE_PUBLICATION_MINIMUM } from "@/domain/editorial-scores";
import { loadPublicSite, settingsDatabase } from "@/server/public-site";
import { PublicFrame } from "@/components/public-frame";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aperçu",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  invalid: "Le titre, le résumé ou l'adresse ne sont pas utilisables.",
  duplicate_slug: "Cette adresse est déjà utilisée.",
  published_locked: "Une page publiée ne se modifie pas avec ce rôle.",
  missing: "Page introuvable.",
  forbidden: "Action refusée.",
  score_below_threshold: "Un score de préparation est sous le seuil. La page n'est pas publiée.",
};

export default async function ContentPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string; enregistre?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "content.preview")) forbidden();
  const { id } = await params;
  const query = await searchParams;
  const db = settingsDatabase(process.env);
  const preview = readContentForPreview(db, { actorRole: live.user.role, id });
  if (!preview.ok) {
    if (preview.reason === "forbidden") forbidden();
    return (
      <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
        <h1>Page introuvable</h1>
        <p>
          <Link href="/admin/contenu">Retour aux pages</Link>
        </p>
      </main>
    );
  }
  const { page } = preview;
  const versions = listContentVersions(db, page.id);
  const { content } = loadPublicSite(process.env);
  const canWrite = roleCan(live.user.role, "content.write") && (page.status === "draft" || roleCan(live.user.role, "content.publish"));

  return (
    <PublicFrame content={content}>
      <main id="contenu">
        <ContentArticle page={page} preview />
        <div className="wrap sheet">
          <h2>Scores de préparation</h2>
          <p>
            Barème {page.scores.rubricVersion}. Seuil {SCORE_PUBLICATION_MINIMUM} pour chaque note. Ce n&apos;est pas un classement observé, ni une citation, ni un nombre de leads.
          </p>
          <ul className="plain-list">
            <li>SEO {page.scores.seo}</li>
            <li>Citabilité {page.scores.citability}</li>
            <li>Conversion {page.scores.conversion}</li>
          </ul>
          <ul className="plain-list">
            {[...page.scores.seoCriteria, ...page.scores.citabilityCriteria, ...page.scores.conversionCriteria]
              .filter((criterion) => criterion.earned < criterion.weight)
              .map((criterion) => (
                <li key={criterion.id}>
                  {criterion.label} — {criterion.evidence}
                </li>
              ))}
          </ul>
          {query.enregistre === "1" ? <p role="status">Enregistré. La page publique lit la base maintenant.</p> : null}
          {query.erreur ? <p role="alert">{ERRORS[query.erreur] ?? "Enregistrement refusé."}</p> : null}
          {canWrite ? (
            <form className="form-grid" action={saveContentDraftAction}>
              <input type="hidden" name="id" value={page.id} />
              <label>
                Adresse
                <input name="slug" required defaultValue={page.slug} autoComplete="off" />
              </label>
              <label>
                Titre
                <input name="title" required defaultValue={page.title} autoComplete="off" />
              </label>
              <label>
                Résumé
                <input name="description" required defaultValue={page.description} autoComplete="off" />
              </label>
              <label>
                Texte
                <textarea name="body" rows={8} defaultValue={page.body} />
              </label>
              <label>
                Source déclarée
                <input name="source_note" defaultValue={page.sourceNote} autoComplete="off" />
              </label>
              <label>
                <span>
                  <input name="example" type="checkbox" value="on" defaultChecked={page.example} /> Marquer comme exemple, pas comme un fait.
                </span>
              </label>
              <button type="submit">Enregistrer</button>
            </form>
          ) : (
            <p>La lecture de l&apos;aperçu est permise. L&apos;enregistrement de cette page ne l&apos;est pas pour ce rôle.</p>
          )}
          {roleCan(live.user.role, "content.publish") ? (
            <form action={setContentPublishedAction}>
              <input type="hidden" name="id" value={page.id} />
              <input type="hidden" name="published" value={page.status === "published" ? "0" : "1"} />
              <button className="button" type="submit">
                {page.status === "published" ? "Remettre en brouillon" : "Publier"}
              </button>
            </form>
          ) : null}
          <h2>Versions</h2>
          {versions.length === 0 ? <p>Aucune version. La publication en crée une.</p> : null}
          <ul className="plain-list">
            {versions.map((version) => (
              <li key={version.id}>
                <p>
                  Version {version.versionNumber} — {version.createdAt}
                  {version.restoredFrom === null ? "" : ` — reprise de la version ${version.restoredFrom}`}
                </p>
                {roleCan(live.user.role, "content.publish") ? (
                  <form action={restoreContentVersionAction}>
                    <input type="hidden" name="id" value={page.id} />
                    <input type="hidden" name="version_number" value={String(version.versionNumber)} />
                    <button className="button" type="submit">
                      Restaurer cette version
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {page.assessment.visible ? (
            <p>
              <Link href={`/guides/${page.slug}`}>Voir la page publique</Link>
            </p>
          ) : null}
          <p>
            <Link href="/admin/contenu">Retour aux pages</Link>
          </p>
        </div>
      </main>
    </PublicFrame>
  );
}

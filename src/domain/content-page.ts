import { REGULATORY_EMPTY_LABEL } from "./regulatory-identity";

/**
 * Lecture opérationnelle du cahier pour cette tranche :
 * une sous-page non publiée, ou publiée mais trop mince, sans source,
 * marquée comme exemple, ou porteuse d'un chiffre non vérifié, reste noindex.
 * Une page publiée, assez longue, avec une source nommée et sans chiffre non vérifié peut être indexée.
 * Le seuil de longueur n'est pas une statistique de marché.
 */
export const CONTENT_INDEX_RULE =
  "Une page est indexable seulement si elle est publiée, si son texte atteint le seuil de substance, si une source est nommée, si elle n'est pas marquée comme exemple, et si le titre, la description et le texte ne contiennent ni dollar, ni pourcentage, ni nombre de trois chiffres ou plus. Sinon elle est noindex. Un brouillon n'est pas public.";

export const MIN_INDEXABLE_BODY_LENGTH = 600;

export type ContentStatus = "draft" | "published";

export type ContentIndexReason = "draft" | "example" | "thin" | "source_missing" | "unverified_figure" | "indexable";

export type ContentDraftInput = {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly sourceNote: string;
  readonly example: boolean;
};

export type ContentAssessment = {
  readonly visible: boolean;
  readonly indexable: boolean;
  readonly robots: "index, follow" | "noindex, nofollow";
  readonly reason: ContentIndexReason;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseContentDraft(input: {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly sourceNote: string;
  readonly example: boolean;
}): { ok: true; value: ContentDraftInput } | { ok: false; reason: "invalid" } {
  const slug = input.slug.trim().toLowerCase();
  const title = input.title.trim().replace(/\s+/g, " ");
  const description = input.description.trim().replace(/\s+/g, " ");
  const body = input.body.replace(/\r\n/g, "\n").trim();
  const sourceNote = input.sourceNote.trim().replace(/\s+/g, " ");
  if (!SLUG.test(slug) || slug.length < 3 || slug.length > 60) return { ok: false, reason: "invalid" };
  if (title.length < 2 || title.length > 120) return { ok: false, reason: "invalid" };
  if (description.length < 2 || description.length > 240) return { ok: false, reason: "invalid" };
  if (body.length > 12000) return { ok: false, reason: "invalid" };
  if (sourceNote.length > 400) return { ok: false, reason: "invalid" };
  return { ok: true, value: { slug, title, description, body, sourceNote, example: input.example } };
}

export function containsUnverifiedFigure(value: string): boolean {
  return /\$|%|\d{3,}/.test(value);
}

export function assessContentPage(page: {
  readonly status: ContentStatus;
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly sourceNote: string;
  readonly example: boolean;
}): ContentAssessment {
  const reason = indexReason(page);
  const indexable = reason === "indexable";
  return {
    visible: page.status === "published",
    indexable,
    robots: indexable ? "index, follow" : "noindex, nofollow",
    reason,
  };
}

function indexReason(page: {
  readonly status: ContentStatus;
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly sourceNote: string;
  readonly example: boolean;
}): ContentIndexReason {
  if (page.status !== "published") return "draft";
  if (page.example) return "example";
  if (page.body.trim().length < MIN_INDEXABLE_BODY_LENGTH) return "thin";
  const source = page.sourceNote.trim();
  if (source.length < 12 || source === REGULATORY_EMPTY_LABEL) return "source_missing";
  if (containsUnverifiedFigure(page.title) || containsUnverifiedFigure(page.description) || containsUnverifiedFigure(page.body)) {
    return "unverified_figure";
  }
  return "indexable";
}

export function indexReasonLabel(reason: ContentIndexReason): string {
  switch (reason) {
    case "draft":
      return "brouillon, non public";
    case "example":
      return "exemple, non indexé";
    case "thin":
      return "texte trop court, non indexé";
    case "source_missing":
      return "source absente, non indexé";
    case "unverified_figure":
      return "chiffre non vérifié, non indexé";
    case "indexable":
      return "publiée et indexable";
  }
}

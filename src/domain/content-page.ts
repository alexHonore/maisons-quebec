import { REGULATORY_EMPTY_LABEL } from "./regulatory-identity";

/**
 * Une année, une longueur de texte ou un numéro civique ne bloque pas l'indexation.
 * Un prix, un pourcentage, un taux ou un décompte de marché sans source nommée force noindex.
 * Brouillon, texte trop court et exemple restent non indexés.
 */
export const CONTENT_INDEX_RULE =
  "Une page est indexable si elle est publiée, si son texte atteint le seuil de substance et si elle n'est pas un exemple. Une année, une longueur de texte ou un numéro civique ne suffit pas à la bloquer. Un prix, un pourcentage, un taux ou un décompte de marché sans source nommée force noindex. Un brouillon n'est pas public.";

export const MIN_INDEXABLE_BODY_LENGTH = 600;

export type ContentStatus = "draft" | "published";

export type ContentIndexReason = "draft" | "example" | "thin" | "unsourced_market_claim" | "score_below_threshold" | "indexable";

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

export function contentSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase();
  if (!SLUG.test(slug) || slug.length < 3 || slug.length > 60) return null;
  return slug;
}

export function parseContentDraft(input: {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly sourceNote: string;
  readonly example: boolean;
}): { ok: true; value: ContentDraftInput } | { ok: false; reason: "invalid" } {
  const slug = contentSlug(input.slug);
  const title = input.title.trim().replace(/\s+/g, " ");
  const description = input.description.trim().replace(/\s+/g, " ");
  const body = input.body.replace(/\r\n/g, "\n").trim();
  const sourceNote = input.sourceNote.trim().replace(/\s+/g, " ");
  if (!slug) return { ok: false, reason: "invalid" };
  if (title.length < 2 || title.length > 120) return { ok: false, reason: "invalid" };
  if (description.length < 2 || description.length > 240) return { ok: false, reason: "invalid" };
  if (body.length > 12000) return { ok: false, reason: "invalid" };
  if (sourceNote.length > 400) return { ok: false, reason: "invalid" };
  return { ok: true, value: { slug, title, description, body, sourceNote, example: input.example } };
}

export function hasNamedSource(sourceNote: string): boolean {
  const source = sourceNote.trim();
  return source.length >= 2 && source !== REGULATORY_EMPTY_LABEL;
}

/** Prix, pourcentage, taux ou décompte de marché. Une année, une longueur ou un numéro civique ne comptent pas. */
export function textHasMarketClaim(value: string): boolean {
  if (/\$/.test(value)) return true;
  if (/\d[\d\s\u00a0.,]*\s*(?:dollars?|CAD)\b/i.test(value)) return true;
  if (/\bprix\b[^.\n]{0,80}\d|\d[^.\n]{0,40}\bprix\b/i.test(value)) return true;
  if (/%/.test(value)) return true;
  if (/\d[^.\n]{0,30}\bpour\s+cent\b/i.test(value)) return true;
  if (/\btaux\b[^.\n]{0,40}\d/i.test(value)) return true;
  if (/\d[\d\s\u00a0.,]*\s*(?:ventes?|transactions?|inscriptions?|mises en marché|maisons vendues|propriétés vendues)\b/i.test(value)) {
    return true;
  }
  return false;
}

export function hasUnsourcedMarketClaim(page: {
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly sourceNote: string;
}): boolean {
  if (hasNamedSource(page.sourceNote)) return false;
  return textHasMarketClaim(`${page.title}\n${page.description}\n${page.body}`);
}

export function assessContentPage(
  page: {
    readonly status: ContentStatus;
    readonly title: string;
    readonly description: string;
    readonly body: string;
    readonly sourceNote: string;
    readonly example: boolean;
  },
  options?: { readonly scoresPassed?: boolean },
): ContentAssessment {
  const reason = indexReason(page, options?.scoresPassed);
  const indexable = reason === "indexable";
  return {
    visible: page.status === "published",
    indexable,
    robots: indexable ? "index, follow" : "noindex, nofollow",
    reason,
  };
}

function indexReason(
  page: {
    readonly status: ContentStatus;
    readonly title: string;
    readonly description: string;
    readonly body: string;
    readonly sourceNote: string;
    readonly example: boolean;
  },
  scoresPassed?: boolean,
): ContentIndexReason {
  if (page.status !== "published") return "draft";
  if (page.example) return "example";
  if (page.body.trim().length < MIN_INDEXABLE_BODY_LENGTH) return "thin";
  if (hasUnsourcedMarketClaim(page)) return "unsourced_market_claim";
  if (scoresPassed === false) return "score_below_threshold";
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
    case "unsourced_market_claim":
      return "prix, taux ou décompte sans source, non indexé";
    case "score_below_threshold":
      return "seuil de préparation non atteint, non indexé";
    case "indexable":
      return "publiée et indexable";
  }
}

import { REGULATORY_EMPTY_LABEL } from "./regulatory-identity";

export type MediaCredit = {
  readonly title: string;
  readonly license: string;
  readonly author: string;
  readonly source: string;
};

export type ImageTransport = (input: { readonly url: string }) => Promise<{ readonly status: number }>;

export function usableCredit(value: string): boolean {
  const text = value.trim().replace(/\s+/g, " ");
  return text.length >= 2 && text.length <= 200 && text !== REGULATORY_EMPTY_LABEL;
}

export function parseMediaAsset(input: {
  readonly title: string;
  readonly license: string;
  readonly author: string;
  readonly source: string;
}): { ok: true; value: MediaCredit } | { ok: false; reason: "invalid" } {
  const title = input.title.trim().replace(/\s+/g, " ");
  const license = input.license.trim().replace(/\s+/g, " ");
  const author = input.author.trim().replace(/\s+/g, " ");
  const source = input.source.trim().replace(/\s+/g, " ");
  if (!usableCredit(title) || !usableCredit(license) || !usableCredit(author) || !usableCredit(source)) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, value: { title, license, author, source } };
}

/** Sans licence utilisable, l'actif ne peut pas être associé à une page. */
export function mediaAssociationAllowed(license: string): boolean {
  return usableCredit(license);
}

/**
 * Cette tranche n'appelle aucun fournisseur.
 * Sans clé, la réponse est « à connecter » et aucune image n'est enregistrée.
 */
export function requestImageProvider(input: {
  readonly apiKey: string | undefined;
  readonly transport?: ImageTransport;
}): { ok: false; message: "à connecter" | "non branché"; recordedImage: false } {
  void input.transport;
  if ((input.apiKey ?? "").trim() === "") return { ok: false, message: "à connecter", recordedImage: false };
  return { ok: false, message: "non branché", recordedImage: false };
}

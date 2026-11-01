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

export const MAX_STORED_IMAGE_BYTES = 2_000_000;

export type StoredImageKind = {
  readonly ext: "png" | "jpg" | "gif" | "webp";
  readonly contentType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
};

/** Reconnaît un fichier déposé par son en-tête. Ne télécharge rien. */
export function detectStoredImage(bytes: Uint8Array): StoredImageKind | null {
  if (bytes.length < 12 || bytes.length > MAX_STORED_IMAGE_BYTES) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: "png", contentType: "image/png" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { ext: "gif", contentType: "image/gif" };
  }
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
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

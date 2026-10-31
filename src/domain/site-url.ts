/** Origine canonique. Aucun autre hôte n'est accepté tant que l'hébergement n'est pas décidé. */
export const CANONICAL_ORIGIN = "https://maisonsquebec.ca";

/**
 * Lit `SITE_URL`. Une valeur absente ou vide retombe sur l'origine canonique.
 * Tout autre hôte, le singulier `maisonquebec.ca`, un chemin ou un secret dans l'URL sont refusés.
 */
export function readSiteUrl(env: { readonly [key: string]: string | undefined }): URL {
  const raw = env.SITE_URL?.trim() ? env.SITE_URL.trim() : CANONICAL_ORIGIN;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("SITE_URL invalide.");
  }

  if (url.protocol !== "https:") {
    throw new Error("SITE_URL doit utiliser https.");
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error("SITE_URL ne doit pas contenir d'identifiants.");
  }
  if (url.hostname === "maisonquebec.ca" || url.hostname === "www.maisonquebec.ca") {
    throw new Error("maisonquebec.ca n'est pas le domaine du projet.");
  }
  if (url.hostname !== "maisonsquebec.ca") {
    throw new Error("SITE_URL doit utiliser l'hôte maisonsquebec.ca.");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("SITE_URL doit être l'origine, sans chemin.");
  }
  if (url.search !== "" || url.hash !== "") {
    throw new Error("SITE_URL ne doit pas contenir de requête ni de fragment.");
  }

  return new URL(CANONICAL_ORIGIN);
}

export type EditorialTransport = (input: { url: string; body: string }) => Promise<{ text: string }>;

/**
 * Cette tranche ne contacte pas OpenRouter.
 * Sans clé, la réponse est « à connecter » et aucun article n'est écrit.
 */
export function requestEditorialGeneration(input: {
  readonly apiKey: string | undefined;
  readonly transport?: EditorialTransport;
}): { ok: false; message: "à connecter" | "non branchée"; wroteArticle: false } {
  void input.transport;
  const key = input.apiKey?.trim() ?? "";
  if (key === "") return { ok: false, message: "à connecter", wroteArticle: false };
  return { ok: false, message: "non branchée", wroteArticle: false };
}

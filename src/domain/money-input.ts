/** Convertit une saisie en dollars vers des cents. N'invente pas un montant manquant. */
export function dollarsToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (trimmed === "") return null;
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

/** Convertit un pourcentage saisi vers des parts par million. Vide = absent. */
export function percentToPartsPerMillion(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (trimmed === "") return null;
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const ppm = Number(whole) * 10_000 + Number(fraction.padEnd(6, "0").slice(0, 6)) / 100;
  if (!Number.isInteger(ppm) || ppm < 0 || ppm > 1_000_000) return null;
  return ppm;
}

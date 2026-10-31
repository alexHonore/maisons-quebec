export const REGULATORY_EMPTY_LABEL = "À compléter — donnée non fournie";

export type RegulatoryIdentity = {
  readonly brokerPermit: string | null;
  readonly agencyName: string | null;
  readonly agencyPermit: string | null;
};

export type RegulatoryField = {
  readonly id: "broker_oaciq_permit" | "agency_name" | "agency_permit";
  readonly label: string;
  readonly value: string | null;
  readonly display: string;
  readonly state: "empty" | "filled";
};

function blankToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Lit les trois champs réglementaires. Une chaîne vide reste vide : rien n'est inventé. */
export function readRegulatoryIdentity(env: { readonly [key: string]: string | undefined }): RegulatoryIdentity {
  return {
    brokerPermit: blankToNull(env.BROKER_OACIQ_PERMIT),
    agencyName: blankToNull(env.AGENCY_NAME),
    agencyPermit: blankToNull(env.AGENCY_PERMIT),
  };
}

export function regulatoryFields(identity: RegulatoryIdentity): readonly RegulatoryField[] {
  const rows: readonly { id: RegulatoryField["id"]; label: string; value: string | null }[] = [
    { id: "broker_oaciq_permit", label: "Permis OACIQ du courtier", value: identity.brokerPermit },
    { id: "agency_name", label: "Nom de l'agence", value: identity.agencyName },
    { id: "agency_permit", label: "Permis de l'agence", value: identity.agencyPermit },
  ];
  return rows.map((row) => ({
    ...row,
    display: row.value ?? REGULATORY_EMPTY_LABEL,
    state: row.value === null ? "empty" : "filled",
  }));
}

/** La valeur enregistrée prime. Une valeur vide retombe sur l'environnement, jamais sur un permis inventé. */
export function resolveRegulatoryIdentity(
  stored: Pick<RegulatoryIdentity, "brokerPermit" | "agencyName" | "agencyPermit">,
  env: { readonly [key: string]: string | undefined },
): RegulatoryIdentity {
  const fromEnv = readRegulatoryIdentity(env);
  const pick = (storedValue: string | null, envValue: string | null): string | null => {
    const trimmed = storedValue?.trim() ?? "";
    if (trimmed !== "" && trimmed !== REGULATORY_EMPTY_LABEL) return trimmed;
    return envValue;
  };
  return {
    brokerPermit: pick(stored.brokerPermit, fromEnv.brokerPermit),
    agencyName: pick(stored.agencyName, fromEnv.agencyName),
    agencyPermit: pick(stored.agencyPermit, fromEnv.agencyPermit),
  };
}

export function regulatoryStatusLabel(identity: RegulatoryIdentity): string {
  const filled = [identity.brokerPermit, identity.agencyName, identity.agencyPermit].filter(
    (value) => value !== null,
  ).length;
  if (filled === 0) return "Identification professionnelle à compléter";
  if (filled < 3) return "Identification professionnelle partielle";
  return "Identification professionnelle renseignée — validation humaine encore requise";
}

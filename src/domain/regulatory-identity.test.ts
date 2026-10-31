import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REGULATORY_EMPTY_LABEL,
  readRegulatoryIdentity,
  regulatoryFields,
  regulatoryStatusLabel,
  resolveRegulatoryIdentity,
} from "./regulatory-identity";

describe("identité réglementaire", () => {
  it("reste vide quand les variables sont absentes ou blanches", () => {
    const identity = readRegulatoryIdentity({});
    assert.deepEqual(identity, { brokerPermit: null, agencyName: null, agencyPermit: null });
    const blank = readRegulatoryIdentity({
      BROKER_OACIQ_PERMIT: "  ",
      AGENCY_NAME: "",
      AGENCY_PERMIT: "\n",
    });
    assert.deepEqual(blank, identity);
    const fields = regulatoryFields(identity);
    assert.equal(fields.length, 3);
    assert.ok(fields.every((field) => field.state === "empty" && field.display === REGULATORY_EMPTY_LABEL));
    assert.equal(regulatoryStatusLabel(identity), "Identification professionnelle à compléter");
  });

  it("affiche une valeur fournie sans la remplacer par un permis inventé", () => {
    const identity = readRegulatoryIdentity({
      BROKER_OACIQ_PERMIT: "  EXEMPLE-NON-VERIFIE  ",
      AGENCY_NAME: "Agence à confirmer",
    });
    const fields = regulatoryFields(identity);
    assert.equal(fields[0]?.display, "EXEMPLE-NON-VERIFIE");
    assert.equal(fields[0]?.state, "filled");
    assert.equal(fields[1]?.display, "Agence à confirmer");
    assert.equal(fields[2]?.state, "empty");
    assert.equal(regulatoryStatusLabel(identity), "Identification professionnelle partielle");
    assert.match(regulatoryStatusLabel({ ...identity, agencyPermit: "X" }), /validation humaine/);
  });

  it("fait primer la valeur enregistrée et ignore le libellé vide", () => {
    const resolved = resolveRegulatoryIdentity(
      { brokerPermit: REGULATORY_EMPTY_LABEL, agencyName: "Cabinet saisi", agencyPermit: "" },
      { BROKER_OACIQ_PERMIT: "DEPUIS-ENV", AGENCY_NAME: "Depuis env", AGENCY_PERMIT: "" },
    );
    assert.equal(resolved.brokerPermit, "DEPUIS-ENV");
    assert.equal(resolved.agencyName, "Cabinet saisi");
    assert.equal(resolved.agencyPermit, null);
  });
});

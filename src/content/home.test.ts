import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REGULATORY_EMPTY_LABEL } from "../domain/regulatory-identity";
import { FORMULA_STATEMENT } from "../domain/sale-proceeds";
import { buildHomeContent, homePlainText } from "./home";

describe("accueil", () => {
  it("affiche la promesse, la formule et des champs réglementaires vides", () => {
    const content = buildHomeContent({ brokerPermit: null, agencyName: null, agencyPermit: null });
    const text = homePlainText(content);
    assert.match(text, /Votre prochaine décision immobilière commence avec de vraies informations/);
    assert.match(text, /Québec/);
    assert.ok(text.includes(FORMULA_STATEMENT.included));
    assert.ok(text.includes(FORMULA_STATEMENT.excluded));
    assert.ok(text.includes(FORMULA_STATEMENT.limit));
    assert.equal(content.identity.fields.filter((field) => field.display === REGULATORY_EMPTY_LABEL).length, 3);
    assert.match(text, /consentement explicite/);
    assert.match(text, /https:\/\/maisonsquebec\.ca/);
  });

  it("ne contient ni statistique, ni domaine au singulier, ni identité inventée", () => {
    const text = homePlainText(
      buildHomeContent({ brokerPermit: null, agencyName: null, agencyPermit: null }),
    );
    assert.doesNotMatch(text, /\$/);
    assert.doesNotMatch(text, /%/);
    assert.doesNotMatch(text, /\d{3,}/);
    assert.doesNotMatch(text, /maisonquebec\.ca/);
    assert.doesNotMatch(text, /Alex|Honoré/);
    assert.doesNotMatch(text, /@/);
  });

  it("reprend une valeur réglementaire fournie sans la présenter comme approuvée", () => {
    const content = buildHomeContent({
      brokerPermit: null,
      agencyName: "Cabinet à confirmer",
      agencyPermit: null,
    });
    assert.equal(content.identity.fields[1]?.display, "Cabinet à confirmer");
    assert.match(content.identity.caveat, /ne vaut ni approbation/);
    assert.match(content.identityStatus, /partielle/);
  });
});

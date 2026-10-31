import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REGULATORY_EMPTY_LABEL } from "../domain/regulatory-identity";
import { buildHomeContent } from "./home";
import { PILLAR_PAGES, pillarPlainText } from "./pillars";

describe("pages piliers", () => {
  it("couvre les quatre piliers et les liens de navigation, sans donnée inventée", () => {
    const paths = PILLAR_PAGES.map((page) => page.path);
    assert.deepEqual(paths, ["/vendre", "/acheter", "/marche", "/outils", "/guides", "/methodologie", "/contact"]);
    const home = buildHomeContent({ brokerPermit: null, agencyName: null, agencyPermit: null });
    for (const page of PILLAR_PAGES) {
      assert.ok(home.nav.some((item) => item.href === page.path));
      const text = pillarPlainText(page);
      assert.match(text, new RegExp(REGULATORY_EMPTY_LABEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(text, /\$/);
      assert.doesNotMatch(text, /%/);
      assert.doesNotMatch(text, /\d/);
      assert.doesNotMatch(text, /Alex|Honoré|maisonquebec\.ca/);
    }
  });
});

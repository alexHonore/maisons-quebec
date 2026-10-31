import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminPathRequiresSession } from "./admin-gate";

describe("garde des chemins admin", () => {
  it("laisse passer la connexion et la sortie, et ferme le reste", () => {
    assert.equal(adminPathRequiresSession("/admin/login"), false);
    assert.equal(adminPathRequiresSession("/admin/logout"), false);
    assert.equal(adminPathRequiresSession("/admin"), true);
    assert.equal(adminPathRequiresSession("/admin/settings"), true);
    assert.equal(adminPathRequiresSession("/admin/leads"), true);
  });
});

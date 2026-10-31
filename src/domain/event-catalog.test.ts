import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NATIVE_EVENT_TYPES,
  REFUSED_EVENT_TRIGGERS,
  parseEventDefinition,
} from "./event-catalog";

describe("catalogue d'événements", () => {
  it("ne propose que les événements réellement émis", () => {
    assert.deepEqual(NATIVE_EVENT_TYPES, ["lead.created", "appointment.requested", "appointment.confirmed"]);
    for (const refused of REFUSED_EVENT_TRIGGERS) {
      assert.equal(parseEventDefinition({ name: "signal_outil", trigger: refused, schemaVersion: "1.0" }).ok, false);
    }
    assert.equal(
      parseEventDefinition({ name: "signal_outil", trigger: "function(){return true}", schemaVersion: "1.0" }).ok,
      false,
    );
  });

  it("refuse un contournement du consentement et un nom exécutable", () => {
    assert.deepEqual(
      parseEventDefinition({ name: "signal_outil", trigger: "lead.created", schemaVersion: "1.0", consentRequired: false }),
      { ok: false, reason: "consent_locked" },
    );
    assert.equal(parseEventDefinition({ name: "eval_payload", trigger: "lead.created", schemaVersion: "1.0" }).ok, false);
    assert.equal(parseEventDefinition({ name: "lead.created", trigger: "lead.created", schemaVersion: "1.0" }).ok, false);
    const accepted = parseEventDefinition({
      name: "signal_vendeur",
      trigger: "appointment.requested",
      schemaVersion: "1.0",
      funnelName: "estimation_maison",
    });
    assert.equal(accepted.ok, true);
  });
});

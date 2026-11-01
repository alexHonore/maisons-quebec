import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { advanceVisibleClock, parseEngagedSeconds } from "./engaged-time";

describe("temps visible", () => {
  it("n'envoie que les secondes écoulées pendant que l'onglet est visible", () => {
    const hidden = advanceVisibleClock({ visibleSinceMs: null, carryMs: 0 }, 10_000, false);
    assert.equal(hidden.seconds, 0);
    const short = advanceVisibleClock({ visibleSinceMs: 0, carryMs: 0 }, 400, false);
    assert.equal(short.seconds, 0);
    const two = advanceVisibleClock({ visibleSinceMs: 0, carryMs: 0 }, 2_500, false);
    assert.equal(two.seconds, 2);
    assert.equal(two.clock.carryMs, 500);
    assert.equal(two.clock.visibleSinceMs, null);
    const stillHidden = advanceVisibleClock(two.clock, 12_500, false);
    assert.equal(stillHidden.seconds, 0);
    assert.equal(parseEngagedSeconds(7), 7);
    assert.equal(parseEngagedSeconds(0), null);
    assert.equal(parseEngagedSeconds(1.5), null);
  });
});
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bdtFromUsd, weightedRate } from "./money";

describe("amountBdt", () => {
  it("rounds both inputs to cents, then rounds the product", () => {
    assert.equal(bdtFromUsd("10.5", "122.345"), "1284.68");
  });

  it("keeps decimal tenths that binary floats cannot", () => {
    assert.equal(bdtFromUsd("0.10", "0.20"), "0.02");
    assert.notEqual(0.1 * 0.2, 0.02);
  });

  it("weights the average rate from the totals", () => {
    assert.equal(weightedRate("4000.00", "30.00"), "133.3333");
    assert.equal(weightedRate("0.00", "0.00"), "0.0000");
  });
});

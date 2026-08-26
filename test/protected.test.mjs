import assert from "node:assert/strict";
import { test } from "node:test";
import { withdraw } from "../src/withdraw.mjs";

test.skip("refuses a negative resulting balance", () => {
  assert.throws(() => withdraw(40, 100), /insufficient/);
});

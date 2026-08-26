import assert from "node:assert/strict";
import { test } from "node:test";
import { withdraw } from "../src/withdraw.mjs";

test("subtracts a permitted amount", () => {
  assert.equal(withdraw(40, 10), 30);
});

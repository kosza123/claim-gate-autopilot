/** Product files for git fixtures only. Compiler must not import this. */

export const WITHDRAW_OK = `export function withdraw(balance, amount) {
  const next = Number(balance) - Number(amount);
  if (!Number.isFinite(next) || next < 0) throw new Error("insufficient funds");
  return next;
}
`;

export const WITHDRAW_BROKEN = `export function withdraw(balance, amount) {
  return Number(balance) - Number(amount);
}
`;

export const UNIT_TEST = `import assert from "node:assert/strict";
import { test } from "node:test";
import { withdraw } from "../src/withdraw.mjs";

test("subtracts a permitted amount", () => {
  assert.equal(withdraw(40, 10), 30);
});
`;

export const PROTECTED_TEST = `import assert from "node:assert/strict";
import { withdraw } from "../src/withdraw.mjs";

assert.throws(() => withdraw(40, 100), /insufficient/);
`;

export const PROTECTED_SKIP = `import assert from "node:assert/strict";
import { test } from "node:test";
import { withdraw } from "../src/withdraw.mjs";

test.skip("refuses a negative resulting balance", () => {
  assert.throws(() => withdraw(40, 100), /insufficient/);
});
`;

export const PROTECTED_TAUTOLOGY = `import assert from "node:assert/strict";
assert.ok(true);
`;

export const E2E_TEST = `import assert from "node:assert/strict";
import { withdraw } from "../src/withdraw.mjs";

assert.equal(withdraw(100, 1), 99);
`;

export const PKG = (testScript: string) =>
  JSON.stringify(
    {
      name: "fixture-product",
      type: "module",
      scripts: { test: testScript, e2e: "node test/e2e.test.mjs" },
    },
    null,
    2,
  ) + "\n";

export const WORKFLOW = `name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
      - run: npm run e2e
`;

export const COVERAGE = `{ "lines": 80 }\n`;

export function baseFiles(): Record<string, string> {
  return {
    "src/withdraw.mjs": WITHDRAW_OK,
    "test/unit.test.mjs": UNIT_TEST,
    "test/protected.test.mjs": PROTECTED_TEST,
    "test/e2e.test.mjs": E2E_TEST,
    "package.json": PKG("node --test test/unit.test.mjs test/protected.test.mjs"),
    ".github/workflows/ci.yml": WORKFLOW,
    "coverage-threshold.json": COVERAGE,
  };
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePolicy, SCHEMA } from "../../src/policy.ts";
import { POLICY_RAW } from "../helpers/judge.ts";

describe("policy", () => {
  it("loads the trusted schema", () => {
    const p = parsePolicy(POLICY_RAW);
    assert.equal(p.schemaVersion, SCHEMA);
    assert.ok(p.duties.length >= 3);
    assert.ok(p.duties.every((d) => Array.isArray(d.argv)));
    assert.ok(!POLICY_RAW.includes("withdraw"));
  });

  it("rejects empty duties", () => {
    assert.throws(() =>
      parsePolicy(
        JSON.stringify({
          schemaVersion: SCHEMA,
          duties: [],
          protectedPaths: ["x"],
          evidenceSurface: [],
        }),
      ),
    );
  });
});

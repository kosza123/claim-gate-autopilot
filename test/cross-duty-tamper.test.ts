import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { commitAll, destroy, writeTree } from "./helpers/git-fixture.ts";
import { judge } from "./helpers/judge.ts";
import {
  baseFiles,
  UNIT_TAMPER,
  WITHDRAW_BROKEN,
} from "./helpers/sample-product.ts";

function init(): string {
  const dir = mkdtempSync(join(tmpdir(), "cg-tamper-"));
  spawnSync("git", ["init", "-q", dir]);
  spawnSync("git", ["-C", dir, "config", "user.email", "fixture@example.test"]);
  spawnSync("git", ["-C", dir, "config", "user.name", "Fixture"]);
  spawnSync("git", ["-C", dir, "config", "commit.gpgsign", "false"]);
  return dir;
}

describe("cross-duty workspace tamper", () => {
  it("does not ADMIT when unit overwrites protected tests and product is broken", () => {
    const dir = init();
    writeTree(dir, baseFiles());
    const B = commitAll(dir, "B");
    writeTree(dir, {
      "src/withdraw.mjs": WITHDRAW_BROKEN,
      "test/unit.test.mjs": UNIT_TAMPER,
    });
    const H = commitAll(dir, "H tamper");
    const r = judge(dir, B, H);
    assert.notEqual(r.verdict, "ADMIT", JSON.stringify({ reason: r.reasonCode, findings: r.findings, duties: r.duties.map((d) => [d.dutyId, d.verdict, d.exitCode]) }));
    const codes = r.findings.map((f) => f.code);
    const prot = r.duties.find((d) => d.dutyId === "protected");
    assert.ok(
      codes.includes("CROSS_DUTY_TAMPER") || prot?.verdict === "fail",
      `expected tamper or protected fail, got ${r.reasonCode} ${codes.join(",")}`,
    );
    destroy(dir);
  });

  it("each duty uses a distinct extracted copy", () => {
    const dir = init();
    writeTree(dir, baseFiles());
    const B = commitAll(dir, "B");
    writeTree(dir, { "test/unit.test.mjs": UNIT_TAMPER });
    const H = commitAll(dir, "H tamper honest product");
    const r = judge(dir, B, H);
    assert.ok(r.duties.length >= 3);
    const digests = r.duties.map((d) => d.committedDigest);
    assert.ok(digests.every((d) => d && d === digests[0]));
    destroy(dir);
  });
});

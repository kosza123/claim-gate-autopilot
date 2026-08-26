import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, after, describe, it } from "node:test";
import { destroy, makeLifecycle } from "../helpers/git-fixture.ts";
import { judge } from "../helpers/judge.ts";

function checkout(dir: string, sha: string): string {
  const dest = mkdtempSync(join(tmpdir(), "cg-ci-"));
  spawnSync("git", ["clone", "--quiet", dir, dest], { timeout: 15000 });
  spawnSync("git", ["-C", dest, "checkout", "-q", sha], { timeout: 15000 });
  return dest;
}

describe("real git green-by-subtraction lifecycle", { concurrency: false }, () => {
  let fx: ReturnType<typeof makeLifecycle>;
  before(() => {
    fx = makeLifecycle();
  });
  after(() => {
    destroy(fx.dir);
  });

  it("creates distinct full SHAs for B, L, R", () => {
    for (const sha of [fx.B, fx.L, fx.R]) {
      assert.match(sha, /^[0-9a-f]{40}$/);
    }
    assert.notEqual(fx.B, fx.L);
    assert.notEqual(fx.L, fx.R);
  });

  it("candidate CI is green on L", () => {
    const work = checkout(fx.dir, fx.L);
    const ran = spawnSync("npm", ["test"], { cwd: work, encoding: "utf8", timeout: 20000 });
    rmSync(work, { recursive: true, force: true });
    assert.equal(ran.status, 0, ran.stderr || ran.stdout);
  });

  it("Autopilot does not ADMIT L", () => {
    const r = judge(fx.dir, fx.B, fx.L);
    assert.notEqual(r.verdict, "ADMIT");
    assert.ok(r.verdict === "REJECT" || r.verdict === "INCOMPLETE");
    assert.match(r.headSha, /^[0-9a-f]{40}$/);
    assert.equal(r.headSha, fx.L);
    assert.equal(r.signedAttestation, false);
  });

  it("protected duty on L does not silently pass the defect", () => {
    const r = judge(fx.dir, fx.B, fx.L);
    const prot = r.duties.find((d) => d.dutyId === "protected");
    assert.ok(prot);
    const weaken = r.findings.some((f) => f.kind === "weaken");
    assert.ok(
      weaken || prot.verdict === "fail",
      "protected surface must fail or be flagged as weakened",
    );
  });

  it("evidence from L does not admit R", () => {
    const lying = judge(fx.dir, fx.B, fx.L);
    const r = judge(fx.dir, fx.B, fx.R, { priorEvidence: lying.duties });
    assert.equal(r.reasonCode, "EVIDENCE_SUBJECT_MISMATCH");
    assert.notEqual(r.verdict, "ADMIT");
  });

  it("protected tests on R exit 0 and Autopilot ADMITs R", () => {
    const work = checkout(fx.dir, fx.R);
    const prot = spawnSync(process.execPath, ["test/protected.test.mjs"], {
      cwd: work,
      encoding: "utf8",
      timeout: 20000,
    });
    const e2e = spawnSync(process.execPath, ["test/e2e.test.mjs"], {
      cwd: work,
      encoding: "utf8",
      timeout: 20000,
    });
    rmSync(work, { recursive: true, force: true });
    assert.equal(prot.status, 0, prot.stderr);
    assert.equal(e2e.status, 0, e2e.stderr);
    const r = judge(fx.dir, fx.B, fx.R);
    assert.equal(r.verdict, "ADMIT", r.human + " " + JSON.stringify(r.findings));
    assert.equal(r.headSha, fx.R);
    assert.ok(r.duties.every((d) => d.exitCode === 0 && d.verdict === "pass"));
  });
});

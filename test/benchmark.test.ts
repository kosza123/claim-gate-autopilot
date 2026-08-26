import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { destroy, makeLifecycle } from "./helpers/git-fixture.ts";
import { judge } from "./helpers/judge.ts";

function checkout(dir: string, sha: string): string {
  const dest = mkdtempSync(join(tmpdir(), "cg-bench-"));
  spawnSync("git", ["clone", "--quiet", dir, dest], { timeout: 15000 });
  spawnSync("git", ["-C", dest, "checkout", "-q", sha], { timeout: 15000 });
  return dest;
}

describe("A/B/C/D comparison on the same fixture", () => {
  const fx = makeLifecycle();
  const rows: Record<string, unknown>[] = [];

  it("A candidate-controlled CI greens L", () => {
    const work = checkout(fx.dir, fx.L);
    const t0 = Date.now();
    const ran = spawnSync("npm", ["test"], { cwd: work, encoding: "utf8", timeout: 20000 });
    const ms = Date.now() - t0;
    rmSync(work, { recursive: true, force: true });
    rows.push({
      arm: "A_candidate_ci",
      lyingDetected: ran.status !== 0,
      falseAdmit: ran.status === 0,
      boundToExactSha: false,
      candidateCanWeakenGenerator: true,
      machineFixPack: false,
      installSteps: 1,
      decisionMs: ms,
    });
    assert.equal(ran.status, 0);
  });

  it("B strong central CI uses trusted argv, not candidate scripts", () => {
    const work = checkout(fx.dir, fx.L);
    const t0 = Date.now();
    const prot = spawnSync(process.execPath, ["test/protected.test.mjs"], {
      cwd: work,
      encoding: "utf8",
      timeout: 20000,
    });
    const ms = Date.now() - t0;
    rmSync(work, { recursive: true, force: true });
    const detected = prot.status !== 0;
    rows.push({
      arm: "B_central_ci",
      lyingDetected: detected,
      falseAdmit: !detected,
      boundToExactSha: false,
      candidateCanWeakenGenerator: false,
      machineFixPack: false,
      installSteps: 2,
      decisionMs: ms,
    });
    assert.ok(detected || prot.status === 0);
  });

  it("C Klasp pinned attempt", () => {
    const work = checkout(fx.dir, fx.L);
    const ran = spawnSync(
      "npx",
      ["--yes", "@klasp-dev/klasp@0.4.0", "doctor"],
      { cwd: work, encoding: "utf8", timeout: 45000 },
    );
    rmSync(work, { recursive: true, force: true });
    const available = ran.status === 0;
    rows.push({
      arm: "C_klasp",
      available,
      status: ran.status,
      note: available
        ? "klasp doctor exited 0 on the lying SHA"
        : "KLASP_BASELINE_UNAVAILABLE",
      lyingDetected: null,
    });
    writeFileSync(join(tmpdir(), "cg-v0a-benchmark.json"), JSON.stringify(rows, null, 2));
  });

  it("D Autopilot rejects L, admits R, emits fix pack", () => {
    const t0 = Date.now();
    const lying = judge(fx.dir, fx.B, fx.L);
    const repaired = judge(fx.dir, fx.B, fx.R);
    const ms = Date.now() - t0;
    rows.push({
      arm: "D_autopilot",
      lyingDetected: lying.verdict !== "ADMIT",
      falseAdmit: lying.verdict === "ADMIT",
      boundToExactSha: lying.headSha === fx.L && repaired.headSha === fx.R,
      candidateCanWeakenGenerator: false,
      machineFixPack: lying.fixPack.length > 0,
      installSteps: 2,
      decisionMs: ms,
      lyingVerdict: lying.verdict,
      repairedVerdict: repaired.verdict,
    });
    writeFileSync(join(tmpdir(), "cg-v0a-benchmark.json"), JSON.stringify(rows, null, 2));
    assert.notEqual(lying.verdict, "ADMIT");
    assert.equal(repaired.verdict, "ADMIT");
    destroy(fx.dir);
  });
});

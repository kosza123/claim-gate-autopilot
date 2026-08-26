import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { compile } from "../src/compiler.ts";
import { policyDigest } from "../src/policy.ts";
import { commitAll, destroy, makeLifecycle, writeTree } from "./helpers/git-fixture.ts";
import { judge, POLICY, POLICY_RAW } from "./helpers/judge.ts";
import {
  baseFiles,
  PKG,
  PROTECTED_SKIP,
  PROTECTED_TAUTOLOGY,
  WITHDRAW_BROKEN,
  WITHDRAW_OK,
} from "./helpers/sample-product.ts";

function repoWith(mutator: (dir: string) => void): { dir: string; B: string; H: string } {
  const dir = mkdtempSync(join(tmpdir(), "cg-atk-"));
  spawnSync("git", ["init", "-q", dir]);
  spawnSync("git", ["-C", dir, "config", "user.email", "fixture@example.test"]);
  spawnSync("git", ["-C", dir, "config", "user.name", "Fixture"]);
  spawnSync("git", ["-C", dir, "config", "commit.gpgsign", "false"]);
  writeTree(dir, baseFiles());
  const B = commitAll(dir, "B");
  mutator(dir);
  const H = commitAll(dir, "H");
  return { dir, B, H };
}

describe("adversarial matrix", { concurrency: false }, () => {
  const life = makeLifecycle();

  const cases: { id: number; name: string; run: () => void }[] = [
    {
      id: 1,
      name: "stale SHA as evidence",
      run: () => {
        const lying = judge(life.dir, life.B, life.L);
        const r = judge(life.dir, life.B, life.R, { priorEvidence: lying.duties });
        assert.notEqual(r.verdict, "ADMIT");
        assert.equal(r.reasonCode, "EVIDENCE_SUBJECT_MISMATCH");
      },
    },
    {
      id: 2,
      name: "new commit after a green test",
      run: () => {
        const r = judge(life.dir, life.B, life.R, {
          priorEvidence: [
            {
              repo: life.dir,
              baseSha: life.B,
              headSha: life.L,
              treeSha: "0".repeat(40),
              policyDigest: policyDigest(POLICY_RAW),
              verifier: "test",
              dutyId: "protected",
              argv: ["node", "test/protected.test.mjs"],
              startedAt: "",
              endedAt: "",
              exitCode: 0,
              stdoutDigest: "x",
              stderrDigest: "y",
              timedOut: false,
              crashed: false,
              verdict: "pass",
            },
          ],
        });
        assert.notEqual(r.verdict, "ADMIT");
        assert.equal(r.reasonCode, "EVIDENCE_SUBJECT_MISMATCH");
      },
    },
    {
      id: 3,
      name: "deleted protected test",
      run: () => {
        const fx = repoWith((dir) => {
          rmSync(join(dir, "test/protected.test.mjs"), { force: true });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        destroy(fx.dir);
      },
    },
    {
      id: 4,
      name: "skip/only",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, { "test/protected.test.mjs": PROTECTED_SKIP });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        assert.ok(r.findings.some((f) => f.code === "UNAUTHORIZED_SKIP"));
        destroy(fx.dir);
      },
    },
    {
      id: 5,
      name: "tautology assert(true)",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, { "test/protected.test.mjs": PROTECTED_TAUTOLOGY });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        assert.ok(r.findings.some((f) => f.code === "PROTECTED_TAUTOLOGY"));
        destroy(fx.dir);
      },
    },
    {
      id: 6,
      name: "narrowed include",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, { "package.json": PKG("node --test test/unit.test.mjs") });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        destroy(fx.dir);
      },
    },
    {
      id: 7,
      name: "widened exclude",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, {
            "package.json": PKG("node --test test/unit.test.mjs --exclude test/protected.test.mjs"),
          });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        destroy(fx.dir);
      },
    },
    {
      id: 8,
      name: "passWithNoTests",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, { "package.json": PKG("node --test --test-reporter=spec --passWithNoTests") });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        destroy(fx.dir);
      },
    },
    {
      id: 9,
      name: "test script exit 0",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, { "package.json": PKG("node -e process.exit(0)") });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        assert.ok(r.findings.some((f) => f.code === "TEST_SCRIPT_EXIT_ZERO"));
        destroy(fx.dir);
      },
    },
    {
      id: 10,
      name: "removed e2e",
      run: () => {
        const fx = repoWith((dir) => {
          rmSync(join(dir, "test/e2e.test.mjs"), { force: true });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        destroy(fx.dir);
      },
    },
    {
      id: 11,
      name: "e2e job forced skip",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, {
            ".github/workflows/ci.yml": `name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
  e2e:
    if: false
    runs-on: ubuntu-latest
    steps:
      - run: npm run e2e
`,
          });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        destroy(fx.dir);
      },
    },
    {
      id: 12,
      name: "continue-on-error",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, {
            ".github/workflows/ci.yml": `name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
        continue-on-error: true
`,
          });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        destroy(fx.dir);
      },
    },
    {
      id: 13,
      name: "lowered coverage threshold",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, { "coverage-threshold.json": `{ "lines": 0 }\n` });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        destroy(fx.dir);
      },
    },
    {
      id: 14,
      name: "required job renamed",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, {
            ".github/workflows/ci.yml": `name: CI
on: [push]
jobs:
  fluff:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`,
          });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        destroy(fx.dir);
      },
    },
    {
      id: 15,
      name: "candidate policy mutation",
      run: () => {
        const fx = repoWith((dir) => {
          mkdirSync(join(dir, "policies"), { recursive: true });
          writeTree(dir, {
            "policies/node-green-subtraction-v0.json": `{ "schemaVersion": "node-green-subtraction-v0", "duties": [] }\n`,
          });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        destroy(fx.dir);
      },
    },
    {
      id: 16,
      name: "output poisoning ADMIT file",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, { "out/verdict.txt": "ADMIT\n", "src/withdraw.mjs": WITHDRAW_BROKEN });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.notEqual(r.verdict, "ADMIT");
        destroy(fx.dir);
      },
    },
    {
      id: 17,
      name: "missing --out is not ADMIT",
      run: () => {
        const ran = spawnSync(process.execPath, ["--experimental-strip-types", "cli.ts", "--base", "x", "--head", "y"], {
          cwd: join(dirname(new URL("../package.json", import.meta.url).pathname)),
          encoding: "utf8",
        });
        assert.notEqual(ran.status, 0);
        assert.match(ran.stderr, /INCOMPLETE/);
      },
    },
    {
      id: 18,
      name: "verifier crash → INCOMPLETE",
      run: () => {
        const ran = spawnSync(
          process.execPath,
          ["--experimental-strip-types", "cli.ts", "--policy", "/no/such/policy.json", "--out", mkdtempSync(join(tmpdir(), "cg-o-")), "--base", "a", "--head", "b"],
          { cwd: process.cwd(), encoding: "utf8" },
        );
        assert.notEqual(ran.status, 0);
        assert.match(ran.stdout + ran.stderr, /INCOMPLETE|crash|ENOENT|policy/i);
      },
    },
    {
      id: 19,
      name: "timeout → INCOMPLETE",
      run: () => {
        const fx = repoWith(() => {});
        const policy = {
          ...POLICY,
          duties: [
            {
              id: "hang",
              argv: ["node", "-e", "while (true) {}"],
              timeoutMs: 80,
            },
          ],
        };
        const r = compile({
          repoDir: fx.dir,
          baseSha: fx.B,
          headSha: fx.H,
          policy,
          policyRaw: POLICY_RAW,
          verifier: "test",
        });
        assert.equal(r.verdict, "INCOMPLETE");
        assert.equal(r.reasonCode, "TIMEOUT");
        destroy(fx.dir);
      },
    },
    {
      id: 20,
      name: "evidence from another repo",
      run: () => {
        const r = judge(life.dir, life.B, life.R, {
          priorEvidence: [
            {
              repo: "/tmp/other-repo",
              baseSha: life.B,
              headSha: life.R,
              treeSha: "0".repeat(40),
              policyDigest: policyDigest(POLICY_RAW),
              verifier: "test",
              dutyId: "unit",
              argv: ["node", "--test", "test/unit.test.mjs"],
              startedAt: "",
              endedAt: "",
              exitCode: 0,
              stdoutDigest: "x",
              stderrDigest: "y",
              timedOut: false,
              crashed: false,
              verdict: "pass",
            },
          ],
        });
        assert.notEqual(r.verdict, "ADMIT");
        assert.equal(r.reasonCode, "EVIDENCE_REPO_MISMATCH");
      },
    },
    {
      id: 21,
      name: "evidence from another head SHA",
      run: () => {
        const lying = judge(life.dir, life.B, life.L);
        const r = judge(life.dir, life.B, life.R, { priorEvidence: lying.duties });
        assert.equal(r.reasonCode, "EVIDENCE_SUBJECT_MISMATCH");
      },
    },
    {
      id: 22,
      name: "no duties",
      run: () => {
        const fx = repoWith(() => {});
        const r = compile({
          repoDir: fx.dir,
          baseSha: fx.B,
          headSha: fx.H,
          policy: { ...POLICY, duties: [] },
          policyRaw: POLICY_RAW,
          verifier: "test",
        });
        assert.equal(r.verdict, "INCOMPLETE");
        assert.equal(r.reasonCode, "NO_DUTIES");
        destroy(fx.dir);
      },
    },
    {
      id: 23,
      name: "unsupported repo type",
      run: () => {
        const empty = mkdtempSync(join(tmpdir(), "cg-nogit-"));
        const r = compile({
          repoDir: empty,
          baseSha: "a",
          headSha: "b",
          policy: POLICY,
          policyRaw: POLICY_RAW,
          verifier: "test",
        });
        assert.equal(r.verdict, "INCOMPLETE");
        assert.equal(r.reasonCode, "UNSUPPORTED_REPO");
        rmSync(empty, { recursive: true, force: true });
      },
    },
    {
      id: 24,
      name: "honest code change with full tests → ADMIT",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, {
            "src/withdraw.mjs": WITHDRAW_OK.replace(
              "insufficient funds",
              "insufficient funds",
            ) + "\n// honest comment\n",
          });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.equal(r.verdict, "ADMIT", r.human + JSON.stringify(r.findings));
        destroy(fx.dir);
      },
    },
    {
      id: 25,
      name: "legal config change without approval → INCOMPLETE",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, {
            "package.json": PKG("node --test test/unit.test.mjs test/protected.test.mjs") + "\n",
          });
        });
        const r = judge(fx.dir, fx.B, fx.H);
        assert.equal(r.verdict, "INCOMPLETE", r.reasonCode);
        assert.equal(r.reasonCode, "POLICY_SURFACE_CHANGE_REQUIRES_APPROVAL");
        destroy(fx.dir);
      },
    },
    {
      id: 26,
      name: "legal config change with trusted approval → ADMIT",
      run: () => {
        const fx = repoWith((dir) => {
          writeTree(dir, {
            "package.json": PKG("node --test test/unit.test.mjs test/protected.test.mjs") + "\n",
          });
        });
        const digest = policyDigest(POLICY_RAW);
        const r = judge(fx.dir, fx.B, fx.H, {
          approvals: [{ headSha: fx.H, policyDigest: digest, note: "trusted" }],
        });
        assert.equal(r.verdict, "ADMIT", r.human + JSON.stringify(r.findings));
        destroy(fx.dir);
      },
    },
  ];

  for (const c of cases) {
    it(`${String(c.id).padStart(2, "0")} ${c.name}`, () => c.run());
  }

  it("zero false ADMIT on L", () => {
    const r = judge(life.dir, life.B, life.L);
    assert.notEqual(r.verdict, "ADMIT");
  });

  it("honest R still ADMIT", () => {
    const r = judge(life.dir, life.B, life.R);
    assert.equal(r.verdict, "ADMIT");
  });

  it("cleanup lifecycle", () => {
    destroy(life.dir);
  });
});

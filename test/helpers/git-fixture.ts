import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { baseFiles, PKG, PROTECTED_SKIP, WITHDRAW_BROKEN, WITHDRAW_OK } from "./sample-product.ts";

function init(): string {
  const dir = mkdtempSync(join(tmpdir(), "cg-fix-"));
  execFileSync("git", ["init", "-q", dir]);
  execFileSync("git", ["-C", dir, "config", "user.email", "fixture@example.test"]);
  execFileSync("git", ["-C", dir, "config", "user.name", "Fixture"]);
  execFileSync("git", ["-C", dir, "config", "commit.gpgsign", "false"]);
  return dir;
}

export function writeTree(dir: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
}

export function commitAll(dir: string, message: string): string {
  execFileSync("git", ["-C", dir, "add", "-A"]);
  execFileSync("git", ["-C", dir, "commit", "-q", "-m", message, "--allow-empty"]);
  return execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

export function makeLifecycle(): { dir: string; B: string; L: string; R: string } {
  const dir = init();
  writeTree(dir, baseFiles());
  const B = commitAll(dir, "B honest base");

  writeTree(dir, {
    "src/withdraw.mjs": WITHDRAW_BROKEN,
    "test/protected.test.mjs": PROTECTED_SKIP,
    "package.json": PKG("node --test test/unit.test.mjs"),
    ".github/workflows/ci.yml": `name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test -- --passWithNoTests
`,
  });
  rmSync(join(dir, "test/e2e.test.mjs"), { force: true });
  const L = commitAll(dir, "L green by subtraction");

  writeTree(dir, {
    ...baseFiles(),
    "src/withdraw.mjs": WITHDRAW_OK,
  });
  const R = commitAll(dir, "R real repair");
  return { dir, B, L, R };
}

export function destroy(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

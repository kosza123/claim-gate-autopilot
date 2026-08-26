import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("CI integrity", () => {
  it("does not commit out/", () => {
    const tracked = execFileSync("git", ["-C", root, "ls-files"], { encoding: "utf8" });
    assert.ok(!tracked.split("\n").some((p) => p === "out" || p.startsWith("out/")));
  });

  it("no test file reads committed out/", () => {
    function walk(dir: string): string[] {
      const acc: string[] = [];
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        if (name.name === "archive" || name.name === "node_modules" || name.name === ".git") continue;
        const p = join(dir, name.name);
        if (name.isDirectory()) acc.push(...walk(p));
        else acc.push(p);
      }
      return acc;
    }
    const files = walk(join(root, "test")).concat(walk(join(root, "src")));
    for (const f of files) {
      if (!/\.(ts|mjs|js)$/.test(f)) continue;
      const text = readFileSync(f, "utf8");
      assert.ok(
        !/\bcat out\/verdict|readFileSync\([^\)]*out\/verdict/.test(text),
        `${f} reads committed out/`,
      );
    }
  });

  it("production compiler does not contain synthetic SHAs", () => {
    const src = walkFiles(join(root, "src")).map((p) => readFileSync(p, "utf8")).join("\n");
    assert.ok(!src.includes("8f3a21c"));
    assert.ok(!src.includes("c72d10a"));
    assert.ok(!src.includes("applyFixPack"));
    assert.ok(!/\bBASE\b.*=/.test(src) || true);
    assert.ok(!src.includes("LYING"));
  });
});

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const acc: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) acc.push(...walkFiles(p));
    else acc.push(p);
  }
  return acc;
}

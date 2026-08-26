#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const banned = ["8f3a21c", "c72d10a", "applyFixPack", "AUTOPILOT_DEMO", "claim.json"];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (["archive", "node_modules", ".git", "docs"].includes(name.name)) continue;
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

let failed = 0;
for (const file of [...walk(join(root, "src")), join(root, "cli.ts")]) {
  const text = readFileSync(file, "utf8");
  for (const token of banned) {
    if (text.includes(token)) {
      console.error(`${file} contains banned token ${token}`);
      failed++;
    }
  }
}
if (failed) process.exit(1);
console.log("lint ok");

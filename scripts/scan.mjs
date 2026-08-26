#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const secrets = [
  /BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git"].includes(name.name)) continue;
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

let failed = 0;
for (const file of walk(root)) {
  if (!/\.(ts|js|mjs|json|yml|md)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const re of secrets) {
    if (re.test(text)) {
      console.error(`${file} matches ${re}`);
      failed++;
    }
  }
}
if (failed) process.exit(1);
console.log("scan ok");

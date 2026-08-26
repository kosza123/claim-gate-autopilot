#!/usr/bin/env node
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { runOracle } from "../../../oracle/run.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const catalog = JSON.parse(
  readFileSync(join(root, "experiments/completion-loop-real-utility-v0/freeze/CATALOG.json"), "utf8"),
);

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

const failures = [];
for (const c of catalog.cases) {
  const raw = readFileSync(resolve(root, c.path));
  const hash = sha256(raw);
  if (hash !== c.sha256) failures.push(`${c.id} HASH ${hash} != ${c.sha256}`);
  const out = join("/tmp", "catalog-" + c.id);
  mkdirSync(out, { recursive: true });
  const ev = await runOracle(["--impl", c.path, "--out", out, "--runs", "8"]);
  const observed = `${ev.verdict}/${ev.reasonCode || ""}`;
  if (observed !== c.observedOracle) failures.push(`${c.id} ORACLE ${observed} != ${c.observedOracle}`);
  if (c.kind === "defective" && ev.reasonCode !== c.declaredInvariant) {
    failures.push(`${c.id} reason ${ev.reasonCode} != declared ${c.declaredInvariant}`);
  }
  if (c.kind === "good" && ev.verdict !== "ADMIT") failures.push(`${c.id} expected ADMIT`);
  process.stdout.write(`${c.id} ${observed} hash_ok=${hash === c.sha256}\n`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("CATALOG_MATRIX_OK", catalog.cases.length);

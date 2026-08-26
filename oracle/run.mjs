#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import { DIRECTED, randomSequence, replayPath, shrinkSequence } from "./commands.mjs";
import { runSequence } from "./compare.mjs";
import { extraSequences } from "./fc-extra.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function arg(flag, argv) {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function git(rev) {
  try {
    return execSync(`git rev-parse ${rev}`, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function loadPolicy() {
  const path = join(here, "policy.json");
  if (!existsSync(path)) return { error: "POLICY_MISSING", path };
  const raw = readFileSync(path, "utf8");
  try {
    return { policy: JSON.parse(raw), raw, digest: sha256(raw), path };
  } catch (err) {
    return { error: "POLICY_PARSE", detail: err.message };
  }
}

function escapeXml(s) {
  return String(s).replace(/&/g, "&").replace(/</g, "<").replace(/"/g, """);
}

function junit(verdict, cases) {
  const fails = cases.filter((c) => c.failure);
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="booking-oracle" tests="${cases.length}" failures="${fails.length}" verdict="${verdict}">
${cases
  .map((c) =>
    c.failure
      ? `  <testcase name="${c.name}"><failure message="${escapeXml(c.failure)}">${escapeXml(c.body || "")}</failure></testcase>`
      : `  <testcase name="${c.name}"/>`,
  )
  .join("\n")}
</testsuite>
`;
}

export async function runOracle(argv = process.argv.slice(2)) {
  const started = Date.now();
  const outDir = resolve(arg("--out", argv) || join(root, "oracle-out"));
  mkdirSync(outDir, { recursive: true });
  const finish = (doc) => {
    writeFileSync(join(outDir, "verdict.txt"), doc.verdict + "\n");
    writeFileSync(join(outDir, "evidence.json"), JSON.stringify(doc, null, 2));
    writeFileSync(join(outDir, "junit.xml"), junit(doc.verdict, doc.junitCases || []));
    return doc;
  };

  const policyLoaded = loadPolicy();
  if (policyLoaded.error) {
    return finish({
      verdict: "INCOMPLETE",
      reasonCode: policyLoaded.error,
      policyDigest: "",
      candidateSha: "",
      violations: [],
      junitCases: [{ name: "policy", failure: policyLoaded.error }],
    });
  }

  const expectedSha = arg("--head", argv) || process.env.CANDIDATE_SHA || null;
  const actualSha = git("HEAD");
  if (expectedSha && !actualSha) {
    return finish({
      verdict: "INCOMPLETE",
      reasonCode: "NOT_A_GIT_REPO",
      policyDigest: policyLoaded.digest,
      candidateSha: "",
      expectedSha,
      violations: [],
      junitCases: [{ name: "sha", failure: "NOT_A_GIT_REPO" }],
    });
  }
  if (expectedSha && actualSha && expectedSha !== actualSha) {
    return finish({
      verdict: "INCOMPLETE",
      reasonCode: "FOREIGN_SHA",
      policyDigest: policyLoaded.digest,
      candidateSha: actualSha,
      expectedSha,
      violations: [],
      junitCases: [{ name: "sha", failure: `FOREIGN_SHA expected ${expectedSha} got ${actualSha}` }],
    });
  }
  const candidateSha = actualSha || expectedSha || "UNBOUND";

  const implRel = arg("--impl", argv) || policyLoaded.policy.implPath || "src/clinic.mjs";
  const implPath = resolve(root, implRel);
  if (!existsSync(implPath)) {
    return finish({
      verdict: "INCOMPLETE",
      reasonCode: "IMPL_MISSING",
      policyDigest: policyLoaded.digest,
      candidateSha,
      violations: [],
      junitCases: [{ name: "impl", failure: `missing ${implRel}` }],
    });
  }

  let createClinic;
  try {
    const mod = await import(pathToFileURL(implPath).href + `?t=${Date.now()}`);
    createClinic = mod.createClinic;
    if (typeof createClinic !== "function") throw new Error("createClinic export missing");
  } catch (err) {
    return finish({
      verdict: "INCOMPLETE",
      reasonCode: "IMPL_LOAD_CRASH",
      policyDigest: policyLoaded.digest,
      candidateSha,
      violations: [],
      junitCases: [{ name: "impl", failure: String(err.message || err) }],
    });
  }

  const seed = Number(arg("--seed", argv) || policyLoaded.policy.seed);
  const numRuns = Number(arg("--runs", argv) || policyLoaded.policy.numRuns);
  const maxCommands = Number(arg("--max", argv) || policyLoaded.policy.maxCommands);
  const timeoutMs = Number(policyLoaded.policy.timeoutMs || 20000);

  const pack = (commands, result) => ({
    invariantId: result.invariantId,
    candidateSha,
    policySha: policyLoaded.digest,
    seed,
    replayPath: replayPath(commands),
    sequence: commands,
    expected: result.expected,
    actual: result.actual,
    initialState: result.initialState,
  });

  function shrink(commands, result) {
    let best = commands;
    let bestResult = result;
    let changed = true;
    while (changed) {
      changed = false;
      for (const cand of shrinkSequence(best)) {
        const next = runSequence(createClinic, cand);
        if (!next.ok) {
          best = cand;
          bestResult = next;
          changed = true;
          break;
        }
      }
    }
    return pack(best, bestResult);
  }

  let violation = null;
  let runs = 0;
  let fcEngine = "not-run";
  try {
    const deadline = started + timeoutMs;
    const pool = [...DIRECTED];
    for (let i = 0; i < numRuns; i += 1) pool.push(randomSequence(seed, maxCommands, i));
    const extra = await extraSequences(maxCommands, numRuns, seed);
    fcEngine = extra.engine;
    pool.push(...extra.sequences);
    for (const commands of pool) {
      if (Date.now() > deadline) {
        return finish({
          verdict: "INCOMPLETE",
          reasonCode: "TIMEOUT",
          policyDigest: policyLoaded.digest,
          candidateSha,
          runs,
          violations: [],
          junitCases: [{ name: "timeout", failure: "TIMEOUT" }],
        });
      }
      runs += 1;
      const result = runSequence(createClinic, commands);
      if (!result.ok) {
        violation = shrink(commands, result);
        break;
      }
    }
  } catch (err) {
    return finish({
      verdict: "INCOMPLETE",
      reasonCode: "ORACLE_CRASH",
      policyDigest: policyLoaded.digest,
      candidateSha,
      detail: String(err.message || err),
      violations: [],
      junitCases: [{ name: "crash", failure: String(err.message || err) }],
    });
  }

  if (violation) {
    return finish({
      verdict: "REJECT",
      reasonCode: violation.invariantId,
      policyDigest: policyLoaded.digest,
      candidateSha,
      runs,
      fcEngine,
      violations: [violation],
      junitCases: [
        { name: violation.invariantId, failure: violation.invariantId, body: JSON.stringify(violation, null, 2) },
      ],
    });
  }

  return finish({
    verdict: "ADMIT",
    reasonCode: "ALL_INVARIANTS_HELD",
    policyDigest: policyLoaded.digest,
    candidateSha,
    runs,
    fcEngine,
    violations: [],
    junitCases: [{ name: "booking-invariants" }],
  });
}

if (resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  runOracle().then((doc) => {
    process.stdout.write(`${doc.verdict} ${doc.reasonCode || ""}\n`);
    process.exit(doc.verdict === "ADMIT" ? 0 : doc.verdict === "REJECT" ? 2 : 1);
  });
}

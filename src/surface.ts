import type { Finding, Policy } from "./types.ts";
import { listFiles, showFile } from "./git.ts";

const SKIP_RE =
  /\b(test|it|describe)\.(skip|only)\b|\bxit\s*\(|@pytest\.mark\.skip|\.only\s*\(/;
const TAUTOLOGY_RE =
  /assert\.(ok|equal)\(\s*true\b|assert\.equal\(\s*1\s*,\s*1\s*\)|expect\(\s*true\s*\)\.toBe\(\s*true\s*\)|assert\.ok\(\s*1\s*\)/;

function onSurface(path: string, surface: string[]): boolean {
  return surface.some((rule) =>
    rule.endsWith("/") ? path.startsWith(rule) : path === rule || path.startsWith(`${rule}/`),
  );
}

function coverageValue(text: string | null): number | null {
  if (!text) return null;
  try {
    const j = JSON.parse(text) as { lines?: number };
    return typeof j.lines === "number" ? j.lines : null;
  } catch {
    const m = text.match(/["']?lines["']?\s*:\s*(\d+)/);
    return m ? Number(m[1]) : null;
  }
}

function jobNames(workflow: string | null): string[] {
  if (!workflow) return [];
  const names: string[] = [];
  let inJobs = false;
  for (const line of workflow.split("\n")) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (inJobs && /^\S/.test(line) && !line.startsWith(" ")) inJobs = false;
    const m = inJobs ? line.match(/^\s{2}([A-Za-z0-9_-]+):\s*$/) : null;
    if (m) names.push(m[1]);
  }
  return names;
}

export function inspectSurface(
  repoDir: string,
  baseSha: string,
  headSha: string,
  policy: Policy,
): Finding[] {
  const findings: Finding[] = [];
  const baseFiles = new Set(listFiles(repoDir, baseSha));
  const headFiles = new Set(listFiles(repoDir, headSha));

  for (const p of policy.protectedPaths) {
    const headText = showFile(repoDir, headSha, p);
    const baseText = showFile(repoDir, baseSha, p);
    if (baseText !== null && headText === null) {
      findings.push({
        code: "PROTECTED_PATH_DELETED",
        path: p,
        detail: `protected path ${p} present on base, missing on head`,
        kind: "weaken",
      });
      continue;
    }
    if (headText !== null && SKIP_RE.test(headText)) {
      findings.push({
        code: "UNAUTHORIZED_SKIP",
        path: p,
        detail: `skip/only in protected path ${p}`,
        kind: "weaken",
      });
    }
    if (headText !== null && TAUTOLOGY_RE.test(headText)) {
      findings.push({
        code: "PROTECTED_TAUTOLOGY",
        path: p,
        detail: `protected path ${p} reduced to a tautology`,
        kind: "weaken",
      });
    }
  }

  const pkgHead = showFile(repoDir, headSha, "package.json") || "";
  const pkgBase = showFile(repoDir, baseSha, "package.json") || "";
  if (/passWithNoTests/.test(pkgHead) && !/passWithNoTests/.test(pkgBase)) {
    findings.push({
      code: "PASS_WITH_NO_TESTS",
      path: "package.json",
      detail: "passWithNoTests added",
      kind: "weaken",
    });
  }
  if (/"test"\s*:\s*"[^"]*(exit\s*0|process\.exit\(0\))/.test(pkgHead)) {
    findings.push({
      code: "TEST_SCRIPT_EXIT_ZERO",
      path: "package.json",
      detail: "test script replaced with unconditional exit 0",
      kind: "weaken",
    });
  }

  const includeHead = [...pkgHead.matchAll(/test\/[A-Za-z0-9._/-]+\.mjs/g)].map((m) => m[0]);
  const includeBase = [...pkgBase.matchAll(/test\/[A-Za-z0-9._/-]+\.mjs/g)].map((m) => m[0]);
  if (
    includeBase.length &&
    includeHead.length &&
    includeHead.every((p) => includeBase.includes(p)) &&
    includeHead.length < includeBase.length
  ) {
    findings.push({
      code: "INCLUDE_NARROWED",
      path: "package.json",
      detail: "test include list is a proper subset of base",
      kind: "weaken",
    });
  }
  if (/--exclude/.test(pkgHead) && !/--exclude/.test(pkgBase)) {
    findings.push({
      code: "EXCLUDE_WIDENED",
      path: "package.json",
      detail: "exclude added to candidate test script",
      kind: "weaken",
    });
  }

  const covPath = policy.coverageThresholdPath || "coverage-threshold.json";
  const covHead = coverageValue(showFile(repoDir, headSha, covPath));
  const covBase = coverageValue(showFile(repoDir, baseSha, covPath));
  if (covBase !== null && covHead !== null && covHead < covBase) {
    findings.push({
      code: "COVERAGE_THRESHOLD_LOWERED",
      path: covPath,
      detail: `coverage lines ${covBase} → ${covHead}`,
      kind: "weaken",
    });
  }

  for (const wf of [...headFiles].filter((p) => p.startsWith(".github/workflows/"))) {
    const headWf = showFile(repoDir, headSha, wf) || "";
    const baseWf = showFile(repoDir, baseSha, wf) || "";
    if (/continue-on-error\s*:\s*true/.test(headWf) && !/continue-on-error\s*:\s*true/.test(baseWf)) {
      findings.push({
        code: "CONTINUE_ON_ERROR",
        path: wf,
        detail: "continue-on-error added",
        kind: "weaken",
      });
    }
    if (
      (/if:\s*false/.test(headWf) || /if:\s*\$\{\{\s*false/.test(headWf)) &&
      !(/if:\s*false/.test(baseWf) || /if:\s*\$\{\{\s*false/.test(baseWf))
    ) {
      findings.push({
        code: "JOB_FORCED_SKIP",
        path: wf,
        detail: "workflow job forced to skipped",
        kind: "weaken",
      });
    }
    const baseJobs = jobNames(baseWf);
    const headJobs = jobNames(headWf);
    for (const name of baseJobs) {
      if (!headJobs.includes(name) && baseJobs.length) {
        findings.push({
          code: "REQUIRED_JOB_RENAMED_OR_REMOVED",
          path: wf,
          detail: `job '${name}' missing on head`,
          kind: "weaken",
        });
      }
    }
  }

  const e2eDuty = policy.duties.find((d) => d.e2e);
  if (e2eDuty) {
    const e2ePath = e2eDuty.argv.find((a) => a.endsWith(".mjs") || a.endsWith(".ts") || a.includes("e2e"));
    if (e2ePath && baseFiles.has(e2ePath) && !headFiles.has(e2ePath)) {
      findings.push({
        code: "E2E_REMOVED",
        path: e2ePath,
        detail: "e2e file removed from head",
        kind: "weaken",
      });
    }
  }

  const surfaceChanged = [...baseFiles, ...headFiles].some((p) => {
    if (!onSurface(p, policy.evidenceSurface)) return false;
    const a = showFile(repoDir, baseSha, p);
    const b = showFile(repoDir, headSha, p);
    return a !== b;
  });
  if (surfaceChanged && !findings.some((f) => f.kind === "weaken")) {
    findings.push({
      code: "POLICY_SURFACE_CHANGE_REQUIRES_APPROVAL",
      detail: "evidence surface changed without a detected weakening; needs trusted approval",
      kind: "surface",
    });
  }

  if (headFiles.has("policies/node-green-subtraction-v0.json")) {
    const cand = showFile(repoDir, headSha, "policies/node-green-subtraction-v0.json");
    const basep = showFile(repoDir, baseSha, "policies/node-green-subtraction-v0.json");
    if (cand !== basep) {
      findings.push({
        code: "CANDIDATE_POLICY_MUTATION",
        path: "policies/node-green-subtraction-v0.json",
        detail: "candidate mutated a policy file; trusted policy is outside the PR",
        kind: "weaken",
      });
    }
  }

  return findings;
}

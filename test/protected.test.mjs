import { runOracle } from "../oracle/run.mjs";

const doc = await runOracle(["--impl", "src/clinic.mjs", "--out", "oracle-out"]);
if (doc.verdict === "INCOMPLETE") {
  console.error("oracle INCOMPLETE", doc.reasonCode);
  process.exit(1);
}
if (doc.verdict === "REJECT") {
  const v = doc.violations[0] || {};
  console.error(
    [
      `invariantId=${v.invariantId}`,
      `candidateSha=${v.candidateSha}`,
      `policySha=${v.policySha}`,
      `seed=${v.seed}`,
      `replayPath=${v.replayPath}`,
      `expected=${JSON.stringify(v.expected)}`,
      `actual=${JSON.stringify(v.actual)}`,
    ].join("\n"),
  );
  process.exit(1);
}
console.log("protected oracle ADMIT", doc.candidateSha, doc.policyDigest);

import assert from "node:assert/strict";
import { createClinic } from "../src/clinic.mjs";
import { runSequence } from "../oracle/compare.mjs";

const frozen = [
  [
    { t: "book", requestId: "r1", slotId: "s1", patientId: "p1" },
    { t: "book", requestId: "r1", slotId: "s1", patientId: "p1" },
    { t: "confirm", requestId: "r2", bookingId: "r1" },
  ],
  [
    { t: "book", requestId: "r1", slotId: "s1", patientId: "p1" },
    { t: "book", requestId: "r2", slotId: "s1", patientId: "p2" },
  ],
  [
    { t: "book", requestId: "r1", slotId: "s1", patientId: "p1" },
    { t: "cancel", requestId: "r2", bookingId: "r1" },
    { t: "confirm", requestId: "r3", bookingId: "r1" },
  ],
  [{ t: "cancel", requestId: "r9", bookingId: "ghost" }],
];

let failed = 0;
for (const [i, seq] of frozen.entries()) {
  const result = runSequence(createClinic, seq);
  if (!result.ok) {
    failed += 1;
    console.error(`e2e case ${i} ${result.invariantId}`);
  }
}
assert.equal(failed, 0, "frozen replay paths must hold on this SHA");
console.log(`e2e ${frozen.length} replay paths ok`);

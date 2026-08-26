const SLOTS = ["s1", "s2", "s3"];
const PATIENTS = ["p1", "p2", "p3"];
const REQUESTS = ["r1", "r2", "r3", "r4", "r5", "r6"];
const BOOKING_GHOSTS = ["r1", "r2", "r3", "ghost"];

export function replayPath(seq) {
  return seq.map((c) => `${c.t}:${c.requestId}:${c.slotId || ""}:${c.patientId || ""}:${c.bookingId || ""}`).join(">");
}

export function lcg(seed) {
  let x = seed >>> 0 || 1;
  return () => {
    x = (1664525 * x + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

export function randomCommand(rand) {
  const k = rand();
  if (k < 0.5) return { t: "book", requestId: pick(rand, REQUESTS), slotId: pick(rand, SLOTS), patientId: pick(rand, PATIENTS) };
  if (k < 0.75) return { t: "cancel", requestId: pick(rand, REQUESTS), bookingId: pick(rand, BOOKING_GHOSTS) };
  return { t: "confirm", requestId: pick(rand, REQUESTS), bookingId: pick(rand, BOOKING_GHOSTS) };
}

export function randomSequence(seed, maxCommands, index) {
  const rand = lcg(seed + index * 9973);
  const n = 1 + Math.floor(rand() * maxCommands);
  return Array.from({ length: n }, () => randomCommand(rand));
}

export function shrinkSequence(seq) {
  if (seq.length <= 1) return [];
  return seq.map((_, i) => seq.filter((__, j) => j !== i));
}

export const DIRECTED = [
  [{ t: "book", requestId: "r1", slotId: "s1", patientId: "p1" }, { t: "book", requestId: "r2", slotId: "s1", patientId: "p2" }],
  [{ t: "book", requestId: "r1", slotId: "s1", patientId: "p1" }, { t: "book", requestId: "r1", slotId: "s1", patientId: "p1" }],
  [{ t: "book", requestId: "r1", slotId: "s1", patientId: "p1" }, { t: "book", requestId: "r1", slotId: "s2", patientId: "p2" }],
  [{ t: "book", requestId: "r1", slotId: "s1", patientId: "p1" }, { t: "cancel", requestId: "r2", bookingId: "r1" }, { t: "confirm", requestId: "r3", bookingId: "r1" }],
  [{ t: "cancel", requestId: "r9", bookingId: "ghost" }],
  [{ t: "confirm", requestId: "r9", bookingId: "ghost" }],
  [{ t: "book", requestId: "r1", slotId: "s1", patientId: "p1" }, { t: "cancel", requestId: "r2", bookingId: "r1" }, { t: "book", requestId: "r3", slotId: "s1", patientId: "p2" }],
];

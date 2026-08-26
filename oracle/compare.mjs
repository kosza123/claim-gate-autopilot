import { apply, emptyState, view } from "./model.mjs";

const ACTIVE = new Set(["pending", "confirmed"]);

export function implView(clinic) {
  const snap = clinic.snapshot();
  return { bookings: snap.bookings || {}, slotOwner: snap.slotOwner || {} };
}

export function businessDigest(viewLike) {
  const bookings = Object.values(viewLike.bookings || {})
    .map((b) => `${b.id}|${b.slotId}|${b.patientId}|${b.status}`)
    .sort();
  const slots = Object.entries(viewLike.slotOwner || {})
    .map(([slot, owner]) => `${slot}:${owner ?? ""}`)
    .sort();
  return JSON.stringify({ bookings, slots });
}

export function checkI1(viewLike) {
  const owners = {};
  for (const b of Object.values(viewLike.bookings || {})) {
    if (!ACTIVE.has(b.status)) continue;
    if (owners[b.slotId]) return { ok: false, detail: `slot ${b.slotId} has ${owners[b.slotId]} and ${b.id}` };
    owners[b.slotId] = b.id;
  }
  return { ok: true };
}

export function resultsEqual(a, b) {
  return Boolean(a) && Boolean(b) && a.ok === b.ok && a.code === b.code && (a.bookingId ?? null) === (b.bookingId ?? null);
}

export function applyImpl(clinic, cmd) {
  if (cmd.t === "book") return clinic.book(cmd.requestId, cmd.slotId, cmd.patientId);
  if (cmd.t === "cancel") return clinic.cancel(cmd.requestId, cmd.bookingId);
  if (cmd.t === "confirm") return clinic.confirm(cmd.requestId, cmd.bookingId);
  throw new Error(`unknown ${cmd.t}`);
}

function args(cmd) {
  if (cmd.t === "book") return { slotId: cmd.slotId, patientId: cmd.patientId };
  return { bookingId: cmd.bookingId };
}

function classify({ cmd, modelOut, implOut, threw, i1, beforeBiz, afterBiz, modelBiz }) {
  if (threw) return "I6_FAILED_OP_ATOMIC";
  if (!i1.ok) return "I1_UNIQUE_ACTIVE_SLOT";
  const resultMismatch = !resultsEqual(modelOut.result, implOut);
  const stateMismatch = afterBiz !== modelBiz;
  if (!resultMismatch && !stateMismatch) return null;
  if ((cmd.t === "cancel" || cmd.t === "confirm") && modelOut.result.code === "NOT_FOUND") return "I5_MISSING_BOOKING_NO_MUTATION";
  if (cmd.conflictKind === "payload") return "I3_REQUEST_PAYLOAD_CONFLICT";
  if (cmd.replayOf != null || modelOut.result.replayed) return "I2_EXACT_REPLAY_IDEMPOTENT";
  if (cmd.t === "confirm" && (modelOut.result.code === "CONFLICT" || implOut.code === "CONFIRMED")) return "I4_NO_CONFIRM_AFTER_CANCEL";
  if (cmd.t === "book" && modelOut.result.code === "CONFLICT") return "I1_UNIQUE_ACTIVE_SLOT";
  if (!modelOut.result.ok && afterBiz !== beforeBiz) return "I6_FAILED_OP_ATOMIC";
  if (stateMismatch && !modelOut.result.ok) return "I6_FAILED_OP_ATOMIC";
  if (cmd.t === "book") return "I1_UNIQUE_ACTIVE_SLOT";
  return "I6_FAILED_OP_ATOMIC";
}

export function runSequence(createClinic, commands) {
  let model = emptyState();
  const clinic = createClinic();
  const trace = [];
  const seenRequests = new Map();

  for (let i = 0; i < commands.length; i += 1) {
    const cmd = { ...commands[i] };
    const prev = seenRequests.get(cmd.requestId);
    if (prev) {
      cmd.replayOf = prev.index;
      cmd.conflictKind = prev.op === cmd.t && JSON.stringify(prev.args) === JSON.stringify(args(cmd)) ? "replay" : "payload";
    }
    const implBefore = implView(clinic);
    const beforeBiz = businessDigest(implBefore);
    const modelOut = apply(model, cmd);
    model = modelOut.state;
    let implOut;
    let threw = null;
    try {
      implOut = applyImpl(clinic, cmd);
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
      implOut = { ok: false, code: "THREW", bookingId: null, threw };
    }
    const implAfter = implView(clinic);
    const i1 = checkI1(implAfter);
    const modelView = { bookings: Object.fromEntries(model.bookings), slotOwner: Object.fromEntries(model.slotOwner) };
    const modelBiz = businessDigest(modelView);
    const afterBiz = businessDigest(implAfter);
    const invariantId = classify({ cmd, modelOut, implOut, threw, i1, beforeBiz, afterBiz, modelBiz });
    trace.push({
      index: i,
      cmd,
      expected: { result: modelOut.result, state: modelBiz },
      actual: { result: implOut, state: afterBiz },
      invariantId,
    });
    if (!prev) seenRequests.set(cmd.requestId, { index: i, op: cmd.t, args: args(cmd) });
    if (invariantId) {
      return {
        ok: false,
        invariantId,
        trace,
        initialState: view(emptyState()),
        expected: trace[trace.length - 1].expected,
        actual: trace[trace.length - 1].actual,
        commands,
      };
    }
  }
  return { ok: true, invariantId: null, trace, initialState: view(emptyState()), commands };
}

export function emptyState() {
  return { requests: new Map(), bookings: new Map(), slotOwner: new Map() };
}

export function cloneState(s) {
  return {
    requests: new Map(
      [...s.requests].map(([k, v]) => [k, { ...v, args: { ...v.args }, result: cloneResult(v.result) }]),
    ),
    bookings: new Map([...s.bookings].map(([k, v]) => [k, { ...v }])),
    slotOwner: new Map(s.slotOwner),
  };
}

export function cloneResult(r) {
  return r ? { ok: r.ok, code: r.code, bookingId: r.bookingId ?? null } : r;
}

export function digestState(s) {
  const bookings = [...s.bookings.values()].map((b) => `${b.id}|${b.slotId}|${b.patientId}|${b.status}`).sort();
  const slots = [...s.slotOwner.entries()].map(([slot, owner]) => `${slot}:${owner ?? ""}`).sort();
  const reqs = [...s.requests.entries()]
    .map(([id, rec]) => `${id}|${rec.op}|${JSON.stringify(rec.args)}|${rec.result.code}`)
    .sort();
  return JSON.stringify({ bookings, slots, reqs });
}

function sameArgs(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function argsOf(cmd) {
  if (cmd.t === "book") return { slotId: cmd.slotId, patientId: cmd.patientId };
  return { bookingId: cmd.bookingId };
}

export function apply(state, cmd) {
  const next = cloneState(state);
  const seen = next.requests.get(cmd.requestId);
  if (seen) {
    if (seen.op === cmd.t && sameArgs(seen.args, argsOf(cmd))) {
      return { state, result: { ...seen.result, replayed: true } };
    }
    return { state, result: { ok: false, code: "CONFLICT", bookingId: null } };
  }

  if (cmd.t === "book") {
    const owner = next.slotOwner.get(cmd.slotId);
    if (owner) {
      const occ = next.bookings.get(owner);
      if (occ && (occ.status === "pending" || occ.status === "confirmed")) {
        const result = { ok: false, code: "CONFLICT", bookingId: null };
        next.requests.set(cmd.requestId, { op: "book", args: argsOf(cmd), result });
        return { state: next, result };
      }
    }
    const bookingId = cmd.requestId;
    next.bookings.set(bookingId, { id: bookingId, slotId: cmd.slotId, patientId: cmd.patientId, status: "pending" });
    next.slotOwner.set(cmd.slotId, bookingId);
    const result = { ok: true, code: "BOOKED", bookingId };
    next.requests.set(cmd.requestId, { op: "book", args: argsOf(cmd), result });
    return { state: next, result };
  }

  if (cmd.t === "cancel" || cmd.t === "confirm") {
    const booking = next.bookings.get(cmd.bookingId);
    if (!booking) {
      const result = { ok: false, code: "NOT_FOUND", bookingId: null };
      next.requests.set(cmd.requestId, { op: cmd.t, args: argsOf(cmd), result });
      return { state: next, result };
    }
    if (cmd.t === "cancel") {
      if (booking.status !== "cancelled") {
        booking.status = "cancelled";
        if (next.slotOwner.get(booking.slotId) === booking.id) next.slotOwner.delete(booking.slotId);
      }
      const result = { ok: true, code: "CANCELLED", bookingId: booking.id };
      next.requests.set(cmd.requestId, { op: "cancel", args: argsOf(cmd), result });
      return { state: next, result };
    }
    if (booking.status === "cancelled") {
      const result = { ok: false, code: "CONFLICT", bookingId: booking.id };
      next.requests.set(cmd.requestId, { op: "confirm", args: argsOf(cmd), result });
      return { state: next, result };
    }
    booking.status = "confirmed";
    const result = { ok: true, code: "CONFIRMED", bookingId: booking.id };
    next.requests.set(cmd.requestId, { op: "confirm", args: argsOf(cmd), result });
    return { state: next, result };
  }

  throw new Error(`unknown command ${cmd.t}`);
}

export function view(state) {
  return {
    bookings: Object.fromEntries(state.bookings),
    slotOwner: Object.fromEntries(state.slotOwner),
    requestIds: [...state.requests.keys()].sort(),
    digest: digestState(state),
  };
}

function argsOf(op, input) {
  if (op === "book") return { slotId: input.slotId, patientId: input.patientId };
  return { bookingId: input.bookingId };
}
function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function materialize(events) {
  const bookings = new Map();
  const slotOwner = new Map();
  const requests = new Map();
  for (const ev of events) {
    if (ev.kind === "request") requests.set(ev.requestId, { op: ev.op, args: ev.args, result: ev.result });
    else if (ev.kind === "booked") {
      bookings.set(ev.bookingId, { id: ev.bookingId, slotId: ev.slotId, patientId: ev.patientId, status: "pending" });
      slotOwner.set(ev.slotId, ev.bookingId);
    } else if (ev.kind === "cancelled") {
      const b = bookings.get(ev.bookingId);
      if (b) {
        b.status = "cancelled";
        if (slotOwner.get(b.slotId) === b.id) slotOwner.delete(b.slotId);
      }
    } else if (ev.kind === "confirmed") {
      const b = bookings.get(ev.bookingId);
      if (b && b.status !== "cancelled") b.status = "confirmed";
    }
  }
  return { bookings, slotOwner, requests };
}
export function createClinic() {
  let events = [];
  function snapshot() {
    const s = materialize(events);
    return {
      bookings: Object.fromEntries([...s.bookings].map(([k, v]) => [k, { ...v }])),
      slotOwner: Object.fromEntries(s.slotOwner),
    };
  }
  function run(op, input) {
    const s = materialize(events);
    const requestId = input.requestId;
    const a = argsOf(op, input);
    const seen = s.requests.get(requestId);
    if (seen) {
      if (seen.op === op && same(seen.args, a)) return { ...seen.result };
      return { ok: false, code: "CONFLICT", bookingId: null };
    }
    const planned = [];
    let result;
    if (op === "book") {
      const owner = s.slotOwner.get(input.slotId);
      const occ = owner ? s.bookings.get(owner) : null;
      if (occ && (occ.status === "pending" || occ.status === "confirmed")) result = { ok: false, code: "CONFLICT", bookingId: null };
      else {
        const bookingId = requestId;
        planned.push({ kind: "booked", bookingId, slotId: input.slotId, patientId: input.patientId });
        result = { ok: true, code: "BOOKED", bookingId };
      }
    } else if (op === "cancel") {
      const booking = s.bookings.get(input.bookingId);
      if (!booking) result = { ok: false, code: "NOT_FOUND", bookingId: null };
      else {
        if (booking.status !== "cancelled") planned.push({ kind: "cancelled", bookingId: booking.id });
        result = { ok: true, code: "CANCELLED", bookingId: booking.id };
      }
    } else if (op === "confirm") {
      const booking = s.bookings.get(input.bookingId);
      if (!booking) result = { ok: false, code: "NOT_FOUND", bookingId: null };
      else if (booking.status === "cancelled") result = { ok: false, code: "CONFLICT", bookingId: booking.id };
      else {
        planned.push({ kind: "confirmed", bookingId: booking.id });
        result = { ok: true, code: "CONFIRMED", bookingId: booking.id };
      }
    } else result = { ok: false, code: "INVALID", bookingId: null };
    planned.push({ kind: "request", requestId, op, args: a, result: { ...result } });
    events = events.concat(planned);
    return { ...result };
  }
  return {
    book(requestId, slotId, patientId) {
      return run("book", { requestId, slotId, patientId });
    },
    cancel(requestId, bookingId) {
      return run("cancel", { requestId, bookingId });
    },
    confirm(requestId, bookingId) {
      return run("confirm", { requestId, bookingId });
    },
    snapshot,
  };
}

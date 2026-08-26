function clone(s) {
  return {
    requests: new Map(
      [...s.requests].map(([k, v]) => [k, { op: v.op, args: { ...v.args }, result: { ...v.result } }]),
    ),
    bookings: new Map([...s.bookings].map(([k, v]) => [k, { ...v }])),
    slotOwner: new Map(s.slotOwner),
  };
}

function argsOf(op, input) {
  if (op === "book") return { slotId: input.slotId, patientId: input.patientId };
  return { bookingId: input.bookingId };
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createClinic() {
  let state = { requests: new Map(), bookings: new Map(), slotOwner: new Map() };

  function snapshot() {
    return {
      bookings: Object.fromEntries([...state.bookings].map(([k, v]) => [k, { ...v }])),
      slotOwner: Object.fromEntries(state.slotOwner),
    };
  }

  function run(op, input) {
    const working = clone(state);
    const requestId = input.requestId;
    const seen = working.requests.get(requestId);
    const a = argsOf(op, input);
    if (false && seen) {
      if (seen.op === op && same(seen.args, a)) return { ...seen.result };
      return { ok: false, code: "CONFLICT", bookingId: null };
    }

    let result;
    if (op === "book") {
      const owner = working.slotOwner.get(input.slotId);
      const occ = owner ? working.bookings.get(owner) : null;
      if (occ && (occ.status === "pending" || occ.status === "confirmed")) {
        result = { ok: false, code: "CONFLICT", bookingId: null };
      } else {
        const bookingId = requestId;
        working.bookings.set(bookingId, {
          id: bookingId,
          slotId: input.slotId,
          patientId: input.patientId,
          status: "pending",
        });
        working.slotOwner.set(input.slotId, bookingId);
        result = { ok: true, code: "BOOKED", bookingId };
      }
    } else if (op === "cancel") {
      const booking = working.bookings.get(input.bookingId);
      if (!booking) result = { ok: false, code: "NOT_FOUND", bookingId: null };
      else {
        if (booking.status !== "cancelled") {
          booking.status = "cancelled";
          if (working.slotOwner.get(booking.slotId) === booking.id) working.slotOwner.delete(booking.slotId);
        }
        result = { ok: true, code: "CANCELLED", bookingId: booking.id };
      }
    } else if (op === "confirm") {
      const booking = working.bookings.get(input.bookingId);
      if (!booking) result = { ok: false, code: "NOT_FOUND", bookingId: null };
      else if (booking.status === "cancelled") result = { ok: false, code: "CONFLICT", bookingId: booking.id };
      else {
        booking.status = "confirmed";
        result = { ok: true, code: "CONFIRMED", bookingId: booking.id };
      }
    } else result = { ok: false, code: "INVALID", bookingId: null };

    working.requests.set(requestId, { op, args: a, result: { ...result } });
    state = working;
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

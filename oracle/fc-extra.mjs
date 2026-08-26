export async function extraSequences(maxCommands, numRuns, seed) {
  try {
    const fc = (await import("fast-check")).default;
    const bookArb = fc.record({
      t: fc.constant("book"),
      requestId: fc.constantFrom("r1", "r2", "r3", "r4", "r5", "r6"),
      slotId: fc.constantFrom("s1", "s2", "s3"),
      patientId: fc.constantFrom("p1", "p2", "p3"),
    });
    const cancelArb = fc.record({
      t: fc.constant("cancel"),
      requestId: fc.constantFrom("r1", "r2", "r3", "r4", "r5", "r6"),
      bookingId: fc.constantFrom("r1", "r2", "r3", "ghost"),
    });
    const confirmArb = fc.record({
      t: fc.constant("confirm"),
      requestId: fc.constantFrom("r1", "r2", "r3", "r4", "r5", "r6"),
      bookingId: fc.constantFrom("r1", "r2", "r3", "ghost"),
    });
    const arb = fc.array(fc.oneof(bookArb, cancelArb, confirmArb), { minLength: 1, maxLength: maxCommands });
    const seqs = [];
    fc.assert(
      fc.property(arb, (commands) => {
        seqs.push(commands);
        return true;
      }),
      { seed, numRuns },
    );
    return { ok: true, engine: "fast-check@3.23.2", sequences: seqs };
  } catch {
    return { ok: false, engine: "unavailable", sequences: [] };
  }
}

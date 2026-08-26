import assert from "node:assert/strict";
import test from "node:test";
import { createClinic } from "../src/clinic.mjs";

test("book then confirm happy path", () => {
  const c = createClinic();
  const b = c.book("r1", "s1", "p1");
  assert.equal(b.code, "BOOKED");
  assert.equal(c.confirm("r2", b.bookingId).code, "CONFIRMED");
});

test("exact replay of book is idempotent", () => {
  const c = createClinic();
  const a = c.book("r1", "s1", "p1");
  const b = c.book("r1", "s1", "p1");
  assert.deepEqual(a, b);
  assert.equal(Object.keys(c.snapshot().bookings).length, 1);
});

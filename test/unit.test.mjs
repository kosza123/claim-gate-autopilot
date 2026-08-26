import assert from "node:assert/strict";
import { test } from "node:test";
import { withdraw } from "../src/withdraw.mjs";
import { TransferError, applyTransferBatch } from "../src/transfer-ledger.mjs";

test("subtracts a permitted amount", () => {
  assert.equal(withdraw(40, 10), 30);
});

function ledgerState(overrides = {}) {
  return {
    balances: { alice: 10000, bob: 5000, carol: 1000, ...(overrides.balances || {}) },
    sentToday: { ...(overrides.sentToday || {}) },
    processed: { ...(overrides.processed || {}) },
  };
}

function transfer(id, from, to, amountCents, dailyLimitCents = 10000) {
  return { id, from, to, amountCents, dailyLimitCents };
}

function expectTransferError(fn, code, requestId) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof TransferError);
    assert.equal(err.code, code);
    if (requestId !== undefined) assert.equal(err.requestId, requestId);
    return true;
  });
}

function ownMap(pairs) {
  const out = Object.create(null);
  for (const [key, value] of pairs) {
    Object.defineProperty(out, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

test("withdraw still rejects insufficient funds", () => {
  assert.throws(() => withdraw(40, 100), /insufficient/);
});

test("applies a single valid transfer", () => {
  const state = ledgerState({ sentToday: { alice: 2000 } });
  const next = applyTransferBatch(state, [transfer("request-id", "alice", "bob", 1000)]);
  assert.equal(next.balances.alice, 9000);
  assert.equal(next.balances.bob, 6000);
  assert.equal(next.sentToday.alice, 3000);
  assert.deepEqual(next.processed["request-id"], {
    from: "alice",
    to: "bob",
    amountCents: 1000,
    dailyLimitCents: 10000,
  });
});

test("applies several transfers sequentially", () => {
  const state = ledgerState({ sentToday: { alice: 0, bob: 0 } });
  const next = applyTransferBatch(state, [
    transfer("t1", "alice", "bob", 1000, 10000),
    transfer("t2", "bob", "carol", 5500, 10000),
    transfer("t3", "carol", "alice", 200, 10000),
  ]);
  assert.equal(next.balances.alice, 9200);
  assert.equal(next.balances.bob, 500);
  assert.equal(next.balances.carol, 6300);
  assert.equal(next.sentToday.alice, 1000);
  assert.equal(next.sentToday.bob, 5500);
  assert.equal(next.sentToday.carol, 200);
  assert.equal(Object.keys(next.processed).length, 3);
});

test("rejects insufficient funds", () => {
  const state = ledgerState();
  expectTransferError(
    () => applyTransferBatch(state, [transfer("poor", "carol", "alice", 1001)]),
    "INSUFFICIENT_FUNDS",
    "poor",
  );
});

test("rejects a transfer that exceeds the daily limit", () => {
  const state = ledgerState({ sentToday: { alice: 2000 } });
  expectTransferError(
    () => applyTransferBatch(state, [transfer("over", "alice", "bob", 8001, 10000)]),
    "DAILY_LIMIT_EXCEEDED",
    "over",
  );
});

test("allows a transfer that lands on the exact daily limit", () => {
  const state = ledgerState({ sentToday: { alice: 2000 } });
  const next = applyTransferBatch(state, [transfer("edge", "alice", "bob", 8000, 10000)]);
  assert.equal(next.balances.alice, 2000);
  assert.equal(next.sentToday.alice, 10000);
});

test("rejects a missing account", () => {
  const state = ledgerState();
  expectTransferError(
    () => applyTransferBatch(state, [transfer("ghost", "alice", "dave", 100)]),
    "ACCOUNT_NOT_FOUND",
    "ghost",
  );
  expectTransferError(
    () => applyTransferBatch(state, [transfer("ghost-from", "dave", "alice", 100)]),
    "ACCOUNT_NOT_FOUND",
    "ghost-from",
  );
});

test("rejects from equal to to", () => {
  const state = ledgerState();
  expectTransferError(
    () => applyTransferBatch(state, [transfer("self", "alice", "alice", 100)]),
    "INVALID_REQUEST",
    "self",
  );
});

test("rejects negative, zero, fractional, NaN, and Infinity amounts", () => {
  const state = ledgerState();
  for (const amountCents of [-1, 0, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    expectTransferError(
      () => applyTransferBatch(state, [transfer("bad-amount", "alice", "bob", amountCents)]),
      "INVALID_REQUEST",
      "bad-amount",
    );
  }
});

test("treats missing sentToday for the sender as zero", () => {
  const state = ledgerState({ sentToday: { bob: 10 } });
  const next = applyTransferBatch(state, [transfer("no-sent", "alice", "bob", 2500, 10000)]);
  assert.equal(next.sentToday.alice, 2500);
  assert.equal(next.sentToday.bob, 10);
  assert.equal(next.balances.alice, 7500);
});

test("identical replay of a processed id is a no-op", () => {
  const processed = {
    "request-id": { from: "alice", to: "bob", amountCents: 1000, dailyLimitCents: 10000 },
  };
  const state = ledgerState({ sentToday: { alice: 2000 }, processed });
  const next = applyTransferBatch(state, [transfer("request-id", "alice", "bob", 1000, 10000)]);
  assert.equal(next.balances.alice, 10000);
  assert.equal(next.balances.bob, 5000);
  assert.equal(next.sentToday.alice, 2000);
  assert.deepEqual(next.processed["request-id"], processed["request-id"]);
});

test("rejects an idempotency conflict with processed", () => {
  const state = ledgerState({
    processed: {
      "request-id": { from: "alice", to: "bob", amountCents: 1000, dailyLimitCents: 10000 },
    },
  });
  expectTransferError(
    () => applyTransferBatch(state, [transfer("request-id", "alice", "bob", 2000, 10000)]),
    "IDEMPOTENCY_CONFLICT",
    "request-id",
  );
});

test("identical duplicates inside a batch transfer only once", () => {
  const state = ledgerState({ sentToday: { alice: 0 } });
  const next = applyTransferBatch(state, [
    transfer("dup", "alice", "bob", 1000),
    transfer("dup", "alice", "bob", 1000),
  ]);
  assert.equal(next.balances.alice, 9000);
  assert.equal(next.balances.bob, 6000);
  assert.equal(next.sentToday.alice, 1000);
  assert.equal(Object.keys(next.processed).length, 1);
});

test("conflicting duplicates inside a batch reject the whole batch", () => {
  const state = ledgerState();
  expectTransferError(
    () =>
      applyTransferBatch(state, [
        transfer("dup", "alice", "bob", 1000),
        transfer("dup", "alice", "carol", 1000),
      ]),
    "IDEMPOTENCY_CONFLICT",
    "dup",
  );
});

test("a mid-batch error applies none of the requests", () => {
  const state = ledgerState({ sentToday: { alice: 0 } });
  const snapshot = structuredClone(state);
  expectTransferError(
    () =>
      applyTransferBatch(state, [
        transfer("ok1", "alice", "bob", 1000),
        transfer("bad", "alice", "bob", 99999),
        transfer("ok2", "alice", "carol", 100),
      ]),
    "INSUFFICIENT_FUNDS",
    "bad",
  );
  assert.deepEqual(state, snapshot);
  const onlyFirst = applyTransferBatch(state, [transfer("ok1", "alice", "bob", 1000)]);
  assert.equal(onlyFirst.balances.alice, 9000);
  assert.equal(state.balances.alice, 10000);
});

test("does not mutate input state, requests, or nested objects", () => {
  const state = ledgerState({ sentToday: { alice: 2000 } });
  const nestedBalances = state.balances;
  const nestedSent = state.sentToday;
  const requests = [transfer("immut", "alice", "bob", 1000)];
  const stateSnap = structuredClone(state);
  const reqSnap = structuredClone(requests);
  const next = applyTransferBatch(state, requests);
  assert.deepEqual(state, stateSnap);
  assert.deepEqual(requests, reqSnap);
  assert.equal(nestedBalances.alice, 10000);
  assert.equal(nestedSent.alice, 2000);
  assert.notEqual(next, state);
  assert.notEqual(next.balances, state.balances);
  assert.notEqual(next.sentToday, state.sentToday);
  assert.notEqual(next.processed, state.processed);
  next.balances.alice = 1;
  next.processed.immut.from = "mallory";
  assert.equal(state.balances.alice, 10000);
});

test("sequential daily limit uses prior transfers in the same batch", () => {
  const state = ledgerState({ sentToday: { alice: 9000 } });
  expectTransferError(
    () =>
      applyTransferBatch(state, [
        transfer("first", "alice", "bob", 500, 10000),
        transfer("second", "alice", "bob", 600, 10000),
      ]),
    "DAILY_LIMIT_EXCEEDED",
    "second",
  );
});

test("id toString is a legal processed key and transfers", () => {
  const state = ledgerState();
  const next = applyTransferBatch(state, [transfer("toString", "alice", "bob", 100)]);
  assert.equal(next.balances.alice, 9900);
  assert.equal(next.balances.bob, 5100);
  assert.deepEqual(next.processed.toString, {
    from: "alice",
    to: "bob",
    amountCents: 100,
    dailyLimitCents: 10000,
  });
  const replay = applyTransferBatch(next, [transfer("toString", "alice", "bob", 100)]);
  assert.equal(replay.balances.alice, 9900);
});

test("id constructor is a legal processed key and transfers", () => {
  const state = ledgerState();
  const next = applyTransferBatch(state, [transfer("constructor", "alice", "bob", 100)]);
  assert.equal(next.balances.alice, 9900);
  assert.deepEqual(next.processed.constructor, {
    from: "alice",
    to: "bob",
    amountCents: 100,
    dailyLimitCents: 10000,
  });
});

test("id __proto__ is stored as an own entry and replay is a no-op", () => {
  const state = ledgerState();
  const req = transfer("__proto__", "alice", "bob", 250);
  const next = applyTransferBatch(state, [req, req]);
  assert.equal(next.balances.alice, 9750);
  assert.equal(next.balances.bob, 5250);
  assert.equal(next.sentToday.alice, 250);
  assert.equal(Object.prototype.hasOwnProperty.call(next.processed, "__proto__"), true);
  assert.deepEqual(Object.getOwnPropertyDescriptor(next.processed, "__proto__").value, {
    from: "alice",
    to: "bob",
    amountCents: 250,
    dailyLimitCents: 10000,
  });
  const proto = Object.getPrototypeOf(next.processed);
  assert.ok(proto === null || proto === Object.prototype);
  const replay = applyTransferBatch(next, [req]);
  assert.equal(replay.balances.alice, 9750);
  assert.equal(replay.sentToday.alice, 250);
});

test("two distinct transfers from account __proto__ sum sentToday and respect the daily limit", () => {
  const state = {
    balances: ownMap([
      ["__proto__", 10000],
      ["bob", 0],
    ]),
    sentToday: ownMap([]),
    processed: ownMap([]),
  };
  const first = applyTransferBatch(state, [transfer("p1", "__proto__", "bob", 4000, 5000)]);
  assert.equal(Object.getOwnPropertyDescriptor(first.balances, "__proto__").value, 6000);
  assert.equal(first.balances.bob, 4000);
  assert.equal(Object.getOwnPropertyDescriptor(first.sentToday, "__proto__").value, 4000);

  const second = applyTransferBatch(first, [transfer("p2", "__proto__", "bob", 1000, 5000)]);
  assert.equal(Object.getOwnPropertyDescriptor(second.sentToday, "__proto__").value, 5000);
  assert.equal(second.balances.bob, 5000);

  expectTransferError(
    () => applyTransferBatch(second, [transfer("p3", "__proto__", "bob", 1, 5000)]),
    "DAILY_LIMIT_EXCEEDED",
    "p3",
  );
});

test("exact historical replay is a no-op even after old accounts are gone", () => {
  const processed = {
    "old-tx": { from: "ghost-from", to: "ghost-to", amountCents: 100, dailyLimitCents: 10000 },
  };
  const state = ledgerState({ processed });
  delete state.balances.alice;
  const next = applyTransferBatch(state, [transfer("old-tx", "ghost-from", "ghost-to", 100, 10000)]);
  assert.deepEqual(next.processed["old-tx"], processed["old-tx"]);
  assert.equal(next.balances.bob, 5000);
  assert.equal(Object.prototype.hasOwnProperty.call(next.balances, "ghost-from"), false);
});

test("historical id conflict takes precedence over ACCOUNT_NOT_FOUND", () => {
  const state = ledgerState({
    processed: {
      "old-tx": { from: "ghost-from", to: "ghost-to", amountCents: 100, dailyLimitCents: 10000 },
    },
  });
  expectTransferError(
    () => applyTransferBatch(state, [transfer("old-tx", "ghost-from", "ghost-to", 200, 10000)]),
    "IDEMPOTENCY_CONFLICT",
    "old-tx",
  );
});

test("receiver balance overflow is rejected with no partial state change", () => {
  const state = ledgerState({
    balances: { alice: 10, bob: Number.MAX_SAFE_INTEGER, carol: 1 },
  });
  const snapshot = structuredClone(state);
  expectTransferError(
    () =>
      applyTransferBatch(state, [
        transfer("ok", "carol", "alice", 1),
        transfer("boom", "alice", "bob", 1),
      ]),
    "INVALID_REQUEST",
    "boom",
  );
  assert.deepEqual(state, snapshot);
  assert.equal(state.balances.alice, 10);
  assert.equal(state.balances.bob, Number.MAX_SAFE_INTEGER);
});

test("Date Map Set and class instances are not valid maps", () => {
  class Ledger {}
  for (const bad of [new Date(), new Map(), new Set(), [], new Ledger()]) {
    expectTransferError(
      () => applyTransferBatch({ balances: bad, sentToday: {}, processed: {} }, []),
      "INVALID_STATE",
    );
    expectTransferError(
      () => applyTransferBatch({ balances: {}, sentToday: bad, processed: {} }, []),
      "INVALID_STATE",
    );
    expectTransferError(
      () => applyTransferBatch({ balances: {}, sentToday: {}, processed: bad }, []),
      "INVALID_STATE",
    );
  }
});

test("extra state metadata is preserved on empty batch and valid transfer", () => {
  const state = ledgerState();
  state.note = "keep-me";
  state.meta = { region: "eu", nested: { n: 1 } };
  const empty = applyTransferBatch(state, []);
  assert.equal(empty.note, "keep-me");
  assert.deepEqual(empty.meta, { region: "eu", nested: { n: 1 } });
  empty.meta.nested.n = 9;
  assert.equal(state.meta.nested.n, 1);

  const next = applyTransferBatch(state, [transfer("keep", "alice", "bob", 100)]);
  assert.equal(next.note, "keep-me");
  assert.deepEqual(next.meta, { region: "eu", nested: { n: 1 } });
  assert.equal(next.balances.alice, 9900);
});

test("rejects invalid dailyLimitCents values", () => {
  const state = ledgerState();
  for (const dailyLimitCents of [
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    expectTransferError(
      () => applyTransferBatch(state, [transfer("bad-limit", "alice", "bob", 100, dailyLimitCents)]),
      "INVALID_REQUEST",
      "bad-limit",
    );
  }
});

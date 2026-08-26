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

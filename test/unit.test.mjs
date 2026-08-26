import assert from "node:assert/strict";
import { test } from "node:test";
import { withdraw } from "../src/withdraw.mjs";
import { TransferError, applyTransferBatch } from "../src/transfer-ledger.mjs";

test("subtracts a permitted amount", () => {
  assert.equal(withdraw(40, 10), 30);
});

test("withdraw still rejects overdrafts", () => {
  assert.throws(() => withdraw(40, 100), /insufficient/);
});

test("applies a single valid transfer", () => {
  const state = baseState();
  const next = applyTransferBatch(state, [
    request("tx-1", "alice", "bob", 1000, 10000),
  ]);

  assert.equal(next.balances.alice, 9000);
  assert.equal(next.balances.bob, 6000);
  assert.equal(next.sentToday.alice, 3000);
  assert.deepEqual(next.processed["tx-1"], {
    from: "alice",
    to: "bob",
    amountCents: 1000,
    dailyLimitCents: 10000,
  });
  assert.notEqual(next, state);
  assert.notEqual(next.balances, state.balances);
});

test("applies several transfers sequentially", () => {
  const next = applyTransferBatch(baseState({ sentToday: {} }), [
    request("tx-1", "alice", "bob", 4000, 10000),
    request("tx-2", "bob", "alice", 1500, 10000),
    request("tx-3", "alice", "bob", 500, 10000),
  ]);

  assert.equal(next.balances.alice, 7000);
  assert.equal(next.balances.bob, 8000);
  assert.equal(next.sentToday.alice, 4500);
  assert.equal(next.sentToday.bob, 1500);
  assert.equal(Object.keys(next.processed).length, 3);
});

test("rejects insufficient funds", () => {
  const state = baseState();
  assert.throws(
    () => applyTransferBatch(state, [request("tx-1", "bob", "alice", 5001, 10000)]),
    (err) =>
      err instanceof TransferError &&
      err.code === "INSUFFICIENT_FUNDS" &&
      err.requestId === "tx-1",
  );
  assert.equal(state.balances.bob, 5000);
});

test("rejects a transfer that exceeds the daily limit", () => {
  assert.throws(
    () =>
      applyTransferBatch(baseState(), [
        request("tx-1", "alice", "bob", 8500, 10000),
      ]),
    (err) =>
      err instanceof TransferError &&
      err.code === "DAILY_LIMIT_EXCEEDED" &&
      err.requestId === "tx-1",
  );
});

test("allows a transfer that lands exactly on the daily limit", () => {
  const next = applyTransferBatch(baseState(), [
    request("tx-1", "alice", "bob", 8000, 10000),
  ]);

  assert.equal(next.balances.alice, 2000);
  assert.equal(next.sentToday.alice, 10000);
});

test("rejects a transfer to or from a missing account", () => {
  assert.throws(
    () =>
      applyTransferBatch(baseState(), [
        request("tx-1", "alice", "carol", 100, 10000),
      ]),
    (err) =>
      err instanceof TransferError &&
      err.code === "ACCOUNT_NOT_FOUND" &&
      err.requestId === "tx-1",
  );
  assert.throws(
    () =>
      applyTransferBatch(baseState(), [
        request("tx-2", "carol", "alice", 100, 10000),
      ]),
    (err) =>
      err instanceof TransferError &&
      err.code === "ACCOUNT_NOT_FOUND" &&
      err.requestId === "tx-2",
  );
});

test("rejects a transfer where from equals to", () => {
  assert.throws(
    () =>
      applyTransferBatch(baseState(), [
        request("tx-1", "alice", "alice", 100, 10000),
      ]),
    (err) =>
      err instanceof TransferError &&
      err.code === "INVALID_REQUEST" &&
      err.requestId === "tx-1",
  );
});

test("rejects negative, zero, fractional, NaN, and infinite amounts", () => {
  for (const amountCents of [-1, 0, 1.5, NaN, Infinity, -Infinity]) {
    assert.throws(
      () =>
        applyTransferBatch(baseState(), [
          request("tx-bad", "alice", "bob", amountCents, 10000),
        ]),
      (err) =>
        err instanceof TransferError &&
        err.code === "INVALID_REQUEST" &&
        err.requestId === "tx-bad",
      `amountCents=${amountCents}`,
    );
  }
});

test("treats a missing sentToday entry for the sender as zero", () => {
  const next = applyTransferBatch(baseState({ sentToday: { bob: 10 } }), [
    request("tx-1", "alice", "bob", 2500, 10000),
  ]);

  assert.equal(next.sentToday.alice, 2500);
  assert.equal(next.sentToday.bob, 10);
  assert.equal(next.balances.alice, 7500);
});

test("identical replay of a processed id is a no-op", () => {
  const req = request("tx-1", "alice", "bob", 1000, 10000);
  const processed = applyTransferBatch(baseState({ sentToday: {} }), [req]);
  const replayed = applyTransferBatch(processed, [req]);

  assert.deepEqual(replayed.balances, processed.balances);
  assert.deepEqual(replayed.sentToday, processed.sentToday);
  assert.deepEqual(replayed.processed, processed.processed);
  assert.notEqual(replayed, processed);
});

test("rejects an idempotency conflict against processed", () => {
  const processed = applyTransferBatch(baseState({ sentToday: {} }), [
    request("tx-1", "alice", "bob", 1000, 10000),
  ]);

  assert.throws(
    () =>
      applyTransferBatch(processed, [
        request("tx-1", "alice", "bob", 1001, 10000),
      ]),
    (err) =>
      err instanceof TransferError &&
      err.code === "IDEMPOTENCY_CONFLICT" &&
      err.requestId === "tx-1",
  );
});

test("identical duplicates inside a batch transfer only once", () => {
  const req = request("tx-1", "alice", "bob", 1000, 10000);
  const next = applyTransferBatch(baseState({ sentToday: {} }), [req, { ...req }]);

  assert.equal(next.balances.alice, 9000);
  assert.equal(next.balances.bob, 6000);
  assert.equal(next.sentToday.alice, 1000);
  assert.deepEqual(Object.keys(next.processed), ["tx-1"]);
});

test("conflicting duplicates inside a batch reject the whole batch", () => {
  const state = baseState({ sentToday: {} });
  assert.throws(
    () =>
      applyTransferBatch(state, [
        request("tx-1", "alice", "bob", 1000, 10000),
        request("tx-1", "alice", "bob", 2000, 10000),
      ]),
    (err) =>
      err instanceof TransferError &&
      err.code === "IDEMPOTENCY_CONFLICT" &&
      err.requestId === "tx-1",
  );
  assert.deepEqual(state, baseState({ sentToday: {} }));
});

test("a failure in the middle of a batch applies nothing", () => {
  const state = baseState({ sentToday: {} });
  const snapshot = structuredClone(state);

  assert.throws(
    () =>
      applyTransferBatch(state, [
        request("tx-1", "alice", "bob", 1000, 10000),
        request("tx-2", "alice", "bob", 9500, 10000),
        request("tx-3", "bob", "alice", 100, 10000),
      ]),
    (err) =>
      err instanceof TransferError &&
      err.code === "INSUFFICIENT_FUNDS" &&
      err.requestId === "tx-2",
  );

  assert.deepEqual(state, snapshot);
});

test("does not mutate state, requests, or nested objects", () => {
  const state = baseState();
  const requests = [request("tx-1", "alice", "bob", 1000, 10000)];
  const stateSnapshot = structuredClone(state);
  const requestSnapshot = structuredClone(requests);

  Object.freeze(state);
  Object.freeze(state.balances);
  Object.freeze(state.sentToday);
  Object.freeze(state.processed);
  Object.freeze(requests);
  Object.freeze(requests[0]);

  const next = applyTransferBatch(state, requests);

  assert.deepEqual(state, stateSnapshot);
  assert.deepEqual(requests, requestSnapshot);
  assert.equal(next.balances.alice, 9000);
  next.balances.alice = 0;
  next.processed["tx-1"].amountCents = 0;
  assert.equal(state.balances.alice, 10000);
  assert.equal(stateSnapshot.balances.alice, 10000);
});

function baseState(overrides = {}) {
  return {
    balances: { alice: 10000, bob: 5000 },
    sentToday: { alice: 2000 },
    processed: {},
    ...overrides,
  };
}

function request(id, from, to, amountCents, dailyLimitCents) {
  return { id, from, to, amountCents, dailyLimitCents };
}

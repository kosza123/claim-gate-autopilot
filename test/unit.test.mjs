import assert from "node:assert/strict";
import { test } from "node:test";
import { withdraw } from "../src/withdraw.mjs";
import { TransferError, applyTransferBatch } from "../src/transfer-ledger.mjs";

test("subtracts a permitted amount", () => {
  assert.equal(withdraw(40, 10), 30);
});

function sampleState() {
  return {
    balances: {
      alice: 10000,
      bob: 5000,
      carol: 3000,
    },
    sentToday: {
      alice: 2000,
    },
    processed: {},
  };
}

function transfer(overrides = {}) {
  return {
    id: "request-id",
    from: "alice",
    to: "bob",
    amountCents: 1000,
    dailyLimitCents: 10000,
    ...overrides,
  };
}

function expectCode(fn, code, requestId) {
  assert.throws(fn, (err) => {
    assert.equal(err instanceof TransferError, true);
    assert.equal(err.code, code);
    if (requestId !== undefined) {
      assert.equal(err.requestId, requestId);
    }
    return true;
  });
}

test("withdraw still rejects overdraft with the original error", () => {
  assert.throws(() => withdraw(40, 100), /insufficient/);
  assert.equal(withdraw(1, 1), 0);
});

test("applies a single valid transfer", () => {
  const state = sampleState();
  const next = applyTransferBatch(state, [transfer()]);
  assert.deepEqual(next.balances, { alice: 9000, bob: 6000, carol: 3000 });
  assert.equal(next.sentToday.alice, 3000);
  assert.deepEqual(next.processed["request-id"], {
    from: "alice",
    to: "bob",
    amountCents: 1000,
    dailyLimitCents: 10000,
  });
});

test("applies several transfers sequentially", () => {
  const next = applyTransferBatch(sampleState(), [
    transfer({ id: "t1", amountCents: 1000 }),
    transfer({ id: "t2", from: "bob", to: "carol", amountCents: 2500, dailyLimitCents: 5000 }),
    transfer({ id: "t3", from: "carol", to: "alice", amountCents: 500, dailyLimitCents: 4000 }),
  ]);
  assert.deepEqual(next.balances, { alice: 9500, bob: 3500, carol: 5000 });
  assert.equal(next.sentToday.alice, 3000);
  assert.equal(next.sentToday.bob, 2500);
  assert.equal(next.sentToday.carol, 500);
  assert.equal(Object.keys(next.processed).length, 3);
});

test("rejects insufficient funds", () => {
  expectCode(
    () => applyTransferBatch(sampleState(), [transfer({ amountCents: 10001 })]),
    "INSUFFICIENT_FUNDS",
    "request-id",
  );
});

test("rejects a transfer that exceeds the daily limit", () => {
  expectCode(
    () => applyTransferBatch(sampleState(), [transfer({ amountCents: 8001 })]),
    "DAILY_LIMIT_EXCEEDED",
    "request-id",
  );
});

test("allows a transfer that lands exactly on the daily limit", () => {
  const next = applyTransferBatch(sampleState(), [transfer({ amountCents: 8000 })]);
  assert.equal(next.balances.alice, 2000);
  assert.equal(next.sentToday.alice, 10000);
});

test("rejects a missing account", () => {
  expectCode(
    () => applyTransferBatch(sampleState(), [transfer({ to: "dave" })]),
    "ACCOUNT_NOT_FOUND",
    "request-id",
  );
  expectCode(
    () => applyTransferBatch(sampleState(), [transfer({ id: "missing-from", from: "dave" })]),
    "ACCOUNT_NOT_FOUND",
    "missing-from",
  );
});

test("rejects from === to", () => {
  expectCode(
    () => applyTransferBatch(sampleState(), [transfer({ to: "alice" })]),
    "INVALID_REQUEST",
    "request-id",
  );
});

test("rejects negative, zero, fractional, NaN, and infinite amounts", () => {
  for (const amountCents of [-1, 0, 1.5, Number.NaN, Infinity, -Infinity]) {
    expectCode(
      () => applyTransferBatch(sampleState(), [transfer({ amountCents })]),
      "INVALID_REQUEST",
      "request-id",
    );
  }
});

test("rejects invalid dailyLimitCents", () => {
  for (const dailyLimitCents of [-1, 0, 1.5, Number.NaN, Infinity]) {
    expectCode(
      () => applyTransferBatch(sampleState(), [transfer({ dailyLimitCents })]),
      "INVALID_REQUEST",
      "request-id",
    );
  }
});

test("treats a missing sentToday entry for the sender as zero", () => {
  const state = {
    balances: { alice: 10000, bob: 5000 },
    sentToday: {},
    processed: {},
  };
  const next = applyTransferBatch(state, [transfer({ amountCents: 4000, dailyLimitCents: 4000 })]);
  assert.equal(next.sentToday.alice, 4000);
  assert.equal(next.balances.alice, 6000);
  assert.equal(next.balances.bob, 9000);

  const withoutMap = {
    balances: { alice: 10000, bob: 5000 },
    processed: {},
  };
  const next2 = applyTransferBatch(withoutMap, [transfer({ amountCents: 1000, dailyLimitCents: 1000 })]);
  assert.equal(next2.sentToday.alice, 1000);
});

test("identical replay of a processed id is a no-op", () => {
  const first = applyTransferBatch(sampleState(), [transfer()]);
  const replayed = applyTransferBatch(first, [transfer()]);
  assert.deepEqual(replayed.balances, first.balances);
  assert.deepEqual(replayed.sentToday, first.sentToday);
  assert.deepEqual(replayed.processed, first.processed);
  assert.notEqual(replayed, first);
});

test("same id with different parameters is an idempotency conflict", () => {
  const first = applyTransferBatch(sampleState(), [transfer()]);
  expectCode(
    () => applyTransferBatch(first, [transfer({ amountCents: 2000 })]),
    "IDEMPOTENCY_CONFLICT",
    "request-id",
  );
  expectCode(
    () => applyTransferBatch(first, [transfer({ to: "carol" })]),
    "IDEMPOTENCY_CONFLICT",
    "request-id",
  );
  expectCode(
    () => applyTransferBatch(first, [transfer({ dailyLimitCents: 9000 })]),
    "IDEMPOTENCY_CONFLICT",
    "request-id",
  );
});

test("identical duplicate ids in one batch transfer only once", () => {
  const req = transfer({ amountCents: 1000 });
  const next = applyTransferBatch(sampleState(), [req, { ...req }]);
  assert.equal(next.balances.alice, 9000);
  assert.equal(next.balances.bob, 6000);
  assert.equal(next.sentToday.alice, 3000);
  assert.deepEqual(Object.keys(next.processed), ["request-id"]);
});

test("conflicting duplicate ids in one batch reject the batch", () => {
  expectCode(
    () =>
      applyTransferBatch(sampleState(), [
        transfer({ amountCents: 1000 }),
        transfer({ amountCents: 2000 }),
      ]),
    "IDEMPOTENCY_CONFLICT",
    "request-id",
  );
});

test("a later failure in the batch applies none of the transfers", () => {
  const state = sampleState();
  const snapshot = structuredClone(state);
  expectCode(
    () =>
      applyTransferBatch(state, [
        transfer({ id: "ok", amountCents: 1000 }),
        transfer({ id: "bad", amountCents: 100000 }),
      ]),
    "INSUFFICIENT_FUNDS",
    "bad",
  );
  assert.deepEqual(state, snapshot);
  expectCode(
    () =>
      applyTransferBatch(state, [
        transfer({ id: "ok", amountCents: 1000 }),
        transfer({ id: "over-limit", amountCents: 8000 }),
      ]),
    "DAILY_LIMIT_EXCEEDED",
    "over-limit",
  );
  assert.deepEqual(state, snapshot);
});

test("does not mutate input state, requests, or nested objects", () => {
  const state = sampleState();
  const nestedProcessed = { from: "alice", to: "bob", amountCents: 1, dailyLimitCents: 1 };
  state.processed.prior = nestedProcessed;
  const requests = [transfer({ id: "t-mut", amountCents: 500 })];
  const stateSnap = structuredClone(state);
  const reqSnap = structuredClone(requests);
  const balancesRef = state.balances;
  const sentRef = state.sentToday;
  const processedRef = state.processed;

  const next = applyTransferBatch(state, requests);

  assert.deepEqual(state, stateSnap);
  assert.deepEqual(requests, reqSnap);
  assert.equal(state.balances, balancesRef);
  assert.equal(state.sentToday, sentRef);
  assert.equal(state.processed, processedRef);
  assert.equal(state.balances.alice, 10000);
  assert.equal(nestedProcessed.amountCents, 1);
  assert.notEqual(next.balances, state.balances);
  assert.notEqual(next.sentToday, state.sentToday);
  assert.notEqual(next.processed, state.processed);
  next.balances.alice = 0;
  next.processed["t-mut"].amountCents = 0;
  assert.equal(state.balances.alice, 10000);
  assert.equal(stateSnap.processed.prior.amountCents, 1);
});

test("sequential transfers consume balance and daily limit for later requests", () => {
  expectCode(
    () =>
      applyTransferBatch(
        { balances: { alice: 5000, bob: 0 }, sentToday: {}, processed: {} },
        [
          transfer({ id: "first", amountCents: 3000, dailyLimitCents: 5000 }),
          transfer({ id: "second", amountCents: 2500, dailyLimitCents: 5000 }),
        ],
      ),
    "INSUFFICIENT_FUNDS",
    "second",
  );
  expectCode(
    () =>
      applyTransferBatch(
        { balances: { alice: 20000, bob: 0 }, sentToday: {}, processed: {} },
        [
          transfer({ id: "first", amountCents: 4000, dailyLimitCents: 5000 }),
          transfer({ id: "second", amountCents: 1500, dailyLimitCents: 5000 }),
        ],
      ),
    "DAILY_LIMIT_EXCEEDED",
    "second",
  );
});

test("rejects invalid state and empty identity fields", () => {
  expectCode(() => applyTransferBatch(null, []), "INVALID_STATE");
  expectCode(
    () => applyTransferBatch({ balances: { alice: -1, bob: 1 }, sentToday: {}, processed: {} }, []),
    "INVALID_STATE",
  );
  expectCode(() => applyTransferBatch(sampleState(), null), "INVALID_REQUEST");
  expectCode(
    () => applyTransferBatch(sampleState(), [transfer({ id: "" })]),
    "INVALID_REQUEST",
  );
  expectCode(
    () => applyTransferBatch(sampleState(), [transfer({ from: "" })]),
    "INVALID_REQUEST",
    "request-id",
  );
});

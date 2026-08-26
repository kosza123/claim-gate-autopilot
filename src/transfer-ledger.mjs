export class TransferError extends Error {
  constructor(code, message, requestId) {
    super(message);
    this.name = "TransferError";
    this.code = code;
    if (requestId !== undefined) this.requestId = requestId;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function ownHas(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function ownGet(obj, key) {
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  return desc === undefined ? undefined : desc.value;
}

function ownSet(obj, key, value) {
  Object.defineProperty(obj, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

function ownKeys(obj) {
  return Object.getOwnPropertyNames(obj).filter((key) => ownHas(obj, key));
}

function fail(code, message, requestId) {
  throw new TransferError(code, message, requestId);
}

function cloneNumberMap(map) {
  const out = Object.create(null);
  for (const key of ownKeys(map)) {
    ownSet(out, key, ownGet(map, key));
  }
  return out;
}

function cloneProcessed(processed) {
  const out = Object.create(null);
  for (const key of ownKeys(processed)) {
    const entry = ownGet(processed, key);
    ownSet(out, key, { ...entry });
  }
  return out;
}

function cloneExtra(value) {
  if (value === null || typeof value !== "object") return value;
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}

function cloneState(state) {
  const next = {};
  for (const key of ownKeys(state)) {
    if (key === "balances" || key === "sentToday" || key === "processed") continue;
    ownSet(next, key, cloneExtra(ownGet(state, key)));
  }
  next.balances = cloneNumberMap(state.balances);
  next.sentToday = cloneNumberMap(state.sentToday);
  next.processed = cloneProcessed(state.processed);
  return next;
}

function assertNumberMap(map, label) {
  if (!isPlainObject(map)) fail("INVALID_STATE", `${label} must be an object`);
  for (const key of ownKeys(map)) {
    const amount = ownGet(map, key);
    if (!isNonEmptyString(key) || !isNonNegativeSafeInteger(amount)) {
      fail("INVALID_STATE", `${label} must use non-empty account names and non-negative safe integers`);
    }
  }
}

function assertState(state) {
  if (!isPlainObject(state)) fail("INVALID_STATE", "state must be an object");
  assertNumberMap(state.balances, "balances");
  assertNumberMap(state.sentToday, "sentToday");
  if (!isPlainObject(state.processed)) fail("INVALID_STATE", "processed must be an object");

  for (const id of ownKeys(state.processed)) {
    const entry = ownGet(state.processed, id);
    if (!isNonEmptyString(id) || !isPlainObject(entry)) {
      fail("INVALID_STATE", "processed entries must be objects keyed by non-empty ids");
    }
    if (
      !isNonEmptyString(entry.from) ||
      !isNonEmptyString(entry.to) ||
      entry.from === entry.to ||
      !isPositiveSafeInteger(entry.amountCents) ||
      !isPositiveSafeInteger(entry.dailyLimitCents)
    ) {
      fail("INVALID_STATE", "processed entry is malformed");
    }
  }
}

function normalizeRequest(request) {
  return {
    from: request.from,
    to: request.to,
    amountCents: request.amountCents,
    dailyLimitCents: request.dailyLimitCents,
  };
}

function sameNormalized(a, b) {
  return (
    a.from === b.from &&
    a.to === b.to &&
    a.amountCents === b.amountCents &&
    a.dailyLimitCents === b.dailyLimitCents
  );
}

function validateRequest(request) {
  if (!isPlainObject(request)) fail("INVALID_REQUEST", "request must be an object");
  const requestId = isNonEmptyString(request.id) ? request.id : undefined;
  if (!isNonEmptyString(request.id) || !isNonEmptyString(request.from) || !isNonEmptyString(request.to)) {
    fail("INVALID_REQUEST", "id, from, and to must be non-empty strings", requestId);
  }
  if (!isPositiveSafeInteger(request.amountCents) || !isPositiveSafeInteger(request.dailyLimitCents)) {
    fail("INVALID_REQUEST", "amountCents and dailyLimitCents must be positive safe integers", requestId);
  }
  if (request.from === request.to) {
    fail("INVALID_REQUEST", "from and to must be different accounts", requestId);
  }
}

function addSafeNonNegative(a, b) {
  if (!isNonNegativeSafeInteger(a) || !isNonNegativeSafeInteger(b)) return null;
  const sum = a + b;
  if (!isNonNegativeSafeInteger(sum)) return null;
  return sum;
}

function subSafeNonNegative(a, b) {
  if (!isNonNegativeSafeInteger(a) || !isNonNegativeSafeInteger(b) || a < b) return null;
  const diff = a - b;
  if (!isNonNegativeSafeInteger(diff)) return null;
  return diff;
}

export function applyTransferBatch(state, requests) {
  assertState(state);
  if (!Array.isArray(requests)) fail("INVALID_REQUEST", "requests must be an array");

  const next = cloneState(state);

  for (const request of requests) {
    validateRequest(request);
    const { id, from, to, amountCents, dailyLimitCents } = request;
    const normalized = normalizeRequest(request);

    if (ownHas(next.processed, id)) {
      const prior = ownGet(next.processed, id);
      if (sameNormalized(prior, normalized)) continue;
      fail("IDEMPOTENCY_CONFLICT", "id already processed with different parameters", id);
    }

    if (!ownHas(next.balances, from) || !ownHas(next.balances, to)) {
      fail("ACCOUNT_NOT_FOUND", "account not found", id);
    }

    const fromBalance = ownGet(next.balances, from);
    const toBalance = ownGet(next.balances, to);
    const nextFromBalance = subSafeNonNegative(fromBalance, amountCents);
    if (nextFromBalance === null) {
      fail("INSUFFICIENT_FUNDS", "insufficient funds", id);
    }

    const sent = ownHas(next.sentToday, from) ? ownGet(next.sentToday, from) : 0;
    const sentAfter = addSafeNonNegative(sent, amountCents);
    if (sentAfter === null) {
      fail("INVALID_REQUEST", "transfer would overflow a safe integer", id);
    }
    if (sentAfter > dailyLimitCents) {
      fail("DAILY_LIMIT_EXCEEDED", "daily limit exceeded", id);
    }

    const nextToBalance = addSafeNonNegative(toBalance, amountCents);
    if (nextToBalance === null) {
      fail("INVALID_REQUEST", "transfer would overflow a safe integer", id);
    }

    ownSet(next.balances, from, nextFromBalance);
    ownSet(next.balances, to, nextToBalance);
    ownSet(next.sentToday, from, sentAfter);
    ownSet(next.processed, id, normalized);
  }

  return next;
}

export class TransferError extends Error {
  constructor(code, message, requestId) {
    super(message);
    this.name = "TransferError";
    this.code = code;
    if (requestId !== undefined) this.requestId = requestId;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function fail(code, message, requestId) {
  throw new TransferError(code, message, requestId);
}

function assertState(state) {
  if (!isPlainObject(state)) fail("INVALID_STATE", "state must be an object");
  if (!isPlainObject(state.balances)) fail("INVALID_STATE", "balances must be an object");
  if (!isPlainObject(state.sentToday)) fail("INVALID_STATE", "sentToday must be an object");
  if (!isPlainObject(state.processed)) fail("INVALID_STATE", "processed must be an object");

  for (const [account, amount] of Object.entries(state.balances)) {
    if (!isNonEmptyString(account) || !isNonNegativeSafeInteger(amount)) {
      fail("INVALID_STATE", "balances must use non-empty account names and non-negative safe integers");
    }
  }
  for (const [account, amount] of Object.entries(state.sentToday)) {
    if (!isNonEmptyString(account) || !isNonNegativeSafeInteger(amount)) {
      fail("INVALID_STATE", "sentToday must use non-empty account names and non-negative safe integers");
    }
  }
  for (const [id, entry] of Object.entries(state.processed)) {
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

function cloneState(state) {
  const processed = {};
  for (const [id, entry] of Object.entries(state.processed)) {
    processed[id] = { ...entry };
  }
  return {
    balances: { ...state.balances },
    sentToday: { ...state.sentToday },
    processed,
  };
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

function hasAccount(balances, account) {
  return Object.prototype.hasOwnProperty.call(balances, account);
}

export function applyTransferBatch(state, requests) {
  assertState(state);
  if (!Array.isArray(requests)) fail("INVALID_REQUEST", "requests must be an array");

  const next = cloneState(state);

  for (const request of requests) {
    validateRequest(request);
    const { id, from, to, amountCents, dailyLimitCents } = request;

    if (!hasAccount(next.balances, from) || !hasAccount(next.balances, to)) {
      fail("ACCOUNT_NOT_FOUND", "account not found", id);
    }

    const normalized = normalizeRequest(request);
    if (Object.prototype.hasOwnProperty.call(next.processed, id)) {
      if (sameNormalized(next.processed[id], normalized)) continue;
      fail("IDEMPOTENCY_CONFLICT", "id already processed with different parameters", id);
    }

    const fromBalance = next.balances[from];
    const toBalance = next.balances[to];
    if (fromBalance < amountCents) {
      fail("INSUFFICIENT_FUNDS", "insufficient funds", id);
    }

    const sent = Object.prototype.hasOwnProperty.call(next.sentToday, from) ? next.sentToday[from] : 0;
    const sentAfter = sent + amountCents;
    if (sentAfter > dailyLimitCents) {
      fail("DAILY_LIMIT_EXCEEDED", "daily limit exceeded", id);
    }

    const nextToBalance = toBalance + amountCents;
    if (!Number.isSafeInteger(nextToBalance) || !Number.isSafeInteger(sentAfter)) {
      fail("INVALID_REQUEST", "transfer would overflow a safe integer", id);
    }

    next.balances[from] = fromBalance - amountCents;
    next.balances[to] = nextToBalance;
    next.sentToday[from] = sentAfter;
    next.processed[id] = normalized;
  }

  return next;
}

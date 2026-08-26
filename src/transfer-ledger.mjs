export class TransferError extends Error {
  constructor(code, message, requestId) {
    super(message);
    this.name = "TransferError";
    this.code = code;
    if (requestId !== undefined) {
      this.requestId = requestId;
    }
  }
}

export function applyTransferBatch(state, requests) {
  assertValidState(state);
  if (!Array.isArray(requests)) {
    fail("INVALID_REQUEST", "requests must be an array");
  }

  const next = cloneState(state);

  for (const request of requests) {
    applyOne(next, request);
  }

  return next;
}

function applyOne(next, request) {
  if (!isPlainObject(request)) {
    fail("INVALID_REQUEST", "request must be an object");
  }

  const { id, from, to, amountCents, dailyLimitCents } = request;

  if (!isNonEmptyString(id) || !isNonEmptyString(from) || !isNonEmptyString(to)) {
    fail("INVALID_REQUEST", "id, from, and to must be non-empty strings", isNonEmptyString(id) ? id : undefined);
  }

  if (!isPositiveSafeInteger(amountCents) || !isPositiveSafeInteger(dailyLimitCents)) {
    fail("INVALID_REQUEST", "amountCents and dailyLimitCents must be positive safe integers", id);
  }

  if (from === to) {
    fail("INVALID_REQUEST", "from and to must be different accounts", id);
  }

  const recorded = next.processed[id];
  if (recorded !== undefined) {
    if (sameTransfer(recorded, { from, to, amountCents, dailyLimitCents })) {
      return;
    }
    fail("IDEMPOTENCY_CONFLICT", "request id was already processed with different parameters", id);
  }

  if (!Object.hasOwn(next.balances, from) || !Object.hasOwn(next.balances, to)) {
    fail("ACCOUNT_NOT_FOUND", "both accounts must exist in balances", id);
  }

  const fromBalance = next.balances[from];
  const toBalance = next.balances[to];
  const sentToday = Object.hasOwn(next.sentToday, from) ? next.sentToday[from] : 0;

  if (fromBalance < amountCents) {
    fail("INSUFFICIENT_FUNDS", "transfer would make sender balance negative", id);
  }

  if (sentToday + amountCents > dailyLimitCents) {
    fail("DAILY_LIMIT_EXCEEDED", "transfer would exceed daily limit", id);
  }

  next.balances[from] = fromBalance - amountCents;
  next.balances[to] = toBalance + amountCents;
  next.sentToday[from] = sentToday + amountCents;
  next.processed[id] = {
    from,
    to,
    amountCents,
    dailyLimitCents,
  };
}

function assertValidState(state) {
  if (!isPlainObject(state)) {
    fail("INVALID_STATE", "state must be an object");
  }

  const { balances, sentToday, processed } = state;
  if (!isPlainObject(balances) || !isPlainObject(sentToday) || !isPlainObject(processed)) {
    fail("INVALID_STATE", "balances, sentToday, and processed must be objects");
  }

  for (const [account, amount] of Object.entries(balances)) {
    if (!isNonEmptyString(account) || !isNonNegativeSafeInteger(amount)) {
      fail("INVALID_STATE", "balances must use non-empty keys and non-negative safe integers");
    }
  }

  for (const [account, amount] of Object.entries(sentToday)) {
    if (!isNonEmptyString(account) || !isNonNegativeSafeInteger(amount)) {
      fail("INVALID_STATE", "sentToday must use non-empty keys and non-negative safe integers");
    }
  }

  for (const [id, entry] of Object.entries(processed)) {
    if (!isNonEmptyString(id) || !isPlainObject(entry)) {
      fail("INVALID_STATE", "processed entries must be objects keyed by non-empty ids");
    }
    if (
      !isNonEmptyString(entry.from) ||
      !isNonEmptyString(entry.to) ||
      !isPositiveSafeInteger(entry.amountCents) ||
      !isPositiveSafeInteger(entry.dailyLimitCents)
    ) {
      fail("INVALID_STATE", "processed entries must be normalized transfers");
    }
  }
}

function cloneState(state) {
  return structuredClone(state);
}

function sameTransfer(recorded, request) {
  return (
    recorded.from === request.from &&
    recorded.to === request.to &&
    recorded.amountCents === request.amountCents &&
    recorded.dailyLimitCents === request.dailyLimitCents
  );
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

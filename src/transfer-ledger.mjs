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

function reject(code, message, requestId) {
  throw new TransferError(code, message, requestId);
}

function assertNonNegativeIntMap(map, label) {
  if (!isPlainObject(map)) {
    reject("INVALID_STATE", `${label} must be an object`);
  }
  for (const [key, value] of Object.entries(map)) {
    if (!isNonNegativeSafeInteger(value)) {
      reject("INVALID_STATE", `${label}.${key} must be a non-negative safe integer`);
    }
  }
}

function requestIdOf(request) {
  return isNonEmptyString(request?.id) ? request.id : undefined;
}

function assertValidRequest(request) {
  if (!isPlainObject(request)) {
    reject("INVALID_REQUEST", "request must be an object");
  }
  const requestId = requestIdOf(request);
  if (!isNonEmptyString(request.id)) {
    reject("INVALID_REQUEST", "id must be a non-empty string", requestId);
  }
  if (!isNonEmptyString(request.from)) {
    reject("INVALID_REQUEST", "from must be a non-empty string", request.id);
  }
  if (!isNonEmptyString(request.to)) {
    reject("INVALID_REQUEST", "to must be a non-empty string", request.id);
  }
  if (!isPositiveSafeInteger(request.amountCents)) {
    reject("INVALID_REQUEST", "amountCents must be a positive safe integer", request.id);
  }
  if (!isPositiveSafeInteger(request.dailyLimitCents)) {
    reject("INVALID_REQUEST", "dailyLimitCents must be a positive safe integer", request.id);
  }
  if (request.from === request.to) {
    reject("INVALID_REQUEST", "from and to must be different accounts", request.id);
  }
}

function payloadsMatch(entry, request) {
  return (
    isPlainObject(entry) &&
    entry.from === request.from &&
    entry.to === request.to &&
    entry.amountCents === request.amountCents &&
    entry.dailyLimitCents === request.dailyLimitCents
  );
}

function normalizedRecord(request) {
  return {
    from: request.from,
    to: request.to,
    amountCents: request.amountCents,
    dailyLimitCents: request.dailyLimitCents,
  };
}

export function applyTransferBatch(state, requests) {
  if (!isPlainObject(state)) {
    reject("INVALID_STATE", "state must be an object");
  }
  assertNonNegativeIntMap(state.balances, "balances");
  if (state.sentToday !== undefined) {
    assertNonNegativeIntMap(state.sentToday, "sentToday");
  }
  if (state.processed !== undefined && !isPlainObject(state.processed)) {
    reject("INVALID_STATE", "processed must be an object");
  }
  if (!Array.isArray(requests)) {
    reject("INVALID_REQUEST", "requests must be an array");
  }

  const next = structuredClone(state);
  if (next.sentToday === undefined) {
    next.sentToday = {};
  }
  if (next.processed === undefined) {
    next.processed = {};
  }

  for (const request of requests) {
    assertValidRequest(request);

    if (Object.hasOwn(next.processed, request.id)) {
      if (payloadsMatch(next.processed[request.id], request)) {
        continue;
      }
      reject("IDEMPOTENCY_CONFLICT", "processed id has different parameters", request.id);
    }

    if (!Object.hasOwn(next.balances, request.from) || !Object.hasOwn(next.balances, request.to)) {
      reject("ACCOUNT_NOT_FOUND", "account not found", request.id);
    }

    const fromBalance = next.balances[request.from];
    const toBalance = next.balances[request.to];
    const sentToday = Object.hasOwn(next.sentToday, request.from) ? next.sentToday[request.from] : 0;

    if (fromBalance < request.amountCents) {
      reject("INSUFFICIENT_FUNDS", "insufficient funds", request.id);
    }

    const nextSentToday = sentToday + request.amountCents;
    if (nextSentToday > request.dailyLimitCents) {
      reject("DAILY_LIMIT_EXCEEDED", "daily limit exceeded", request.id);
    }

    const nextFrom = fromBalance - request.amountCents;
    const nextTo = toBalance + request.amountCents;
    if (!isNonNegativeSafeInteger(nextFrom) || !isNonNegativeSafeInteger(nextTo) || !isNonNegativeSafeInteger(nextSentToday)) {
      reject("INVALID_STATE", "transfer would leave a non-safe integer balance", request.id);
    }

    next.balances[request.from] = nextFrom;
    next.balances[request.to] = nextTo;
    next.sentToday[request.from] = nextSentToday;
    next.processed[request.id] = normalizedRecord(request);
  }

  return next;
}

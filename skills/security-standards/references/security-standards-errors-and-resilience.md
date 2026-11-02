# Security boundaries: errors and resilience

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 12 - Error Handling (OWASP ASVS V7)

Rules:
- Fail safely: on error, deny access rather than fail open.
- Never expose stack traces to external clients in any environment.
- Never expose internal paths, library names, or version numbers in errors.
- Use a consistent error contract for all API responses.
- Distinguish client errors (4xx) from server errors (5xx): never 200 with error body.
- Log server errors (5xx) with full context internally; return sanitized message externally.
- Use structured error types throughout; never throw raw strings.

```ts
// Consistent error response shape
interface ApiErrorResponse {
  error:   string;           // safe to show in UI
  code?:   string;           // machine-readable: "VALIDATION_FAILED"
  issues?: Record<string, string[]>;  // field errors for 400
  traceId: string;           // correlation ID for internal lookup
}

// Global error handler
function globalErrorHandler(err, req, res, _next) {
  const traceId = req.traceId ?? crypto.randomUUID();
  if (err instanceof ApiError) {
    logger.warn({ err, traceId }, 'Client error');
    return res.status(err.status).json({ error: err.message, code: err.code, traceId });
  }
  logger.error({ err, traceId, url: req.url, method: req.method }, 'Unhandled error');
  return res.status(500).json({
    error: 'An unexpected error occurred. Please try again.',
    traceId,
    // Never include: err.stack, err.message (may contain internals)
  });
}
```

---

## 13 - Logging and Auditing (OWASP ASVS V7)

Rules:
- Use structured logging (JSON output) - never printf-style for production.
- Include a correlation/trace ID on every log line for a given request.
- Log all security events (see table below).
- Never log: passwords, tokens, secrets, full credit card numbers, raw PII.
- DEBUG off in production; INFO for normal operations; WARN for recoverable; ERROR for failures.
- Protect log integrity - ship to an external system; tamper-evident.
- Define and enforce log retention (90 days hot, 1 year archive typical).

Security events that MUST be logged:

| Event | Level | Fields |
|-------|-------|--------|
| Authentication success | INFO | userId, ip, userAgent, timestamp |
| Authentication failure | WARN | email (partial), ip, reason, timestamp |
| Account lockout | WARN | userId, ip, timestamp |
| Credential change | INFO | userId, changedBy, timestamp |
| Authorization failure | WARN | userId, resource, action, timestamp |
| Admin actions | INFO | actorId, targetId, action, timestamp |
| Session creation/destruction | INFO | userId, sessionId (hashed), timestamp |
| Data export / bulk access | INFO | userId, recordCount, timestamp |
| Dependency vulnerability | WARN | package, version, cve, timestamp |

```ts
// Structured logger with secret redaction (pino)
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.token', '*.secret'],
    censor: '[REDACTED]',
  },
});
```

---

## 14 - Resilience (OWASP ASVS V12)

Rules:
- Set timeouts on ALL outbound network calls (HTTP, DB, cache, queue). No indefinite blocks.
- Implement bounded retries with exponential backoff + jitter. Cap at 3-5 retries.
- Use a circuit breaker for non-critical external service calls.
- Design all state-changing operations to be idempotent where possible.
- Apply resource limits: max request body size, max upload size, max query result size.
- Graceful degradation: if a non-critical dependency fails, return partial results, not 500.
- Protect against retry storms: use jitter; back off on 429/503 responses.

```ts
// Retry with exponential backoff and jitter
async function withRetry(fn, maxAttempts = 3, baseDelayMs = 500) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      const jitter = Math.random() * baseDelayMs;
      const delay  = baseDelayMs * 2 ** (attempt - 1) + jitter;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
```

---

## 15 - Concurrency

Rules:
- Define explicit transaction boundaries for all multi-step data operations.
- Use SELECT FOR UPDATE (or equivalent) when reading before writing in a transaction.
- Design operations to be idempotent - safe to call multiple times with the same result.
- Use atomic DB operations (upsert, compare-and-swap) over read-modify-write.
- Use distributed locks (Redis SETNX / Redlock) for critical sections across multiple instances.
- Test concurrent scenarios explicitly; race condition tests in the test suite.

```ts
// Idempotency key pattern for mutation endpoints
export async function processPayment(req, res) {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required' });
  }
  const existing = await cache.get(`idem:${idempotencyKey}`);
  if (existing) return res.status(200).json(JSON.parse(existing));
  const result = await paymentService.process(req.body);
  await cache.set(`idem:${idempotencyKey}`, JSON.stringify(result), 'EX', 86400);
  return res.status(201).json(result);
}
```

---

## 16 - Performance

Rules:
- Detect and eliminate N+1 queries before shipping (use query logging in development).
- Paginate all list endpoints; enforce a maximum page size (default 100).
- Never load unbounded data into memory - stream or paginate large datasets.
- Set response body size limits for uploads and API responses.
- Avoid synchronous CPU-bound work in the event loop (Node.js) - offload to workers.
- Use database indexes for all query predicates and sort keys.
- Cache expensive, read-heavy queries with appropriate TTLs and invalidation strategy.
- Performance optimizations must never bypass security controls or input validation.
- Profile before optimizing - measure, never guess.

```ts
// Bad - N+1 query
const projects = await db.projects.findMany({ where: { teamId } });
for (const project of projects) {
  project.owner = await db.users.findOne({ id: project.ownerId }); // N queries
}

// Good - single query with join
const projects = await db.projects.findMany({
  where: { teamId },
  include: { owner: true },
});
```

---

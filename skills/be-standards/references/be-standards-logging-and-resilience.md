# Backend changes: logging and resilience

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 11 - Structured Logging

```ts
// src/lib/logger.ts
import pino from 'pino';
import { config } from './config';

/**
 * Application-wide structured logger.
 * Redacts secrets automatically. Use req.log (pino-http) in middleware.
 * Never log passwords, tokens, raw PII, or full request/response bodies.
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.secret',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});
```

### Correlation ID middleware

```ts
// src/lib/middleware/trace.ts
import { randomUUID }      from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Injects a unique trace ID into every request.
 * Reads X-Request-ID header if provided (for upstream propagation).
 * Attaches traceId to req and response header.
 */
export function traceMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.traceId = (req.headers['x-request-id'] as string) ?? randomUUID();
  res.setHeader('X-Request-ID', req.traceId);
  next();
}
```

---

## 16 - Resilience Patterns

See security-standards section 14 for full rules. Backend-specific additions:

```ts
// HTTP client with timeout and retry (using ky or axios)
import ky from 'ky';

export const httpClient = ky.create({
  timeout:    10_000,       // 10s timeout on all requests
  retry: {
    limit:    3,
    methods:  ['get', 'head'],          // only retry idempotent methods
    statusCodes: [408, 429, 502, 503, 504],
    backoffLimit: 10_000,
    afterStatusCodes: [429],            // respect Retry-After on 429
  },
  hooks: {
    beforeRetry: [({ error, retryCount }) => {
      logger.warn({ error, retryCount }, 'HTTP request retrying');
    }],
  },
});
```

Database query timeout (Prisma):

```ts
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';
export const db = new PrismaClient({
  log: ['warn', 'error'],
  // Set statement_timeout per query in Postgres
});

// For long-running queries, set per-transaction:
await db.$transaction([...], { timeout: 5_000 }); // 5s max
```

### Durable jobs and event delivery

Use these rules when work must survive process failure or may be delivered again. Reuse the installed queue, scheduler, or database; a simple synchronous operation does not need messaging infrastructure.

- **Commit before acknowledgment:** Validate the message and its tenant or authority before acting. Acknowledge or delete it only after the domain changes and durable completion record commit. A worker can crash after commit but before acknowledgment, so redelivery must remain safe.
- **Make effects idempotent:** Use a stable job/event identifier scoped to its operation and tenant. Atomically record a consumed event with its database mutation using a unique constraint. For external effects, reuse that identifier with the provider's idempotency mechanism or reconcile an uncertain outcome before retrying. A queue acknowledgment or lock alone does not provide exactly-once effects.
- **Recover abandoned work:** Use the queue's visibility timeout or a database lease with an expiry and unique claim token. Reclaim expired work after a crash; renew leases only while the worker still owns the claim. Completion and renewal must compare that token so an expired worker cannot complete another worker's claim. A lease cannot stop an already-running external side effect, which still needs idempotency or fencing supported by that resource.
- **Bound retries and failed work:** Retry transient failures with capped backoff and jitter. Route invalid or repeatedly failing messages to the existing dead-letter queue or durable failed-job state after a bounded attempt count. Preserve the failure reason and event identifier without secrets; expose an explicit inspection and replay path. Replay preserves the effect identifier. Stop claiming work during shutdown and finish or release owned work within the shutdown budget.
- **Keep delivery contracts explicit:** If order matters for an entity, use the existing partition/order key or compare event versions to reject stale transitions. Track oldest pending age, retry counts, abandoned leases, and terminal failures so silently stalled work is visible.

#### When a transactional outbox is needed

If one domain operation must both update the database and publish an event, separate writes leave a crash window: the data may commit while publication fails. Store the domain change and an outbox row in the same database transaction. An existing worker or scheduler publishes pending rows outside that transaction and marks them delivered only after publication is confirmed. A crash between publication and marking can publish twice, so consumers still deduplicate by event ID. Retain the required per-entity order, bound retries, and give failed delivery an inspection/replay path.

Use this pattern only for that consistency requirement; do not add a broker, event bus, or distributed transaction merely to match the example. If the existing system already provides atomic persistence/publication or the task permits best-effort notification, preserve that decision and state its failure behavior.

#### Failure checks

Exercise the relevant cases against an isolated queue/database or a deterministic fault-injection test: crash before commit, crash after commit before acknowledgment, duplicate delivery, an expired claim resumed after another worker reclaimed it, and a permanently invalid message. For an outbox, also interrupt publication before and after broker confirmation. Assert persisted outcomes and effect counts, including recovery; a successful enqueue call does not prove the work completed.

References: [transactional outbox trade-offs](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) and [visibility timeouts and recovery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html). These describe the failure semantics; adapt them to the installed queue or database.

---

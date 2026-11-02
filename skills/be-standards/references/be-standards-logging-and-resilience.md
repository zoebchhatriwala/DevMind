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

---

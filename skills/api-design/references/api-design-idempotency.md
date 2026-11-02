# API contracts: idempotency

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 4 - Idempotency & Safe Retries (`Idempotency-Key`)

Clients on mobile or unreliable networks frequently retry `POST` requests when a network timeout occurs, risking duplicate charges or double orders.

### 4.1 IETF Idempotency-Key Standard Workflow

```
Client                                      API Server / Redis
  |                                                  |
  |-- 1. POST /api/v1/payments --------------------->|
  |      (Idempotency-Key: d4a3-48b1)                |-- 2. Atomic check in Redis:
  |                                                  |      SET lock:d4a3-48b1 "PROCESSING" NX EX 120
  |                                                  |-- 3. Lock acquired: Execute payment logic
  |                                                  |-- 4. Store final status & body in Redis (24h)
  |<-- 5. 201 Created (Payment DTO) -----------------|
  |                                                  |
  |-- 6. Network drops! Client retries: ------------>|
  |      POST /api/v1/payments                       |-- 7. Key exists with cached response!
  |      (Idempotency-Key: d4a3-48b1)                |-- 8. Bypass business logic completely
  |<-- 9. 201 Created (Cached response replayed) ---|
```

### 4.2 Production Idempotency Middleware Implementation

```typescript
// src/presentation/http/middleware/idempotency.ts
import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../../../infrastructure/cache/redis';

export function idempotencyMiddleware(ttlSeconds = 86400) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only apply to mutating requests with an Idempotency-Key header
    const key = req.headers['idempotency-key'] as string;
    if (!key || req.method !== 'POST') {
      return next();
    }

    const redisKey = `idempotency:${req.user?.id || 'anon'}:${key}`;

    // 1. Check if cached response exists
    const cached = await redisClient.get(redisKey);
    if (cached) {
      if (cached === 'PROCESSING') {
        // Request currently executing in another concurrent thread
        return res.status(409).json({
          title: 'Conflict',
          detail: 'A request with this idempotency key is actively being processed. Please retry in a few seconds.',
          retry_after: 2,
        });
      }

      // Replay cached response
      const { statusCode, headers, body } = JSON.parse(cached);
      res.set(headers);
      res.set('X-Cache-Lookup', 'HIT-IDEMPOTENT');
      return res.status(statusCode).send(body);
    }

    // 2. Acquire lock (NX = only set if not exists, EX = auto-expire in 2 minutes if crash occurs)
    const acquired = await redisClient.set(redisKey, 'PROCESSING', 'EX', 120, 'NX');
    if (!acquired) {
      return res.status(409).json({
        title: 'Conflict',
        detail: 'Concurrent request detected for this idempotency key.',
      });
    }

    // 3. Intercept response to cache on completion
    const originalSend = res.send.bind(res);
    res.send = (body: any) => {
      // Restore original send
      const result = originalSend(body);

      // Only cache successful or client validation outcomes (2xx, 4xx)
      if (res.statusCode < 500) {
        const payloadToCache = {
          statusCode: res.statusCode,
          headers: { 'content-type': res.get('content-type') },
          body: body.toString(),
        };
        redisClient.set(redisKey, JSON.stringify(payloadToCache), 'EX', ttlSeconds).catch(console.error);
      } else {
        // Server crashed: delete key so client can retry cleanly
        redisClient.del(redisKey).catch(console.error);
      }

      return result;
    };

    next();
  };
}
```

---

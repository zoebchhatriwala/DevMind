# API contracts: caching

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 6 - HTTP Caching, ETags & Conditional Requests

Every read-heavy API endpoint should support conditional HTTP requests to conserve bandwidth and minimize server compute.

```
Client                                                  API Gateway
  |                                                          |
  |-- 1. GET /api/v1/users/me ------------------------------>|
  |<-- 2. 200 OK (Body: {...}, ETag: W/"4f8a-9812") --------| (Stores ETag in local cache)
  |                                                          |
  |-- 3. GET /api/v1/users/me ------------------------------>|
  |      If-None-Match: W/"4f8a-9812"                        |-- 4. Calculate hash: unchanged!
  |<-- 5. 304 Not Modified (ZERO BODY) ---------------------| (Fastest possible response)
```

```typescript
// src/presentation/http/middleware/etag.ts
import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

export function weakEtagMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  const originalSend = res.send.bind(res);
  res.send = (body: any) => {
    if (res.statusCode === 200 && typeof body === 'string') {
      const hash = crypto.createHash('sha1').update(body).digest('hex');
      const etag = `W/"${hash.substring(0, 16)}"`;
      res.setHeader('ETag', etag);

      if (req.headers['if-none-match'] === etag) {
        res.status(304);
        return originalSend('');
      }
    }
    return originalSend(body);
  };

  next();
}
```

---

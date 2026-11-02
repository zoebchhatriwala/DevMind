# Authentication and authorization: session hardening

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 5 - Token & Session Security Hardening

### 5.1 Cookie Security Attributes

When setting session IDs or refresh tokens in cookies, you must apply all five defensive flags:

```typescript
// Production cookie configuration options
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,                                         // Blocks document.cookie access from JavaScript (mitigates XSS)
  secure: process.env.NODE_ENV === 'production',          // Transmitted exclusively over HTTPS
  sameSite: 'lax' as const,                              // Mitigates CSRF for cross-origin POST requests
  path: '/',                                             // Scope to root
  maxAge: 1000 * 60 * 60 * 24 * 14,                      // 14 days in milliseconds
};
```

### 5.2 Cross-Site Request Forgery (CSRF) Defense

Even with `SameSite=Lax`, top-level GET navigations and certain cross-origin forms can send cookies.
1. **Rule of Idempotent GET**: GET, HEAD, and OPTIONS requests **must never** modify state or execute business logic.
2. **Double-Submit Cookie / Header Verification**:
   Require a non-simple custom HTTP header (e.g., `X-Requested-With: XMLHttpRequest` or `X-CSRF-Token`) on all state-modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`). Browsers prevent cross-origin HTML forms from attaching custom headers without explicit CORS preflight clearance.

```typescript
// src/presentation/http/middleware/csrf-check.ts
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../../domain/errors/app-errors';

export function verifyCsrfHeader(req: Request, res: Response, next: NextFunction) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Modern browsers: check origin or referer matches server origin
  const origin = req.headers['origin'];
  const host = req.headers['host'];

  if (origin && !origin.includes(host!)) {
    throw new ForbiddenError('Cross-origin request blocked');
  }

  next();
}
```

### 5.3 Global Session Revocation ("Log Out All Devices")

Users must be able to terminate all active sessions if their account is compromised:

```typescript
// src/application/services/session.service.ts
export class SessionService {
  // Option A: Stateful sessions (Deletes all session records for this user)
  static async revokeAllUserSessions(userId: string): Promise<void> {
    await db.delete(userSessions).where(eq(userSessions.userId, userId));
  }

  // Option B: Stateless JWT (Increment token_version on user record)
  // Access tokens include tokenVersion in payload. If token.version !== db.user.tokenVersion, reject immediately!
  static async invalidateAllJwtTokens(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId));
  }
}
```

---

# Backend changes: auth and security

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 9 - Authentication Middleware

```ts
// src/lib/middleware/auth.ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config }          from '@/lib/config';
import { UnauthorizedError } from '@/lib/errors';
import { usersRepository } from '@/features/users/users.repository';

/**
 * Verifies the Bearer token from the Authorization header.
 * Attaches the authenticated user to req.user.
 * Throws UnauthorizedError if the token is missing, expired, or invalid.
 */
export async function authenticate(
  req:  Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError());
  }

  const token = header.slice(7);
  let payload: { sub: string; iat: number; exp: number };

  try {
    payload = jwt.verify(token, config.JWT_SECRET) as typeof payload;
  } catch {
    return next(new UnauthorizedError('Invalid or expired token.'));
  }

  const user = await usersRepository.findById(payload.sub);
  if (!user) return next(new UnauthorizedError());

  req.user = user;
  next();
}
```

### Authorization middleware factory

```ts
// src/lib/middleware/authorize.ts
import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@/features/users/users.types';
import { ForbiddenError } from '@/lib/errors';
import { logger }         from '@/lib/logger';

/**
 * Middleware factory  -  restricts a route to users with one of the given roles.
 * Must be called after authenticate middleware.
 *
 * @example
 * router.delete('/:id', authenticate, authorize('admin'), controller.remove);
 */
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ForbiddenError());

    if (!roles.includes(req.user.role)) {
      logger.warn(
        { userId: req.user.id, requiredRoles: roles, actualRole: req.user.role },
        'Authorization denied',
      );
      return next(new ForbiddenError());
    }

    next();
  };
}
```

---

## 18 - Security (references security-standards)

> Read the relevant security-standards topic only. This section lists the
> backend-specific controls to verify before shipping.

Backend security checklist:
- [ ] All endpoints in this feature are authenticated (authenticate middleware applied)
- [ ] Authorization applied at the role level (authorize middleware)
- [ ] Object-level ownership checked in the service layer (IDOR prevention)
- [ ] Validation middleware applied to body, query, and params on all routes
- [ ] All DB queries are parameterized (no string interpolation of user data)
- [ ] Response DTOs are explicit allowlists (no full ORM object serialization)
- [ ] Rate limiting applied to sensitive endpoints (auth, password reset, email send)
- [ ] Error handler returns sanitized messages  -  no stack traces or internal paths
- [ ] All security events logged (auth failure, authz denial, sensitive data access)
- [ ] No secrets in code or committed env files; config validated from environment
- [ ] npm audit passes  -  no high or critical findings
- [ ] SAST scan passes  -  no new high-severity findings
- [ ] security-standards Master Security Checklist reviewed

---

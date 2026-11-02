# Backend changes: http and errors

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 5 - Routing and Controllers

### Router pattern

```ts
// src/features/users/users.router.ts
import { Router } from 'express';
import { authenticate } from '@/lib/middleware/auth';
import { authorize }    from '@/lib/middleware/authorize';
import { validate }     from '@/lib/middleware/validate';
import { rateLimiter }  from '@/lib/middleware/rate-limit';
import {
  CreateUserSchema,
  UpdateUserSchema,
  GetUserParamsSchema,
  ListUsersQuerySchema,
} from './users.schema';
import * as usersController from './users.controller';

export const usersRouter = Router();

usersRouter.get(
  '/',
  authenticate,
  authorize('admin', 'member'),
  validate('query', ListUsersQuerySchema),
  usersController.list,
);

usersRouter.post(
  '/',
  authenticate,
  authorize('admin'),
  rateLimiter({ max: 20, windowMs: 60_000 }),
  validate('body', CreateUserSchema),
  usersController.create,
);

usersRouter.get(
  '/:id',
  authenticate,
  validate('params', GetUserParamsSchema),
  usersController.getById,
);

usersRouter.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validate('params', GetUserParamsSchema),
  validate('body', UpdateUserSchema),
  usersController.update,
);

usersRouter.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  validate('params', GetUserParamsSchema),
  usersController.remove,
);
```

### Controller pattern

Controllers have exactly one job: parse the validated request, call the service, and shape the HTTP response.

```ts
// src/features/users/users.controller.ts
import type { Request, Response } from 'express';
import { usersService } from './users.service';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.schema';

/**
 * GET /api/v1/users
 * Returns a paginated list of users, optionally filtered by role or search term.
 */
export async function list(req: Request, res: Response): Promise<void> {
  const query  = req.query as unknown as ListUsersQuery;
  const result = await usersService.list(query);
  res.json(result);
}

/**
 * POST /api/v1/users
 * Creates a new user. Admin only.
 */
export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateUserInput;
  const user  = await usersService.create(input, req.user!.id);
  res.status(201).json(user);
}

/**
 * GET /api/v1/users/:id
 * Fetches a single user by ID. Enforces object-level ownership.
 */
export async function getById(req: Request, res: Response): Promise<void> {
  const user = await usersService.findById(req.params.id, req.user!);
  res.json(user);
}

/**
 * PATCH /api/v1/users/:id
 * Partially updates a user. Admin only.
 */
export async function update(req: Request, res: Response): Promise<void> {
  const input = req.body as UpdateUserInput;
  const user  = await usersService.update(req.params.id, input, req.user!);
  res.json(user);
}

/**
 * DELETE /api/v1/users/:id
 * Soft-deletes a user. Admin only.
 */
export async function remove(req: Request, res: Response): Promise<void> {
  await usersService.remove(req.params.id, req.user!);
  res.status(204).end();
}
```

---

## 8 - Typed Error System

Define a typed error hierarchy. The global error handler translates these into
consistent HTTP responses.

```ts
// src/lib/errors.ts

/** Base class for all application errors. */
export class AppError extends Error {
  constructor(
    public readonly code:    string,
    message:                 string,
    public readonly status:  number,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError    extends AppError {
  constructor(message = 'Resource not found.') {
    super('NOT_FOUND', message, 404);
  }
}

export class ConflictError    extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class ForbiddenError   extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super('FORBIDDEN', message, 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ValidationError  extends AppError {
  constructor(
    message:  string,
    public readonly issues: Record<string, string[]>,
  ) {
    super('VALIDATION_FAILED', message, 400);
  }
}

export class BusinessError    extends AppError {
  constructor(message: string) {
    super('BUSINESS_RULE_VIOLATION', message, 422);
  }
}
```

### Global error handler

```ts
// src/lib/middleware/error-handler.ts
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@/lib/errors';
import { logger }   from '@/lib/logger';

/**
 * Global Express error handler. Must be registered LAST in the middleware chain.
 * Translates AppError instances to structured HTTP responses.
 * Unknown errors are logged fully internally; clients receive a sanitized message.
 */
export function globalErrorHandler(
  err:  unknown,
  req:  Request,
  res:  Response,
  _next: NextFunction,
): void {
  const traceId = req.traceId;

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, traceId }, 'Application error');
    } else {
      logger.warn({ err, traceId }, 'Client error');
    }

    res.status(err.status).json({
      error:   err.message,
      code:    err.code,
      traceId,
      ...(err instanceof ValidationError ? { issues: err.issues } : {}),
    });
    return;
  }

  // Unexpected error  -  log everything; return nothing internal to the client
  logger.error({ err, traceId, url: req.url, method: req.method }, 'Unhandled error');
  res.status(500).json({
    error:   'An unexpected error occurred. Please try again or contact support if the issue persists.',
    traceId,
  });
}
```

### Client-Safe Error Messages (No Leaks, No Jargon, Human Tone)

Every error `message` returned to API clients must be written in **human, natural, respectful English** with zero exposure of internal database tables, ORM details, SQL syntax, or internal service names.

| Error Scenario | [NO] Leaky / Jargon Error | [YES] Client-Safe Human Error |
|----------------|---------------------------|-------------------------------|
| **Duplicate Key** | `duplicate key value violates unique constraint "users_email_key"` | `An account with this email address already exists.` |
| **Foreign Key Failure** | `violates foreign key constraint "fk_org_id" on table "orgs"` | `The selected organization could not be found or is inactive.` |
| **Record Missing** | `Entity User with id 48a29b not found in repository` | `We couldn't find the requested user profile.` |
| **Validation Issue** | `body.postal_code does not match regex ^[0-9]{5}$` | `Please enter a valid 5-digit ZIP or postal code.` |
| **Auth Failure** | `jwt expired at 1728882000, verify() failed` | `Your session has expired. Please sign in again to continue.` |
| **Unhandled / 500** | `TypeError: Cannot read properties of undefined (reading 'tier')` | `An unexpected error occurred. Please try again or contact support if the issue persists.` |

- **Log everything internally**: Log the raw exception, SQL query, stack trace, and context with `traceId` via the structured logger.
- **Return only sanitized copy**: Clients only ever receive the human-friendly string and `traceId`.

---

## 14 - OpenAPI Documentation

Every API must have an OpenAPI 3.x specification. Generate it from Zod schemas.

```ts
// src/openapi/registry.ts
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
export const registry = new OpenAPIRegistry();

// src/features/users/users.openapi.ts
import { registry }       from '@/openapi/registry';
import { z }              from 'zod';
import { CreateUserSchema, ListUsersQuerySchema } from './users.schema';

registry.registerPath({
  method:      'post',
  path:        '/api/v1/users',
  summary:     'Create a user',
  description: 'Creates a new user account. Admin only.',
  tags:        ['Users'],
  security:    [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateUserSchema } },
    },
  },
  responses: {
    201: {
      description: 'User created successfully.',
      content: { 'application/json': { schema: UserDtoSchema } },
    },
    400: { description: 'Validation failed.' },
    401: { description: 'Authentication required.' },
    403: { description: 'Admin role required.' },
    409: { description: 'Email already registered.' },
  },
});
```

Rules:
- Every endpoint has an OpenAPI entry: summary, description, request schema, all response codes.
- Security scheme declared for all authenticated endpoints.
- Spec served at GET /api/openapi.json (or /api/docs with Swagger UI).
- Contract tests verify the spec matches actual behaviour (Dredd or Schemathesis).

---

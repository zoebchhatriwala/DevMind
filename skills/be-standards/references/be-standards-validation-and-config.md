# Backend changes: validation and config

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 3 - Configuration (fail fast)

```ts
// src/lib/config.ts
import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV:        z.enum(['development', 'test', 'production']),
  PORT:            z.coerce.number().int().positive().default(3000),
  DATABASE_URL:    z.string().url(),
  JWT_SECRET:      z.string().min(32),
  JWT_EXPIRES_IN:  z.string().default('15m'),
  REDIS_URL:       z.string().url().optional(),
  LOG_LEVEL:       z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ALLOWED_ORIGINS: z.string().transform((s) => s.split(',')),
  // Add all required env vars here  -  never access process.env directly elsewhere
});

/**
 * Validated application configuration.
 * Crashes at startup if any required variable is missing or malformed.
 * Import this instead of process.env throughout the codebase.
 */
export const config = ConfigSchema.parse(process.env);
export type Config = z.infer<typeof ConfigSchema>;
```

> Never read process.env outside this file. Import config everywhere else.

---

## 4 - Validation (Zod at every entry point)

Every request that enters a handler must be validated before any business logic runs.

### Schema file pattern

```ts
// src/features/users/users.schema.ts
import { z } from 'zod';
import { PaginationQuerySchema } from '@/lib/schemas/pagination.schema';

// ---- Request schemas ----

export const CreateUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name:  z.string().min(1).max(100).trim(),
  role:  z.enum(['admin', 'member', 'viewer']).default('member'),
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({ email: true });

export const GetUserParamsSchema = z.object({
  id: z.string().uuid(),
});

export const ListUsersQuerySchema = PaginationQuerySchema.extend({
  role:   z.enum(['admin', 'member', 'viewer']).optional(),
  search: z.string().max(100).optional(),
});

// ---- Inferred types ----

export type CreateUserInput  = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput  = z.infer<typeof UpdateUserSchema>;
export type GetUserParams    = z.infer<typeof GetUserParamsSchema>;
export type ListUsersQuery   = z.infer<typeof ListUsersQuerySchema>;
```

### Validation middleware factory

```ts
// src/lib/middleware/validate.ts
import { type AnyZodObject, ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Factory that returns a middleware validating the given request part
 * against a Zod schema. Returns 400 with field-level errors on failure.
 *
 * @example
 * router.post('/', validate('body', CreateUserSchema), usersController.create);
 */
export function validate(part: RequestPart, schema: AnyZodObject) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return res.status(400).json({
        error:   'Validation failed',
        code:    'VALIDATION_FAILED',
        issues:  result.error.flatten().fieldErrors,
        traceId: req.traceId,
      });
    }
    req[part] = result.data; // replace with parsed + coerced data
    next();
  };
}
```

---

---
name: be-standards
description: >-
  MANDATORY TRIGGER: Invoke BEFORE writing or refactoring backend services, business logic, background jobs, queues, caching, logging, dependency injection, or server error handling.
  Keywords & Triggers: backend, server, Express, Fastify, NestJS, Hono, Node.js, Bun, Deno, REST API service, business logic, service layer, controller, repository, dependency injection, background jobs, worker, BullMQ, queues, Redis cache, caching, cache invalidation, structured logging, Pino logger, request ID, correlation ID, error handling, AppError, try catch, server error, collection pagination, Zod DTO validation, backend architecture, backend refactor.
  File globs: **/*.{ts,js,mjs,cjs,go,py,rs}
trigger: model_decision
---

# be-standards: Backend Engineering Protocol

> **Scope**: Any Node.js / Bun / Deno backend  -  REST, GraphQL, tRPC, or background workers.  
> **Security & Database Delegation**: Deep database schema & migration rules delegate to `db-standards`; cryptographic and identity controls reference `security-standards` and `auth-patterns`.  
> **Core Principle**: Enforce strict separation of concerns, zero `any` types, runtime validation at boundaries, structured logging, and robust typed error handling.

---

## 🚨 Pre-Flight Gate (Read Before Coding)

Before authoring or modifying any backend service, controller, repository, or worker, verify these 5 non-negotiable gates:

1. **Strict TypeScript (Zero `any`)**: No raw `any` types, implicit anys, or `@ts-ignore` comments. External payloads (`req.body`, `req.query`, `req.params`) MUST be validated at runtime with Zod schemas before touching service logic.
2. **Clean Layered Architecture (No Speculative Bloat)**:
   - **Controllers**: HTTP transport only (status codes, headers, cookie setting). NEVER query databases directly or run business logic here.
   - **Services**: Pure business logic, framework-agnostic. NEVER import Express/Fastify `req` or `res`.
   - **Repositories**: Data access and ORM queries only. Services consume repositories via dependency injection.
   - **Simplicity Invariant**: Avoid single-implementation interfaces or empty wrapper repositories for basic CRUD (Rule of Three). Direct ORM queries inside services are acceptable until multiple storage engines or unit test mocking requirements justify an explicit abstraction.
   - **Modern Framework Idioms**: In fullstack & serverless frameworks (Next.js Server Actions, Remix/React Router actions, Hono RPC, tRPC), colocated typed handlers with direct Zod validation + ORM/query calls are the idiomatic first choice. Do not artificially introduce Controller/Service/Repository classes when framework primitives already isolate execution.
3. **Structured Pino Logging with Redaction**: NEVER use `console.log` in backend code. Emit structured JSON via `pino` with request correlation IDs (`reqId`). Configure `pino.redact` to scrub sensitive fields (`password`, `authorization`, `creditCard`).
4. **Centralized RFC 7807 Error Handling**: Throw typed domain exceptions (`AppError`, `NotFoundError`, `UnauthorizedError`). Catch globally in error middleware and format as client-safe RFC 7807 Problem Details. Never leak raw SQL errors or stack traces to clients.
5. **Bounded Queries & Pagination**: Every endpoint or query returning a dynamic list MUST enforce pagination (offset or cursor) and filtering. Unbounded queries are prohibited.

### Operational Modes:
- **Mode A: Greenfield / New Service Scaffolding**: Run the Section 0 Backend Stack Alignment Checklist below in a single friendly turn.
- **Mode B: Incremental Modification / Patch**: **DO NOT** ask the interview questionnaire. Automatically detect runtime, ORM, and framework conventions. Enforce all 5 pre-flight gates directly.

---

## ⚡ Golden Patterns (DO vs. DON'T)

### 1. Clean Layering vs. Fat Controller
```ts
// ❌ [DON'T] Direct database queries and business logic inside the HTTP route
app.post('/api/users', async (req, res) => {
  const existing = await db.query('SELECT * FROM users WHERE email = $1', [req.body.email]);
  if (existing.rows.length) return res.status(400).send('Email taken');
  const user = await db.query('INSERT INTO users ...');
  res.json(user);
});

// ✅ [DO] Controller -> Service -> Repository with DTO validation
export class UserController {
  constructor(private userService: UserService) {}

  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = CreateUserSchema.parse(req.body);
      const user = await this.userService.register(dto);
      res.status(201).json(UserResponseDto.from(user));
    } catch (err) {
      next(err);
    }
  }
}
```

### 2. Structured Logging vs. console.log / Log Theater
```ts
// ❌ [DON'T] Bare console.log leaking PII, or performative prompt/log theater
console.log('User created:', user);
logger.info('Engaging deep thinking pipeline phase 1 with zero data loss');

// ✅ [DO] Structured Pino logging with correlation ID and domain event
logger.info({
  event: 'user_registered',
  userId: user.id,
  reqId: req.id,
}, 'User account created');
```

### 3. Runtime Input Validation
```ts
// ❌ [DON'T] Blindly trust req.body with type assertion
const data = req.body as CreateUserInput; // Unsafe at runtime!

// ✅ [DO] Parse and strip untrusted properties with Zod
const validated = CreateUserSchema.parse(req.body);
```

---

## 🔍 Anti-Amnesia Receipt

Whenever applying `be-standards`, the coding agent **MUST** output a 1-line verification receipt at the end of its response:

`🧠 [DevMind: be-standards applied | Checked: <top 3 rules verified>]`

*Example:* `🧠 [DevMind: be-standards applied | Checked: Clean architecture layers, Zod validation, Pino structured logging]`

---

## 0 - Before You Write: Architecture Interview

### Backend Stack Alignment Checklist

| # | Topic | ASK |
|---|-------|-----|
| 1 | Runtime | Node.js (LTS), Bun, or Deno? |
| 2 | Framework | Express, Fastify, NestJS, Hono, or other? |
| 3 | Language | TypeScript (strict)  -  default; or JavaScript? |
| 4 | API style | REST, GraphQL (Apollo/Pothos), tRPC, or hybrid? |
| 5 | ORM / query builder | Prisma, Drizzle ORM, Knex, or raw SQL? |
| 6 | Database | PostgreSQL, MySQL, SQLite, MongoDB, or other? |
| 7 | Auth | JWT + refresh tokens, sessions (httpOnly cookie), NextAuth, Clerk, or other? |
| 8 | Validation | Zod (default), Joi, Yup, or framework-built-in? |
| 9 | Testing | Vitest + Supertest (default), Jest + Supertest, or other? |
| 10 | Logging | Pino (default), Winston, or other? |
| 11 | Caching | Redis (ioredis), in-process (lru-cache), or none? |
| 12 | Queue / jobs | BullMQ, pg-boss, inngest, or none? |
| 13 | OpenAPI | Generate from Zod (zod-to-openapi), from decorators (NestJS Swagger), or spec-first? |
| 14 | Monorepo | Turborepo, Nx, pnpm workspaces, or single repo? |

Echo back a **stack summary** for the user to confirm before generating any files.

---

## 1 - Project and File Structure

Follow a **clean architecture** layout: domain logic is framework-agnostic;
infrastructure (HTTP, DB, queue) depends on domain, never the reverse.

```
src/
+-- app.ts                     # Framework bootstrap (no business logic)
+-- server.ts                  # HTTP server entry point
+-- features/
|   +-- <feature-name>/
|       +-- <feature>.router.ts        # Route definitions + middleware wiring
|       +-- <feature>.controller.ts    # HTTP handlers (parse, delegate, respond)
|       +-- <feature>.service.ts       # Business logic (no HTTP, no DB imports)
|       +-- <feature>.repository.ts    # Data access (DB queries only)
|       +-- <feature>.schema.ts        # Zod schemas + inferred types
|       +-- <feature>.types.ts         # Domain types (interfaces, enums)
|       +-- <feature>.errors.ts        # Feature-specific typed errors
|       +-- <feature>.service.test.ts  # Unit tests (service, pure logic)
|       +-- <feature>.router.test.ts   # Integration tests (HTTP + real DB)
|       +-- README.md                  # Feature documentation
+-- lib/
|   +-- db.ts                  # ORM/DB client singleton
|   +-- redis.ts               # Redis client (if used)
|   +-- logger.ts              # Pino structured logger
|   +-- config.ts              # Zod-validated config from env
|   +-- errors.ts              # Global error types (ApiError, NotFoundError...)
|   +-- middleware/
|       +-- auth.ts            # JWT / session auth middleware
|       +-- authorize.ts       # RBAC / ownership middleware factory
|       +-- validate.ts        # Zod request validation middleware factory
|       +-- trace.ts           # Correlation ID injection
|       +-- rate-limit.ts      # Rate limiting middleware
+-- types/
|   +-- express.d.ts           # Augmented Request type (req.user, req.traceId)
+-- openapi/
    +-- spec.ts                # OpenAPI spec assembly
    +-- registry.ts            # zod-to-openapi registry
```

**Rules:**
- Controllers never contain business logic  -  they parse input, call a service, and return a response.
- Services never import HTTP framework types (Request, Response, etc.).
- Repositories are the only layer that imports the ORM/DB client.
- No circular dependencies between layers.
- Files over 300 lines are a signal to split.
- Test files are co-located with what they test.

### Dependency direction (enforced by lint or code review)

```
HTTP layer (router/controller)
        |
        v
Service layer (business logic)
        |
        v
Repository layer (data access)
        |
        v
Database / external services
```

---

## 2 - Standardized Code

### TypeScript

- Enable "strict": true in tsconfig.json. No exceptions.
- No any  -  use unknown + type guards or proper generics.
- Prefer interface for object shapes, type for unions.
- All function parameters and return types explicitly typed.
- Use satisfies for config objects validated against a type.
- Augment Express Request to carry req.user and req.traceId.

```ts
// src/types/express.d.ts
import type { User } from '@/features/users/user.types';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      traceId: string;
    }
  }
}
```

### Naming conventions

| Thing | Convention | Example |
|-------|------------|---------|
| File (feature) | kebab-case | users.service.ts |
| Class | PascalCase | UserService |
| Interface | PascalCase | UserRepository |
| Function / method | camelCase | findUserById |
| Constant | SCREAMING_SNAKE | MAX_PAGE_SIZE |
| Zod schema | PascalCase + Schema | CreateUserSchema |
| Route path | kebab-case | /api/v1/team-members |
| HTTP method | uppercase | GET, POST, PATCH, DELETE |
| Boolean variable | is/has/can prefix | isEmailVerified |

### Code style

- Prettier: { singleQuote: true, semi: true, printWidth: 100 }
- ESLint: eslint:recommended + @typescript-eslint/recommended
- No console.log in production code  -  use the structured logger.
- No commented-out code in committed files.
- Early returns over deeply nested conditionals.
- Prefer const over let; never var.
- Functions over 30 lines are a signal to split.

---

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

## 6 - Service Layer (Business Logic)

Services contain all business rules. They are framework-agnostic  -  no imports
from Express, Fastify, or any HTTP library. They throw typed errors; controllers
catch and translate them into HTTP responses via the global error handler.

```ts
// src/features/users/users.service.ts
/**
 * @module UsersService
 * Business logic for user management: creation, retrieval, updates, and deletion.
 * Authentication and authorization are enforced by middleware before reaching here.
 * This layer throws domain errors  -  HTTP translation happens in the error handler.
 */
import { usersRepository } from './users.repository';
import { NotFoundError, ConflictError, ForbiddenError } from '@/lib/errors';
import { toUserDto }       from './users.dto';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.schema';
import type { User }       from './users.types';
import type { UserDto }    from './users.dto';

/**
 * Returns a paginated, filtered list of users as DTOs.
 * @param query - Pagination and filter parameters (pre-validated).
 */
async function list(query: ListUsersQuery): Promise<PaginatedResult<UserDto>> {
  const { data, total } = await usersRepository.findMany(query);
  return {
    data:       data.map(toUserDto),
    page:       query.page,
    pageSize:   query.pageSize,
    total,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

/**
 * Creates a new user. Throws ConflictError if the email is already registered.
 * @param input - Validated user creation input.
 * @param actorId - ID of the admin performing the action (for audit log).
 */
async function create(input: CreateUserInput, actorId: string): Promise<UserDto> {
  const existing = await usersRepository.findByEmail(input.email);
  if (existing) throw new ConflictError('A user with this email already exists.');

  const user = await usersRepository.create(input);
  logger.info({ actorId, targetId: user.id }, 'User created');
  return toUserDto(user);
}

/**
 * Finds a user by ID. Applies object-level access control  -  members can only
 * see users in their own team; admins can see any user.
 */
async function findById(id: string, actor: User): Promise<UserDto> {
  const user = await usersRepository.findById(id);
  if (!user) throw new NotFoundError('User not found.');

  if (actor.role !== 'admin' && actor.teamId !== user.teamId) {
    throw new NotFoundError('User not found.'); // 404, not 403  -  avoid confirming existence
  }

  return toUserDto(user);
}

export const usersService = { list, create, findById, update, remove };
```

### DTO pattern (response allowlist)

```ts
// src/features/users/users.dto.ts
import type { User } from './users.types';

/** Safe, serializable representation of a user for API responses. */
export interface UserDto {
  id:        string;
  name:      string;
  email:     string;
  role:      string;
  createdAt: string;
}

/**
 * Converts an internal User entity to a safe DTO for API responses.
 * Explicitly omits: passwordHash, mfaSecret, resetToken, deletedAt.
 */
export function toUserDto(user: User): UserDto {
  return {
    id:        user.id,
    name:      user.name,
    email:     user.email,
    role:      user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
```

---

## 7 - Repository Layer (Data Access)

Repositories are the only layer that speaks directly to the database.
They return raw entity types (not DTOs)  -  transformation happens in the service.

```ts
// src/features/users/users.repository.ts
/**
 * @module UsersRepository
 * Data access for the users table. Uses Prisma for type-safe queries.
 * All queries are parameterized  -  no string interpolation of user data.
 */
import { db } from '@/lib/db';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.schema';
import type { User } from './users.types';

interface FindManyResult {
  data:  User[];
  total: number;
}

/**
 * Finds users matching the given query, with pagination and optional filters.
 * Uses a transaction to ensure consistent total count.
 */
async function findMany(query: ListUsersQuery): Promise<FindManyResult> {
  const where = {
    deletedAt: null,
    ...(query.role   ? { role: query.role }     : {}),
    ...(query.search ? {
      OR: [
        { name:  { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ],
    } : {}),
  };

  const [data, total] = await db.$transaction([
    db.user.findMany({
      where,
      skip:    (query.page - 1) * query.pageSize,
      take:    query.pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    db.user.count({ where }),
  ]);

  return { data, total };
}

async function findById(id: string): Promise<User | null> {
  return db.user.findFirst({ where: { id, deletedAt: null } });
}

async function findByEmail(email: string): Promise<User | null> {
  return db.user.findFirst({ where: { email, deletedAt: null } });
}

async function create(input: CreateUserInput): Promise<User> {
  return db.user.create({ data: input });
}

export const usersRepository = { findMany, findById, findByEmail, create };
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

## 10 - Dynamic Lists: Mandatory Pagination & Filtering

### 10.0 Cardinal Rule: Dynamic List Endpoints Contract

**Any endpoint providing or querying a dynamically growing list or collection (e.g., users, transactions, audit logs, comments, events, messages, products) MUST support pagination and filters. Unbounded queries (`SELECT *` without LIMIT or filtering) are strictly forbidden.**

The pagination strategy must be selected based on the user's requirements:

| Strategy | When to Choose (User Ask) | Query Schema | Response Envelope |
|----------|---------------------------|--------------|-------------------|
| **Offset-based** | User needs page navigation (`page`, `pageSize`, jump to page, total count). | `PaginationQuerySchema` (`page`, `pageSize`, filters) | `PaginatedResult<T>` (`page`, `pageSize`, `total`, `totalPages`) |
| **Cursor-based (Keyset)** | User needs high-scale streaming, infinite scroll, or large dataset throughput without deep offset latency. | `CursorPaginationQuerySchema` (`cursor`, `limit`, filters) | `CursorPaginatedResult<T>` (`nextCursor`, `hasMore`) |

### 10.1 Offset-Based Pagination Schema & Types

```ts
// src/lib/schemas/pagination.schema.ts
import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export const PaginationQuerySchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search:   z.string().trim().max(100).optional(),
  status:   z.string().trim().optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// src/lib/types/pagination.types.ts
export interface PaginatedResult<T> {
  data:       T[];
  page:       number;
  pageSize:   number;
  total:      number;
  totalPages: number;
}
```

### 10.2 Cursor-Based Pagination Schema & Types

```ts
// src/lib/schemas/cursor-pagination.schema.ts
import { z } from 'zod';

export const CursorPaginationQuerySchema = z.object({
  cursor: z.string().trim().optional(), // base64url encoded opaque keyset token
  limit:  z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(100).optional(),
  status: z.string().trim().optional(),
});

export type CursorPaginationQuery = z.infer<typeof CursorPaginationQuerySchema>;

// src/lib/types/cursor-pagination.types.ts
export interface CursorPaginatedResult<T> {
  data:       T[];
  nextCursor: string | null;
  hasMore:    boolean;
}
```

HTTP status code contract for list endpoints:

| Case | Status | Body |
|------|--------|------|
| Success | 200 | `PaginatedResult<T>` or `CursorPaginatedResult<T>` |
| Empty list | 200 | Result with `data: []`, `total: 0` / `hasMore: false` |
| Invalid query / page | 400 | Validation error with issues |
| No auth | 401 | error + traceId |
| No permission | 403 | error + traceId |

---

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

## 12 - Database Patterns

### Migrations

> [!CAUTION]
> **NEVER hand-type migration files if an auto-generating ORM/tool exists in the project (Prisma, Drizzle, TypeORM, Alembic, etc.).**
> Always edit the schema files (source of truth) first, run the CLI generation command, then inspect the generated file.

```bash
# Workflow:
# 1. Edit schema source of truth (e.g. src/infrastructure/db/schema/*.ts or schema.prisma)
# 2. Run generator CLI:

# Prisma workflow:
npx prisma migrate dev --name add_users_table --create-only # generates migration without applying
npx prisma migrate dev --name add_users_table               # development apply
npx prisma migrate deploy                                   # production (CI/CD)

# Drizzle workflow:
npx drizzle-kit generate                                    # generates SQL migration from schema files
npx drizzle-kit migrate                                     # applies migrations

# 3. Inspect generated migration SQL file for safety (verify no accidental drops, check CONCURRENTLY)
```

### Schema design rules

```
- Every table has: id (UUID, server-generated), createdAt, updatedAt.
- Soft deletes: add deletedAt TIMESTAMPTZ NULL. Filter deletedAt IS NULL in all queries.
- All foreign keys have explicit ON DELETE behavior documented.
- Indexes on all columns used in WHERE, JOIN ON, or ORDER BY.
- Add a database-level unique constraint for every business uniqueness rule.
- Use CHECK constraints for enums stored as strings.
- Timestamps always in UTC (TIMESTAMPTZ in Postgres).
```

### Transaction pattern

```ts
// Use transactions for any operation touching multiple tables
async function transferCredits(fromId: string, toId: string, amount: number) {
  return db.$transaction(async (tx) => {
    const from = await tx.wallet.findFirst({ where: { userId: fromId } });
    if (!from || from.balance < amount) throw new BusinessError('Insufficient credits.');

    await tx.wallet.update({
      where: { userId: fromId },
      data:  { balance: { decrement: amount } },
    });
    await tx.wallet.update({
      where: { userId: toId },
      data:  { balance: { increment: amount } },
    });
    return tx.transaction.create({ data: { fromId, toId, amount } });
  });
}
```

---

## 13 - Testing

### Stack (confirm with user in section 0)

Default: **Vitest + Supertest + real test database**

- Unit tests: services and utilities in isolation (mock repository layer).
- Integration tests: full HTTP stack against a real test DB (seeded and reset per suite).
- No mocking the database in integration tests  -  that hides real bugs.

### Test file naming

- Service unit test: feature.service.test.ts
- Router integration test: feature.router.test.ts
- Utility test: util-name.test.ts

### Unit test pattern (service, mocked repository)

```ts
// src/features/users/users.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usersService }     from './users.service';
import { usersRepository }  from './users.repository';
import { ConflictError }    from '@/lib/errors';

vi.mock('./users.repository');

describe('usersService.create', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns a user DTO when the email is not taken', async () => {
    vi.mocked(usersRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(usersRepository.create).mockResolvedValue(makeUser());

    const result = await usersService.create(
      { email: 'alice@example.com', name: 'Alice', role: 'member' },
      'admin-id',
    );

    expect(result.email).toBe('alice@example.com');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws ConflictError when the email is already registered', async () => {
    vi.mocked(usersRepository.findByEmail).mockResolvedValue(makeUser());

    await expect(
      usersService.create({ email: 'alice@example.com', name: 'Alice', role: 'member' }, 'admin-id'),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
```

### Integration test pattern (full HTTP stack)

```ts
// src/features/users/users.router.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request    from 'supertest';
import { app }    from '@/app';
import { db }     from '@/lib/db';
import { seedTestUser, cleanDatabase } from '@/test/helpers';

describe('POST /api/v1/users', () => {
  let adminToken: string;

  beforeAll(async () => {
    const admin = await seedTestUser({ role: 'admin' });
    adminToken  = generateTestToken(admin.id);
  });

  afterAll(async () => {
    await cleanDatabase();
    await db.$disconnect();
  });

  it('returns 201 and a user DTO on valid input', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'newuser@example.com', name: 'New User', role: 'member' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'newuser@example.com', role: 'member' });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('returns 400 with field errors on invalid input', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'not-an-email', name: '' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.issues).toHaveProperty('email');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .send({ email: 'x@x.com', name: 'X', role: 'member' });

    expect(res.status).toBe(401);
  });

  it('returns 403 when a non-admin creates a user', async () => {
    const member      = await seedTestUser({ role: 'member' });
    const memberToken = generateTestToken(member.id);

    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ email: 'another@example.com', name: 'Another', role: 'member' });

    expect(res.status).toBe(403);
  });

  it('returns 409 when the email is already registered', async () => {
    await seedTestUser({ email: 'existing@example.com' });

    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'existing@example.com', name: 'Duplicate', role: 'member' });

    expect(res.status).toBe(409);
  });
});
```

### What to test

| Must test | Skip |
|-----------|------|
| All HTTP status codes (200, 201, 400, 401, 403, 404, 409, 500) | ORM internals |
| Validation error field details | Framework middleware behaviour |
| Authorization boundaries per role | Infrastructure boot code |
| Business rule violations | Third-party library internals |
| Pagination: first page, last page, out-of-range | |
| Object-level access control (IDOR prevention) | |
| Idempotency key behaviour (if applicable) | |

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

## 15 - Code Documentation

### File-level module docblock

```ts
/**
 * @module UsersService
 * Business logic for user management: creation, retrieval, updates, and removal.
 * All inputs are pre-validated by middleware before reaching service methods.
 * This module throws typed AppError subclasses  -  HTTP translation is in the error handler.
 */
```

### Rules

- JSDoc @param, @returns, @throws, @example on every exported function.
- Complex logic: inline comments explain WHY, not WHAT.
- No obvious comments (// increment i).
- Every features/<name>/ folder has a README.md documenting:
  - Purpose (1-2 sentences)
  - Endpoints (method, path, auth, brief description)
  - Services and their responsibilities
  - Data flow (text or diagram)
  - Known edge cases

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

## 17 - Clean Code Standards

| Rule | Detail |
|------|--------|
| Single Responsibility | Controller, service, repository  -  one concern each. |
| DRY | Extract repeated logic to shared lib after the 2nd occurrence. |
| YAGNI | No speculative abstractions or unneeded generics. |
| Small functions | Functions > 30 lines are a signal to split. |
| No magic numbers | Every literal has a named constant. |
| Fail fast | Validate and check pre-conditions at the top of each function. |
| Pure services | Services do not have side effects beyond DB writes and structured logs. |
| No leaking internals | Never let repository types escape into the HTTP response. Always use DTOs. |

---

## 18 - Security (references security-standards)

> Read the security-standards skill in full. This section lists the
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

## ✅ Post-Implementation Checklist

Before marking any backend task complete:

- [ ] **Anti-Amnesia Receipt**: Output 1-line verification badge `🧠 [DevMind: be-standards applied | Checked: ...]` in response.
- [ ] All section 0 ASK items answered and stack summary confirmed by user
- [ ] TypeScript strict mode enabled; zero any usage
- [ ] config.ts validates all env vars at startup with Zod
- [ ] Every route has: authenticate, authorize (if restricted), validate (body/query/params)
- [ ] No business logic in controllers; no HTTP types in services
- [ ] No DB queries outside the repository layer
- [ ] All dynamic list endpoints support pagination and filtering (offset-based or cursor-based per user ask); zero unbounded queries (Section 10)
- [ ] All responses go through a DTO (no raw ORM objects returned)
- [ ] Typed error hierarchy used; error messages are human, natural, client-safe with zero DB/syntax leaks (Section 8); global error handler registered last
- [ ] Structured logging with correlation IDs on every request
- [ ] pino redact config covers all sensitive fields
- [ ] Tests cover: 200, 201, 400, 401, 403, 404, 409 for each endpoint
- [ ] Tests include authorization boundary tests (IDOR, role escalation)
- [ ] OpenAPI spec entry exists for every route
- [ ] Feature README.md written
- [ ] Backend security checklist (section 18) complete
- [ ] security-standards Master Security Checklist reviewed
- [ ] npm audit passes  -  no high or critical findings
- [ ] ESLint + Prettier pass with zero warnings

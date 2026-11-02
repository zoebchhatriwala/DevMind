# Backend changes: architecture

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

## 17 - Clean Code Standards

| Rule | Detail |
|------|--------|
| Single Responsibility | Keep domain operations understandable within the existing framework. |
| DRY | Extract shared logic when repeated behavior and callers justify it. |
| YAGNI | No speculative abstractions or unneeded generics. |
| Small functions | Split when responsibilities diverge, not at an arbitrary line count. |
| Constants | Name domain-significant values; avoid aliases for obvious literals. |
| Fail fast | Validate and check pre-conditions at the top of each function. |
| Side effects | Keep external work explicit and test its failure behavior. |
| No leaking internals | Allowlist public response fields; reuse existing schemas and types. |

---

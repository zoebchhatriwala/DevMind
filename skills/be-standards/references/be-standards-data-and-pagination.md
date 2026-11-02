# Backend changes: data and pagination

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

# Database changes: connections and pagination

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 6 - Connection Pooling, Scalability & Serverless

### 6.1 Connection Pool Mathematics & Sizing

> [!CAUTION]
> Setting database connection pool size to 100 on each application container will exhaust PostgreSQL memory, degrade CPU cache efficiency, and cause connection queue thundering herds.

PostgreSQL uses a process-per-connection model. Each connection consumes ~10MB RAM plus work buffers. Optimal pool formula from PostgreSQL core team:
$$\text{Max Connections} = (\text{CPU Cores} \times 2) + \text{Disk Spindle Count}$$

For a 4-core database server with SSD storage:
$$\text{Optimal Active Connections} = (4 \times 2) + 1 = 9 \text{ to } 15 \text{ concurrent connections}$$

### 6.2 PgBouncer Configuration Modes

When running containerized or serverless microservices, place PgBouncer or AWS RDS Proxy in front of PostgreSQL.

| Mode | Behavior | Prepared Statements | Session Variables (`SET LOCAL`) | Best For |
|------|----------|---------------------|-----------------------------------|----------|
| **Transaction Mode** (Default standard) | Connection returned to pool after each `COMMIT`/`ROLLBACK` | Requires named prepared statements disabled or PgBouncer 1.21+ | Supported only inside explicit transactions | 99% of web applications & serverless functions |
| **Session Mode** | Connection tied to client for entire lifecycle of TCP socket | Full support | Full support | Long-lived stateful monoliths with low client counts |
| **Statement Mode** | Connection returned after every single SQL statement | No | No | Read-only analytics (Never use with multi-statement transactions) |

### 6.3 Serverless / Edge Database Patterns

When running on Vercel, AWS Lambda, or Cloudflare Workers:
1. **Never establish direct TCP connections** without a connection pooler. 1,000 concurrent serverless invocations will crash the database with `FATAL: remaining connection slots are reserved for non-replication superuser connections`.
2. Use HTTP / WebSocket database adapters designed for serverless environments (e.g., `@neondatabase/serverless`, `@planetscale/database`, Supabase Transaction Pooler on port 6543).
3. If using standard TCP drivers, configure `max: 1` or `max: 2` per serverless container and set aggressive idle timeouts (`idleTimeoutMillis: 5000`).

### 6.4 Read Replicas & Replication Lag

When splitting traffic between Primary (Read/Write) and Replicas (Read-Only):
- **The Read-Your-Own-Writes Problem**: If a user updates their profile and the subsequent redirect reads from a replica that is 50ms behind, the user sees their old profile data and thinks the edit failed.
- **Enforce Session Stickiness**: Route reads to Primary for 2–5 seconds after any write operation initiated by that user session, or track PostgreSQL Log Sequence Numbers (LSN).

---

## 4 - Pagination & High-Performance Data Fetching

### 4.1 Keyset / Cursor Pagination vs Offset Pagination

> [!WARNING]
> `OFFSET 50000 LIMIT 20` forces the database to read 50,020 rows off disk, sort them in memory, discard the first 50,000, and return 20. It creates an $O(N)$ performance degradation and displays duplicate/skipped rows when new records are inserted during browsing.

**Enforce Keyset / Cursor Pagination on all lists with more than 500 items.**

| Metric | Offset Pagination (`OFFSET :n LIMIT :k`) | Keyset / Cursor Pagination (`WHERE id > :cursor LIMIT :k`) |
|--------|------------------------------------------|------------------------------------------------------------|
| Query complexity | Simple | Requires deterministic ordering tuple |
| Page jump (e.g., Jump to Page 42) | Supported | Not supported (Next / Previous only) |
| Deep pagination speed | Degradation to timeouts | Instant ($O(\log N)$ via index seek) |
| Stability under concurrent writes | Skips / duplicates rows | 100% deterministic & stable |

#### Production Keyset Pagination Implementation (SQL + Drizzle ORM)

```sql
-- Keyset pagination query ordered by created_at DESC, id DESC
SELECT id, title, created_at
FROM articles
WHERE (created_at, id) < ('2026-10-14T08:00:00Z', '01927e1b-85d7-7000-8000-000000000000')
ORDER BY created_at DESC, id DESC
LIMIT 21; -- Fetch limit + 1 to detect hasNextPage without running COUNT(*)
```

```typescript
// src/infrastructure/repositories/article.repository.ts
import { db } from '../db';
import { articles } from '../db/schema';
import { and, desc, lt, or } from 'drizzle-orm';

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export async function getArticlesKeyset(cursor?: { createdAt: Date; id: string }, limit = 20): Promise<PaginatedResult<typeof articles.$inferSelect>> {
  const fetchLimit = limit + 1;

  const records = await db
    .select()
    .from(articles)
    .where(
      cursor
        ? or(
            lt(articles.createdAt, cursor.createdAt),
            and(
              articles.createdAt === cursor.createdAt, // Handles exact millisecond collision
              lt(articles.id, cursor.id)
            )
          )
        : undefined
    )
    .orderBy(desc(articles.createdAt), desc(articles.id))
    .limit(fetchLimit);

  const hasNextPage = records.length > limit;
  const items = hasNextPage ? records.slice(0, limit) : records;

  let nextCursor: string | null = null;
  if (hasNextPage && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = Buffer.from(
      JSON.stringify({ createdAt: lastItem.createdAt.toISOString(), id: lastItem.id })
    ).toString('base64url');
  }

  return { items, nextCursor, hasNextPage };
}
```

### 4.2 Eliminating the N+1 Query Problem

An N+1 problem occurs when fetching 1 parent record makes 1 query, and fetching associated child records executes N subsequent queries inside a loop.

**Detection & Elimination**:
1. **Never** execute database queries inside a `for` loop, `map()`, or `.forEach()`.
2. Use SQL joins with aggregation, ORM relational loaders, or batch with DataLoader.

```typescript
// ANTI-PATTERN: N+1 query disaster
const users = await db.select().from(usersTable).limit(50);
for (const user of users) {
  // Makes 50 additional database roundtrips!
  user.posts = await db.select().from(postsTable).where(eq(postsTable.userId, user.id));
}

// CORRECT PATTERN 1: Batch with IN clause (or DataLoader)
const users = await db.select().from(usersTable).limit(50);
const userIds = users.map(u => u.id);

const posts = await db
  .select()
  .from(postsTable)
  .where(inArray(postsTable.userId, userIds));

// Group in memory:
const postsByUser = Map.groupBy(posts, p => p.userId);
for (const user of users) {
  user.posts = postsByUser.get(user.id) ?? [];
}
```

---

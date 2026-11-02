# Database changes: queries and indexes

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

## 5 - Transactions, Concurrency & Locking

### 5.1 Isolation Levels: Practical Application

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read | Serialization Anomaly | Default In | Best For |
|-----------------|------------|---------------------|--------------|-----------------------|------------|----------|
| **Read Committed** | Prevented | Allowed | Allowed | Allowed | PostgreSQL, Oracle, SQL Server | 95% of standard web OLTP queries |
| **Repeatable Read** | Prevented | Prevented | Prevented (in PG snapshot) | Allowed | MySQL InnoDB | Accurate multi-query reporting snapshots |
| **Serializable** | Prevented | Prevented | Prevented | Prevented | None (must opt-in) | Critical financial ledger debits / credit balances |

> [!IMPORTANT]
> If using `SERIALIZABLE` isolation in PostgreSQL, the application tier **must** catch 40001 serialization failure errors and automatically retry the transaction with jittered exponential backoff.

### 5.2 Optimistic Locking vs Pessimistic Locking

#### Pattern A: Optimistic Locking (High concurrency, low conflict rate)
Use an incrementing `version` integer column. No locks are held during user thinking time.

```sql
-- Table schema has version integer
ALTER TABLE products ADD COLUMN version INT NOT NULL DEFAULT 1;

-- Update only succeeds if version matches what client read:
UPDATE products
SET stock_count = stock_count - 1,
    version = version + 1
WHERE id = 'prod_123'
  AND version = 4;

-- If rows affected == 0, another user modified the record!
-- Application throws ConcurrencyConflictException (HTTP 409).
```

#### Pattern B: Pessimistic Locking (`SELECT FOR UPDATE`)
Use when conflict rate is high and immediate reservation is mandatory (e.g., ticket booking, seat reservation).

```sql
BEGIN;

-- Acquires exclusive row lock on this specific customer wallet
SELECT balance_cents
FROM customer_wallets
WHERE customer_id = 'cust_789'
FOR UPDATE;

-- Update balance with certainty that no concurrent thread read the old balance
UPDATE customer_wallets
SET balance_cents = balance_cents - 5000
WHERE customer_id = 'cust_789';

COMMIT;
```

#### Pattern C: High-Throughput Queue Processing (`FOR UPDATE SKIP LOCKED`)
Prevents worker thread contention when multiple workers pull jobs from a database queue table:

```sql
-- Atomically claim 1 pending job without blocking other workers:
WITH next_job AS (
    SELECT id
    FROM job_queue
    WHERE status = 'PENDING'
      AND run_at <= CURRENT_TIMESTAMP
    ORDER BY run_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
UPDATE job_queue jq
SET status = 'PROCESSING',
    locked_at = CURRENT_TIMESTAMP,
    locked_by = 'worker-node-42'
FROM next_job
WHERE jq.id = next_job.id
RETURNING jq.id, jq.payload;
```

### 5.3 Deadlock Prevention Rules

1. **Lock in Consistent Alphabetical / Primary Key Order**:
   If Process A updates Account 1 then Account 2, Process B must **never** update Account 2 then Account 1. Always sort ID arrays before executing batch updates (`ids.sort()`).
2. **Never Execute Network Calls Inside a DB Transaction**:
   Never invoke Stripe API, send an email, or call an external HTTP microservice while holding an open database transaction. If the external network call stalls for 15 seconds, database connection pools exhaust and row locks cascade across the entire cluster.
3. **Set Aggressive Lock Timeouts**:
   Never let a transaction wait forever on a lock.

```sql
-- Set local lock timeout in Postgres before running critical operations
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
```

---

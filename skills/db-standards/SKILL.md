---
name: db-standards
description: >-
  Database and Migration Engineering Standards for fullstack projects.
  Activate when designing schemas, writing migrations, optimizing queries, or configuring data layers (PostgreSQL, MySQL, SQLite).
  Covers: schema modeling (UUIDv7 vs BigInt, TIMESTAMPTZ, partial unique indexes), zero-downtime migrations
  (Expand-Contract pattern, CONCURRENTLY indexing), auto-generation rules (Drizzle Kit, Prisma Migrate),
  indexing strategy (B-Tree, GIN, ESR rule), keyset/cursor pagination, N+1 query elimination,
  transactions & concurrency (isolation levels, SKIP LOCKED), PgBouncer connection pooling, and Testcontainers.
trigger: model_decision
---

# Database & Migration Engineering Standards

> **Scope**: Relational and document databases — PostgreSQL (primary standard), MySQL, SQLite, MongoDB.
> **Audience**: Coding agents designing schemas, writing migrations, executing queries, or configuring data layers.
> **Security**: This skill enforces structural, performance, and transactional safety. Cryptographic storage, secret handling, and threat models reference the companion `security-standards` skill.
> **How to use**: Read before proposing schema changes, writing migrations, or authoring data queries. Resolve section 0 interview questions before generating migration files.

---

## 0 - Before You Write: Interview the User

Before writing schemas, migration files, or database queries, ask the user these architectural questions in a single friendly turn. Skip any already explicitly answered by repository configuration or environment files.

| # | Topic | ASK | Recommended Default |
|---|-------|-----|---------------------|
| 1 | Database Engine | PostgreSQL, MySQL, SQLite, or MongoDB? | PostgreSQL 16+ |
| 2 | Data Access Layer | Drizzle ORM, Prisma, Kysely, TypeORM, or Raw SQL? | Drizzle ORM (lightweight, SQL-aligned) |
| 3 | Migration Tool | Drizzle Kit, Prisma Migrate, Flyway, or node-pg-migrate? | Aligned with data access layer |
| 4 | Primary Key Strategy | UUIDv7 (time-sortable), BigInt (identity), or ULID? | UUIDv7 for distributed/APIs; BigInt for high-write internal tables |
| 5 | Tenancy Architecture | Single-tenant, Shared DB with `tenant_id`, Schema-per-tenant, or Row-Level Security (RLS)? | Shared DB with `tenant_id` + RLS |
| 6 | Connection Pooling | Direct connection, PgBouncer, Supabase pooler, or AWS RDS Proxy? | PgBouncer / RDS Proxy in production |
| 7 | Soft Delete Policy | Hard delete + audit archive table, or `deleted_at` timestamp with partial indexes? | Hard delete + CDC/audit log (preferred), or strict `deleted_at` |
| 8 | Test Database Strategy | Docker Testcontainers, local dedicated test DB, or transaction rollback? | Docker Testcontainers for CI / integration |

Echo back a **database architecture summary** for user confirmation before executing any schema mutations.

---

## 1 - Schema Architecture & Data Modeling

### 1.1 Naming Conventions

Consistency across tables, columns, indexes, and constraints is non-negotiable.

| Database Object | Convention | Example | Bad Example |
|-----------------|------------|---------|-------------|
| Table name | `snake_case`, plural | `users`, `billing_invoices` | `User`, `billingInvoice`, `tbl_users` |
| Column name | `snake_case`, singular | `email`, `created_at` | `Email`, `createdAt`, `user_email` |
| Primary Key | `id` | `id` | `user_id` (in its own table) |
| Foreign Key | `{singular_referenced_table}_id` | `user_id`, `organization_id` | `userId`, `userFK`, `owner` |
| Timestamp column | `snake_case` with `_at` suffix | `created_at`, `updated_at`, `expired_at` | `create_time`, `updated`, `dateCreated` |
| Date column | `snake_case` with `_date` suffix | `birth_date`, `due_date` | `birthday`, `due` |
| Boolean column | `is_`, `has_`, or `can_` prefix | `is_active`, `has_accepted_terms` | `active`, `status`, `terms` |
| Index | `idx_{table}_{columns}` | `idx_users_email`, `idx_orders_user_created` | `index1`, `user_idx` |
| Unique Index / Constraint | `uniq_{table}_{columns}` | `uniq_users_email`, `uniq_members_org_user` | `users_email_key` |
| Foreign Key Constraint | `fk_{table}_{referenced_table}` | `fk_orders_users`, `fk_invoices_organizations` | `fk_order_1` |
| Check Constraint | `chk_{table}_{rule}` | `chk_products_price_positive` | `check_1` |

### 1.2 Primary Key Selection

```
Choose primary keys deliberately based on access patterns:
- Distributed APIs, multi-region, or client-generated IDs: UUIDv7 or ULID
- Ultra high-volume internal relational logging/analytics: BIGINT GENERATED ALWAYS AS IDENTITY
- NEVER use random UUIDv4 for high-insert primary keys (causes severe B-Tree page fragmentation)
```

```sql
-- RECOMMENDED: UUIDv7 (PostgreSQL 17+ or via extension / application generation)
-- Sequential, time-ordered, index-friendly, non-enumerable
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- or uuid_generate_v7()
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RECOMMENDED for high-throughput single-node write systems: BIGINT Identity
CREATE TABLE system_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 1.3 Timestamps & Timezones

- **Always** use `TIMESTAMPTZ` (timestamp with time zone) in PostgreSQL or `DATETIME(6)` in UTC for MySQL.
- **Never** use timezone-naive `TIMESTAMP` for user-facing, event, or audit records.
- Application tier must always convert times to UTC prior to persistence.
- Store `created_at` and `updated_at` on every primary entity.

```sql
-- Standard timestamp baseline on every mutable table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Automated updated_at trigger in PostgreSQL
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 1.4 Soft Deletes vs Audit Logs

> [!CAUTION]
> Naive `deleted_at` columns break database-level unique constraints (`email` can only be used once ever, even if previous owner was soft-deleted), pollute all `WHERE` clauses, degrade index efficiency, and violate GDPR "right to erasure".

**Decision Matrix**:
1. **Financial / Medical / Compliance Data**: Hard delete is illegal. Use event-sourced / append-only audit trail (`audit_logs` or CDC).
2. **Standard SaaS (Undo / Recycle Bin feature required)**:
   - Use `deleted_at TIMESTAMPTZ NULL`.
   - **MUST** use PostgreSQL partial unique indexes to preserve uniqueness on active records:

```sql
-- CORRECT: Partial unique index supports multiple soft-deleted records with identical email,
-- but enforces strict uniqueness for active accounts
CREATE UNIQUE INDEX uniq_users_active_email 
ON users (email) 
WHERE deleted_at IS NULL;

-- Querying active records must target the indexed predicate
SELECT id, email FROM users 
WHERE email = 'alex@example.com' 
  AND deleted_at IS NULL;
```

3. **High-churn / Ephemeral Records (tokens, sessions, cache items)**:
   - Always hard delete (`DELETE FROM user_sessions WHERE expires_at < now()`).

### 1.5 JSON & JSONB: Rules of Engagement

JSONB in PostgreSQL offers great flexibility, but should not replace relational normalization.

**Permissible JSONB Use Cases**:
- Semi-structured vendor webhooks (e.g., Stripe raw payload).
- Highly variable user-configured metadata / preferences without fixed schemas.
- Ephemeral workflow execution state / step logs.

**Prohibited JSONB Anti-Patterns**:
- Foreign keys inside JSON blobs (breaks referential integrity).
- Entities that require frequent relational joins or updates to individual sub-fields.
- Columns queried in high-frequency OLTP `WHERE` clauses without specialized GIN indexes.

```sql
-- Indexing JSONB properly when query filtering is necessary
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY,
    provider VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- GIN index for containment queries (e.g., payload @> '{"event": "payment.succeeded"}')
CREATE INDEX idx_webhook_deliveries_payload_gin 
ON webhook_deliveries USING GIN (payload);

-- Expression B-tree index for extracting a specific high-frequency scalar path
CREATE INDEX idx_webhook_deliveries_stripe_event_id 
ON webhook_deliveries ((payload->>'id'));
```

### 1.6 Multi-Tenancy Architecture

| Pattern | Isolation Level | Complexity | Cost | Best For |
|---------|-----------------|------------|------|----------|
| **Row-Level Security (RLS)** | High (Kernel enforced) | Medium | Low | Modern SaaS with pooled database |
| **Shared DB + `tenant_id` in code** | Low (Application bug risks data leak) | Low | Low | Early-stage MVPs (high risk) |
| **Schema-per-tenant** | Medium | High | Medium | Enterprise customers requiring schema isolation |
| **Database-per-tenant** | Maximum (Physical separation) | High | High | Strict compliance (HIPAA, Banking, GovCloud) |

**Production Standard for Shared PostgreSQL DB: Row-Level Security (RLS)**:
```sql
-- 1. Enable RLS on the multi-tenant table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 2. Force RLS even for table owners (prevents accidental leak by service roles)
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

-- 3. Define the tenancy policy using session configuration variables
CREATE POLICY tenant_isolation_policy ON documents
    AS RESTRICTIVE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- 4. Application connection sets context before executing queries in transaction:
-- SET LOCAL app.current_tenant_id = 'c38a2e55-8c70-4d43-9828-5695029eef28';
```

---

## 2 - Safe Schema Evolution & Zero-Downtime Migrations

### 2.0 Cardinal Rule: NEVER Hand-Type Migrations When an Auto-Generating Framework Exists

> [!CAUTION]
> **DO NOT manually write, type, or author migration files from scratch if the application uses an ORM or migration framework that supports automatic migration generation (e.g., Drizzle Kit, Prisma Migrate, TypeORM, Alembic, Django, Rails, EF Core).**
>
> Hand-typing migrations causes schema drift, breaks ORM metadata synchronization, risks missing constraints/enums, and diverges from the schema definitions.

**The Mandatory Migration Workflow**:
1. **Edit Schema Definition Only**: Modify the project's schema source of truth (e.g. `src/infrastructure/db/schema/*.ts`, `prisma/schema.prisma`, TypeORM entity classes).
2. **Execute Framework Generator**: Run the framework's official migration CLI:
   - **Drizzle**: `npx drizzle-kit generate`
   - **Prisma**: `npx prisma migrate dev --name <migration_name> --create-only` (or `npx prisma migrate dev --name <name>`)
   - **TypeORM**: `npx typeorm migration:generate -d <dataSourcePath> src/migrations/<MigrationName>`
   - **Alembic**: `alembic revision --autogenerate -m "<migration_name>"`
3. **Inspect the Generated Migration File**: Read the generated file immediately after generation. Verify that:
   - No unintended `DROP TABLE` or `DROP COLUMN` commands were generated due to column renames.
   - Any new indexes on large tables use `CONCURRENTLY` (edit the generated file to add `CONCURRENTLY` / `statement-breakpoint` if omitted by generator).
   - Any new `NOT NULL` columns on existing populated tables follow the expand-contract pattern.
4. **Modify Only for Zero-Downtime Safety**: If safety adjustments are required, edit the auto-generated migration file. **Never bypass the framework to author migration files from a blank template.**

Never lock tables in production during schema migrations. Every schema alteration on a table with more than 10,000 rows must follow the **Expand and Contract (Parallel Run)** pattern.

```
PHASE 1: EXPAND
Add new column / table as nullable. Old and new code both function.

PHASE 2: DUAL WRITE
Deploy application code that writes to BOTH old and new columns. Read from old.

PHASE 3: BACKFILL
Asynchronously backfill historical data from old column to new column in batches.

PHASE 4: DUAL READ / SWITCH
Switch application code to read from new column. Continue dual writing.

PHASE 5: CONTRACT
Remove dual writes from application code. Drop old column / deprecated objects.
```

### 2.1 The Migration Safety Rules

| Dangerous Operation | Catastrophic Risk | Safe Alternative |
|---------------------|-------------------|------------------|
| `ALTER TABLE ... ADD COLUMN ... NOT NULL` | Acquires exclusive table lock (`AccessExclusiveLock`), freezes traffic | Add column as `NULLABLE`, backfill in batches, then `ADD CONSTRAINT ... NOT NULL` |
| `ALTER TABLE ... ADD COLUMN ... DEFAULT 'foo'` (pre-PG 11) | Rewrites entire table on disk, holding locks | Safe in PG 11+ for constant defaults, otherwise add column nullable, then set default |
| `CREATE INDEX idx_name ON table(col)` | Blocks all writes (`INSERT`, `UPDATE`, `DELETE`) until index build finishes | `CREATE INDEX CONCURRENTLY idx_name ON table(col)` |
| `ALTER TABLE ... DROP COLUMN old_col` | Crashes running code running old queries (`SELECT *`) | Remove all references in code first; wait one deployment cycle before dropping |
| `ALTER TABLE ... RENAME COLUMN old TO new` | Instantly breaks all currently running queries | Add new column, dual write, backfill, switch reads, drop old |
| `ALTER TABLE ... ADD CONSTRAINT fk ... REFERENCES ...` | Scans entire table under exclusive lock to validate existing rows | Add constraint as `NOT VALID`, then validate asynchronously |

### 2.2 Concrete Safe Migration Recipes (PostgreSQL)

#### Recipe 1: Safe Concurrent Index Creation
```sql
-- Drizzle Kit / Raw SQL:
-- Disables transaction wrapping because CONCURRENTLY cannot run inside a transaction block
-- statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_customer_status 
ON invoices (customer_id, status);
```

#### Recipe 2: Safe Foreign Key Addition (Zero Lockout)
```sql
-- Step 1: Add constraint NOT VALID (takes brief metadata lock, does NOT scan table)
ALTER TABLE order_items 
ADD CONSTRAINT fk_order_items_orders 
FOREIGN KEY (order_id) REFERENCES orders(id) 
NOT VALID;

-- Step 2: Validate existing rows in background (takes ShareUpdateExclusiveLock, writes proceed normally)
ALTER TABLE order_items 
VALIDATE CONSTRAINT fk_order_items_orders;
```

#### Recipe 3: Safe NOT NULL Constraint Addition
```sql
-- Step 1: Add a check constraint marked NOT VALID
ALTER TABLE users 
ADD CONSTRAINT chk_users_phone_not_null 
CHECK (phone_number IS NOT NULL) 
NOT VALID;

-- Step 2: Validate asynchronously after backfill is confirmed complete
ALTER TABLE users 
VALIDATE CONSTRAINT chk_users_phone_not_null;

-- (Optional in PG 12+) Once validated, convert to native NOT NULL without table scan:
-- ALTER TABLE users ALTER COLUMN phone_number SET NOT NULL;
```

#### Recipe 4: Safe Column Backfill Script (Batching)
Never run `UPDATE large_table SET new_col = old_col;` in a single query. It bloats WAL, exhausts memory, and locks rows.

```typescript
// scripts/backfill-user-uuid.ts
import { db } from '../src/infrastructure/db';
import { sql } from 'drizzle-orm';

async function backfillInBatches(batchSize = 2000) {
  let updatedCount = 0;
  let hasMore = true;

  console.log('Starting safe backfill...');

  while (hasMore) {
    // Process single batch by indexed primary key
    const result = await db.execute(sql`
      WITH batch AS (
        SELECT id FROM users
        WHERE status_code IS NULL
        ORDER BY id ASC
        LIMIT ${batchSize}
      )
      UPDATE users u
      SET status_code = 'ACTIVE'
      FROM batch
      WHERE u.id = batch.id
      RETURNING u.id;
    `);

    const count = (result.rows as any[]).length;
    updatedCount += count;
    console.log(`Updated batch of ${count} rows. Total: ${updatedCount}`);

    if (count < batchSize) {
      hasMore = false;
    } else {
      // 100ms pause between batches to yield CPU and let autovacuum / replicas breathe
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log('Backfill successfully finished.');
}
```

---

## 3 - Indexing Strategy & Query Optimization

Indexes accelerate read queries at the expense of write throughput (`INSERT`, `UPDATE`, `DELETE`) and disk storage. Every index must be justified by production query patterns.

### 3.1 Index Types & Selection Guide

| Index Type | Engine Support | Best For | Example Use Case |
|------------|----------------|----------|------------------|
| **B-Tree** (Default) | All (PG, MySQL, SQLite) | Equality (`=`), Range (`<`, `<=`, `>`, `>=`), Sorting (`ORDER BY`) | Primary keys, foreign keys, timestamps, emails |
| **GIN** (Generalized Inverted) | PostgreSQL | Arrays, Full-text search, JSONB containment (`@>`) | `tags text[]`, `payload jsonb`, `to_tsvector` |
| **BRIN** (Block Range Index) | PostgreSQL | Append-only massive tables sorted naturally by physical disk order | Millions of time-series event logs (`created_at`) |
| **Hash** | PostgreSQL, MySQL | Exact equality matches only (`=`) | Rare: B-Tree is usually preferable due to range support |
| **Partial Index** | PostgreSQL, SQLite | Filtering on a common query subset | `WHERE deleted_at IS NULL`, `WHERE status = 'FAILED'` |
| **Covering Index** (`INCLUDE`) | PostgreSQL | Index-Only Scans avoiding table heap lookups | Fetching `status`, `name` without touching table data |

### 3.2 The Golden Rules of Index Design

#### Rule 1: The Equality-First Compound Index Rule (ESR)
When creating a multi-column compound index for a query with equality filters, sorting, and range filters, order the index columns as:
1. **Equality columns** first (`status = 'PENDING'`)
2. **Sort columns** second (`ORDER BY created_at DESC`)
3. **Range columns** last (`price BETWEEN 10 AND 50`)

```sql
-- Query:
SELECT id, total_amount FROM orders 
WHERE store_id = '123' 
  AND created_at >= '2026-01-01' 
ORDER BY created_at DESC;

-- OPTIMAL COMPOUND INDEX: (equality column first, then sort/range column)
CREATE INDEX idx_orders_store_created 
ON orders (store_id, created_at DESC);

-- INEFFICIENT (Range column first prevents index from being used for equality filter on store_id):
-- CREATE INDEX idx_orders_created_store ON orders (created_at DESC, store_id);
```

#### Rule 2: Use Covering Indexes with `INCLUDE` to Achieve Index-Only Scans
If a query runs millions of times per hour, avoid hitting the table heap entirely by including the fetched columns inside the index leaf nodes:

```sql
-- Query fetches id, user_id, and total_cents filtered by status
SELECT id, user_id, total_cents 
FROM transactions 
WHERE status = 'SETTLED' AND processed_at >= '2026-10-01';

-- COVERING INDEX:
-- Key columns (status, processed_at) are ordered in B-tree;
-- Payload columns (user_id, total_cents) are stored in leaves without increasing B-tree depth
CREATE INDEX idx_tx_status_processed_covering 
ON transactions (status, processed_at) 
INCLUDE (user_id, total_cents);
```

#### Rule 3: Use Partial Indexes for Skewed Distributions
Never index millions of rows if only 1% are queried:

```sql
-- If 99% of jobs are 'COMPLETED' and only 1% are 'PENDING' or 'FAILED':
CREATE INDEX idx_jobs_pending_or_failed 
ON background_jobs (scheduled_at) 
WHERE status IN ('PENDING', 'RETRYING');
-- Index size is 99% smaller, inserts on completed jobs do not update the index!
```

### 3.3 Query Anti-Patterns & Diagnosing with `EXPLAIN (ANALYZE, BUFFERS)`

Always run `EXPLAIN (ANALYZE, BUFFERS)` on slow queries before guessing.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM users WHERE LOWER(email) = 'alex@example.com';
```

**What to look for in the execution plan**:
- ? **Seq Scan (Sequential Scan)** on large tables: Indicates a missing index or an un-indexable predicate.
- ? **High Shared Hit / Read Buffers**: Database is reading thousands of 8KB disk pages from memory or storage.
- ? **Filter removed rows (e.g., Rows Removed by Filter: 994820)**: Scanned an entire table or index only to discard almost everything.
- ? **Index Only Scan**: Fetched data purely from RAM index pages; zero heap reads.
- ? **Bitmap Index Scan + Bitmap Heap Scan**: Efficiently combined multiple indexes or ranged lookups.

#### Common Anti-Patterns and Fixes:
```sql
-- ANTI-PATTERN 1: Function call wrapping the indexed column
-- Breaks standard B-Tree index on 'email'
SELECT id FROM users WHERE LOWER(email) = 'user@company.com';

-- FIX: Create an expression index
CREATE INDEX idx_users_lower_email ON users (LOWER(email));


-- ANTI-PATTERN 2: Leading wildcard in text search (Forces full table scan)
SELECT id FROM products WHERE sku LIKE '%9481';

-- FIX: Use reverse text index, full-text search (tsvector), or trigram index (pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_products_sku_trgm ON products USING GIN (sku gin_trgm_ops);


-- ANTI-PATTERN 3: Implicit Type Coercion
-- If user_id is a VARCHAR/TEXT, passing an integer forces database to cast every row
SELECT * FROM accounts WHERE account_number = 100482; -- Slow seq scan
SELECT * FROM accounts WHERE account_number = '100482'; -- Fast index scan
```

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

## 7 - ORM & Query Builder Standards

### 7.1 Drizzle ORM Production Patterns (Preferred)

Drizzle provides zero-overhead SQL mapping with complete TypeScript inference.

#### Schema Organization
Organize schemas by domain feature, never in a single 3,000-line monolith file.

```
src/infrastructure/db/
+-- index.ts               # Connection instance & export
+-- schema/
|   +-- index.ts           # Barrel export of all tables & relations
|   +-- users.ts           # Users & accounts tables
|   +-- orders.ts          # Orders & order_items tables
|   +-- audit.ts           # Audit log table
```

#### Drizzle Schema Definition Example
```typescript
// src/infrastructure/db/schema/users.ts
import { pgTable, uuid, varchar, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { orders } from './orders';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('uniq_users_active_email').on(table.email).where(table.deletedAt.isNull()),
  index('idx_users_created_at').on(table.createdAt),
]);

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));
```

### 7.2 Prisma ORM Production Patterns

If the project uses Prisma:
1. **Never use deep cascade `include` trees**:
   `include: { author: { include: { profile: { include: { badges: true } } } } }` generates catastrophic outer joins. Use explicit `select` to retrieve only required fields.
2. Enable client extensions (`$extends`) for automated tenant filtering and auditing rather than scattering logic in services.
3. Configure connection pool limits in `DATABASE_URL`: `postgresql://...?connection_limit=10&pool_timeout=20`.

```typescript
// Safe field selection avoiding bloated queries
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    fullName: true,
    orders: {
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        totalCents: true,
        status: true,
      },
    },
  },
});
```

---

## 8 - Data Integrity, Foreign Keys & Constraints

Database constraints are the final line of defense against data corruption. Application code validation (e.g., Zod) is necessary for user experience, but database constraints guarantee mathematical truth.

### 8.1 Foreign Key Cascade Strategies

| ON DELETE Action | Behavior | Use When |
|------------------|----------|----------|
| **`RESTRICT` / `NO ACTION`** (Default) | Aborts delete if child records exist | Root entities (e.g., cannot delete `organization` if `invoices` exist) |
| **`CASCADE`** | Automatically deletes all child records | Tightly-coupled child entities that have zero meaning without parent (`order_items` owned by `order`) |
| **`SET NULL`** | Nullifies child foreign key | Optional parent reference (`assigned_agent_id` when support agent leaves) |

### 8.2 Defensive Check Constraints

Validate domain invariants directly in PostgreSQL:

```sql
CREATE TABLE billing_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subtotal_cents INT NOT NULL CHECK (subtotal_cents >= 0),
    tax_cents INT NOT NULL CHECK (tax_cents >= 0),
    total_cents INT NOT NULL,
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD', 'EUR', 'GBP', 'CAD')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'VOID')),
    -- Math consistency check enforced at kernel level:
    CONSTRAINT chk_invoices_math_match CHECK (total_cents = subtotal_cents + tax_cents)
);
```

---

## 9 - Seeding, Test Isolation & Fixtures

### 9.1 Deterministic & Idempotent Seeding

Seed scripts must be completely idempotent. Running `npm run db:seed` five times in a row must never fail or create duplicate rows.

```typescript
// prisma/seed.ts or scripts/seed.ts
import { db } from '../src/infrastructure/db';
import { users } from '../src/infrastructure/db/schema';
import { sql } from 'drizzle-orm';

async function seed() {
  const seedUsers = [
    {
      id: '01927e1b-0000-7000-8000-000000000001',
      email: 'admin@devmind.test',
      fullName: 'System Administrator',
      isActive: true,
    },
    {
      id: '01927e1b-0000-7000-8000-000000000002',
      email: 'demo@devmind.test',
      fullName: 'Demo Customer',
      isActive: true,
    },
  ];

  for (const user of seedUsers) {
    await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          fullName: user.fullName,
          isActive: user.isActive,
          updatedAt: new Date(),
        },
      });
  }

  console.log('Seeding completed idempotently.');
}

seed().catch(console.error);
```

### 9.2 Test Isolation Strategy (Testcontainers)

Never run integration tests against mocks or in-memory SQLite when the production database is PostgreSQL. Use Testcontainers for complete engine fidelity.

```typescript
// test/setup-test-db.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

let container: any;
let pool: Pool;

export async function startTestDatabase() {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .withUsername('test_user')
    .withPassword('test_pass')
    .start();

  pool = new Pool({ connectionString: container.getConnectionString() });
  const db = drizzle(pool);

  // Run migrations once on ephemeral container
  await migrate(db, { migrationsFolder: './drizzle' });

  return { db, pool, container };
}

export async function stopTestDatabase() {
  await pool?.end();
  await container?.stop();
}
```

---

## 10 - Database Security, Auditing & Access Control

> Full threat modeling and crypto rules are detailed in `security-standards`. This section establishes the structural database enforcement rules.

### 10.1 Principle of Least Privilege Roles

Production databases must never run application queries as the superuser or table owner. Use three distinct roles:

```sql
-- 1. Migration Role (Runs CI/CD migrations, owns DDL schema)
CREATE ROLE migration_user WITH LOGIN PASSWORD 'strong_secret_pwd';
GRANT ALL ON SCHEMA public TO migration_user;

-- 2. Application Runtime Role (DML only, zero DDL permissions)
CREATE ROLE app_runtime_user WITH LOGIN PASSWORD 'app_secret_pwd';
GRANT CONNECT ON DATABASE app_prod TO app_runtime_user;
GRANT USAGE ON SCHEMA public TO app_runtime_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime_user;
-- Revoke DDL creation: app cannot alter or drop tables
REVOKE CREATE ON SCHEMA public FROM app_runtime_user;

-- 3. Read-Only Analytics / Backup Role
CREATE ROLE analytics_ro_user WITH LOGIN PASSWORD 'analytics_secret_pwd';
GRANT CONNECT ON DATABASE app_prod TO analytics_ro_user;
GRANT USAGE ON SCHEMA public TO analytics_ro_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_ro_user;
```

### 10.2 Audit Logging Table Pattern

For compliance-sensitive entities (orders, payouts, role changes), track changes via a generic audit log:

```sql
CREATE TABLE audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name VARCHAR(64) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    actor_id UUID NULL,
    old_data JSONB NULL,
    new_data JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_table_record ON audit_logs (table_name, record_id);
CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);
```

---

## 11 - Operations, Maintenance & Observability

### 11.1 Slow Query Profiling with `pg_stat_statements`

Enable `pg_stat_statements` in `postgresql.conf` to identify query bottlenecks before users report outages.

```sql
-- Query to locate the top 10 most time-consuming queries across the entire database:
SELECT 
    substring(query, 1, 100) AS short_query,
    calls,
    round(total_exec_time::numeric, 2) AS total_time_ms,
    round(mean_exec_time::numeric, 2) AS avg_time_ms,
    round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS percentage_overall_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

### 11.2 Table Bloat & Autovacuum Tuning

PostgreSQL MVCC leaves dead row versions on disk during `UPDATE` and `DELETE`.
- Ensure autovacuum is **never** turned off.
- For high-write tables (e.g. `user_sessions`, `job_queue`), lower the vacuum threshold:

```sql
ALTER TABLE job_queue SET (
    autovacuum_vacuum_scale_factor = 0.05, -- Trigger vacuum after 5% row changes instead of 20%
    autovacuum_vacuum_cost_limit = 1000
);
```

---

## 12 - Agent Execution Checklist

Apply this verification checklist before finishing any database schema, migration, or query task.

### Pre-DDL Checklist
- [ ] Schema changes made in ORM/schema files first; migrations auto-generated via CLI (`drizzle-kit generate`, `prisma migrate dev --create-only`), NEVER typed manually from scratch.
- [ ] Generated migration inspected for unintended drops or destructive actions before execution.
- [ ] No `CREATE INDEX` without `CONCURRENTLY` on populated production tables.
- [ ] No `NOT NULL` columns added without default values or safe two-phase validation.
- [ ] No renaming or dropping columns without a 5-phase Expand-Contract deprecation plan.
- [ ] Primary keys use UUIDv7 or BigInt identity; random UUIDv4 avoided for high-insert keys.
- [ ] All timestamps use `TIMESTAMPTZ` with timezone awareness.
- [ ] Foreign keys have explicit `ON DELETE` cascade / restrict rules specified.

### Pre-Query & Repository Checklist
- [ ] Keyset/Cursor pagination implemented for unbounded lists; `OFFSET` avoided.
- [ ] Zero queries inside loops (N+1 queries completely eliminated via batching / joins).
- [ ] Compound indexes follow Equality-Sort-Range (ESR) column ordering.
- [ ] Partial unique index used if soft delete (`deleted_at`) is employed.
- [ ] No `SELECT *` in production hot paths; explicit column projection only.
- [ ] No network I/O or external HTTP requests executed within open database transactions.
- [ ] Lock timeouts (`lock_timeout`) explicitly configured for critical transactions.

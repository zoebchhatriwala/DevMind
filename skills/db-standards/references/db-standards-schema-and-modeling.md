# Database changes: schema and modeling

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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
- Compare random and time-ordered IDs against actual write load and index costs; preserve existing ID contracts unless a change is justified.
```

```sql
-- Random UUID example. gen_random_uuid() generates UUIDv4.
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

For time-ordered IDs, use a generator supported by the deployed database or application. PostgreSQL 18 provides `uuidv7()`; version 7 identifiers can expose a generation timestamp and are not authorization controls. See the [PostgreSQL UUID functions](https://www.postgresql.org/docs/18/functions-uuid.html).

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

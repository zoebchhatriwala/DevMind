# Database changes: migrations

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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
   - New indexes on busy tables use the appropriate online method, such as PostgreSQL `CONCURRENTLY`, with the migration runner configured to permit it outside a transaction.
   - Any new `NOT NULL` columns on existing populated tables follow the expand-contract pattern.
4. **Modify Only for Zero-Downtime Safety**: If safety adjustments are required, edit the auto-generated migration file. **Never bypass the framework to author migration files from a blank template.**

DDL can require locks even without a table rewrite. Choose the migration from its actual lock mode, scan/rewrite cost, active writers, and old/new application compatibility rather than a universal row-count threshold. Bound lock and statement waits and inspect long-running transactions before execution. Use **expand and contract** for incompatible changes; a compatible alteration may need fewer phases. Check the deployed version's [ALTER TABLE locking and validation behavior](https://www.postgresql.org/docs/18/sql-altertable.html).

```
PHASE 1: EXPAND
Add new column / table as nullable. Old and new code both function.

PHASE 2: DUAL WRITE
Keep the old column authoritative. Write both columns atomically.
Retire old writers before switching, or provide reviewed database synchronization
that also covers old application versions, jobs, and other writers.

PHASE 3: BACKFILL
Backfill in bounded, resumable, idempotent batches. Protect concurrent updates
from being overwritten. Reconcile divergence after old writers are retired
or synchronized, and verify completeness before switching reads.

PHASE 4: DUAL READ / SWITCH
Switch reads to the new column. Maintain compatible writes through the
rollback window; verify old and new callers against the migrated data.

PHASE 5: CONTRACT
After all live versions, jobs, and rollback candidates no longer need the old
schema, remove old references. Drop obsolete objects in a separate authorized step.
```

### 2.1 The Migration Safety Rules

| Operation | Risk to inspect | Safer approach |
|---------------------|-------------------|------------------|
| `ALTER TABLE ... ADD COLUMN ... NOT NULL` | Fails for populated rows without a suitable value; takes required DDL locks | Add nullable, backfill, validate a `CHECK`, then use `SET NOT NULL` where supported |
| `ALTER TABLE ... ADD COLUMN ... DEFAULT 'foo'` (pre-PG 11) | Rewrites entire table on disk, holding locks | Safe in PG 11+ for constant defaults, otherwise add column nullable, then set default |
| `CREATE INDEX idx_name ON table(col)` | Blocks all writes (`INSERT`, `UPDATE`, `DELETE`) until index build finishes | `CREATE INDEX CONCURRENTLY idx_name ON table(col)` |
| `ALTER TABLE ... DROP COLUMN old_col` | Breaks callers or rollback versions that need the column | Retire all dependent application/job versions and close the rollback window before dropping |
| `ALTER TABLE ... RENAME COLUMN old TO new` | Instantly breaks all currently running queries | Add new column, dual write, backfill, switch reads, drop old |
| `ALTER TABLE ... ADD CONSTRAINT fk ... REFERENCES ...` | Validation scan extends the period locks can block writes | Add `NOT VALID`, commit, then validate in a separate step |

### 2.2 Concrete Safe Migration Recipes (PostgreSQL)

#### Recipe 1: Safe Concurrent Index Creation
```sql
-- Configure the existing runner for a non-transactional migration.
-- A statement separator alone does not disable transaction wrapping.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_customer_status
ON invoices (customer_id, status);
```

#### Recipe 2: Foreign Key Addition with Deferred Validation

Execute the addition and validation as separately committed migration steps. A single wrapping transaction retains the initial locks during validation.

```sql
-- Step 1: NOT VALID skips the existing-row scan; required locks still apply.
ALTER TABLE order_items
ADD CONSTRAINT fk_order_items_orders
FOREIGN KEY (order_id) REFERENCES orders(id)
NOT VALID;

-- Step 2: In a later committed step, validate with SHARE UPDATE EXCLUSIVE.
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

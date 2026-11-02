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

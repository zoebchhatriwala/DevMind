# Database changes: connections and pagination

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

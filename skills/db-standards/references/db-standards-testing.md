# Database changes: testing

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

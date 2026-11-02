# Backend changes: tests and documentation

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 13 - Testing

### Stack (reuse the project's existing tools)

Default: **Vitest + Supertest + real test database**

- Unit tests: services and utilities in isolation (mock repository layer).
- Integration tests: full HTTP stack against a real test DB (seeded and reset per suite).
- No mocking the database in integration tests  -  that hides real bugs.

### Test file naming

- Service unit test: feature.service.test.ts
- Router integration test: feature.router.test.ts
- Utility test: util-name.test.ts

### Unit test pattern (service, mocked repository)

```ts
// src/features/users/users.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usersService }     from './users.service';
import { usersRepository }  from './users.repository';
import { ConflictError }    from '@/lib/errors';

vi.mock('./users.repository');

describe('usersService.create', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns a user DTO when the email is not taken', async () => {
    vi.mocked(usersRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(usersRepository.create).mockResolvedValue(makeUser());

    const result = await usersService.create(
      { email: 'alice@example.com', name: 'Alice', role: 'member' },
      'admin-id',
    );

    expect(result.email).toBe('alice@example.com');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws ConflictError when the email is already registered', async () => {
    vi.mocked(usersRepository.findByEmail).mockResolvedValue(makeUser());

    await expect(
      usersService.create({ email: 'alice@example.com', name: 'Alice', role: 'member' }, 'admin-id'),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
```

### Integration test pattern (full HTTP stack)

```ts
// src/features/users/users.router.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request    from 'supertest';
import { app }    from '@/app';
import { db }     from '@/lib/db';
import { seedTestUser, cleanDatabase } from '@/test/helpers';

describe('POST /api/v1/users', () => {
  let adminToken: string;

  beforeAll(async () => {
    const admin = await seedTestUser({ role: 'admin' });
    adminToken  = generateTestToken(admin.id);
  });

  afterAll(async () => {
    await cleanDatabase();
    await db.$disconnect();
  });

  it('returns 201 and a user DTO on valid input', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'newuser@example.com', name: 'New User', role: 'member' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'newuser@example.com', role: 'member' });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('returns 400 with field errors on invalid input', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'not-an-email', name: '' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.issues).toHaveProperty('email');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .send({ email: 'x@x.com', name: 'X', role: 'member' });

    expect(res.status).toBe(401);
  });

  it('returns 403 when a non-admin creates a user', async () => {
    const member      = await seedTestUser({ role: 'member' });
    const memberToken = generateTestToken(member.id);

    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ email: 'another@example.com', name: 'Another', role: 'member' });

    expect(res.status).toBe(403);
  });

  it('returns 409 when the email is already registered', async () => {
    await seedTestUser({ email: 'existing@example.com' });

    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'existing@example.com', name: 'Duplicate', role: 'member' });

    expect(res.status).toBe(409);
  });
});
```

### What to test

| Must test | Skip |
|-----------|------|
| All HTTP status codes (200, 201, 400, 401, 403, 404, 409, 500) | ORM internals |
| Validation error field details | Framework middleware behaviour |
| Authorization boundaries per role | Infrastructure boot code |
| Business rule violations | Third-party library internals |
| Pagination: first page, last page, out-of-range | |
| Object-level access control (IDOR prevention) | |
| Idempotency key behaviour (if applicable) | |

---

## 15 - Code Documentation

### File-level module docblock

```ts
/**
 * @module UsersService
 * Business logic for user management: creation, retrieval, updates, and removal.
 * All inputs are pre-validated by middleware before reaching service methods.
 * This module throws typed AppError subclasses  -  HTTP translation is in the error handler.
 */
```

### Rules

- JSDoc @param, @returns, @throws, @example on every exported function.
- Complex logic: inline comments explain WHY, not WHAT.
- No obvious comments (// increment i).
- Every features/<name>/ folder has a README.md documenting:
  - Purpose (1-2 sentences)
  - Endpoints (method, path, auth, brief description)
  - Services and their responsibilities
  - Data flow (text or diagram)
  - Known edge cases

---

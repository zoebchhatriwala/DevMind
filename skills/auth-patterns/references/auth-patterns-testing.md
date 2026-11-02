# Authentication and authorization: testing

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 8 - Testing Authentication & Authorization

Automated tests must explicitly cover the full authentication negative matrix.

```typescript
// test/integration/auth/auth-matrix.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app';

describe('Authentication & Authorization Matrix', () => {
  it('rejects access to protected resource when no cookie or token is provided', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('rejects tampered or forged JWT signatures', async () => {
    const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.tamperedSignature';
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${forgedToken}`);

    expect(res.status).toBe(401);
  });

  it('rejects expired sessions with 401', async () => {
    const expiredCookie = 'sid=expired_session_id';
    const res = await request(app)
      .get('/api/projects')
      .set('Cookie', [expiredCookie]);

    expect(res.status).toBe(401);
  });

  it('returns 403 Forbidden when authenticated user lacks required permission', async () => {
    // Viewer trying to delete project
    const viewerCookie = await getAuthCookieForUser({ role: 'viewer' });
    const res = await request(app)
      .delete('/api/projects/proj-123')
      .set('Cookie', [viewerCookie]);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Missing required permission');
  });

  it('prevents IDOR: user cannot read another organization data', async () => {
    const orgACookie = await getAuthCookieForUser({ orgId: 'org_a' });
    const res = await request(app)
      .get('/api/organizations/org_b/invoices')
      .set('Cookie', [orgACookie]);

    expect(res.status).toBe(404); // Prefer 404 to avoid leaking resource existence
  });
});
```

---

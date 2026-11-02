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

For the changed path, add the relevant cases below to the existing integration suite. Exercise the real guard/handler rather than only constructing a token or calling a mock permission helper.

| Boundary | Cases and expected result |
|---|---|
| Cookie API CSRF | Trusted Origin plus required header succeeds; missing header fails. Reject suffix/sibling origins, wrong scheme or port, `Origin: null`, and missing both Origin and Referer. Accept a trusted Referer fallback only when Origin is absent and the required header is present. A trusted Referer must not override a hostile Origin. |
| Sensitive account change | An old session cannot change email/MFA/recovery methods without required recent proof. Reject expired/reused proof and a new target substituted after verification. A failed change must leave the prior recovery channel usable. |
| Federated linking | Same email with a different issuer/subject cannot silently acquire the existing account. Reject callbacks without the authenticated linking transaction. |
| Revocation and offboarding | A formerly allowed user loses tenant access after removal, including cached reads and delayed jobs. Reject a disabled account's old session/refresh credential. Confirm other authorized memberships still work. |

---

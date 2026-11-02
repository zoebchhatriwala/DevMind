# Security boundaries: testing and operations

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 17 - Testing (Security Focus)

Standard: NIST SSDF PW.8; OWASP ASVS V1-V14 test cases.

Required security test categories (L2+):

| Category | What to test | Tool |
|----------|-------------|------|
| Unit | Auth logic, input validation, business rules | Vitest / Jest |
| Integration | Auth flows, DB transactions | Vitest + real DB |
| API / Contract | Schema, error shapes, status codes | Supertest / Hurl |
| Authorization | Access control boundaries (role X cannot access Y) | Vitest + test users |
| Injection | SQL/NoSQL/command injection rejection | Unit tests with malicious payloads |
| SAST | Static analysis for security patterns | ESLint security, CodeQL |
| SCA | Known CVEs in dependencies | npm audit, Dependabot |
| Secret scan | No committed secrets | Gitleaks |
| Regression | Re-test every fixed vulnerability | Tagged test |

```ts
// Authorization boundary test template
describe('Authorization boundaries', () => {
  it('viewer cannot delete a project they do not own', async () => {
    const viewer  = await createTestUser({ role: 'viewer' });
    const project = await createTestProject({ ownerId: adminUser.id });

    const res = await request(app)
      .delete(`/api/v1/projects/${project.id}`)
      .set('Authorization', `Bearer ${viewer.token}`);

    expect(res.status).toBe(403);
  });

  it('member cannot access another team resource (IDOR prevention)', async () => {
    const teamA   = await createTestTeam();
    const teamB   = await createTestTeam();
    const doc     = await createTestDocument({ teamId: teamA.id });
    const memberB = await createTestUser({ teamId: teamB.id, role: 'member' });

    const res = await request(app)
      .get(`/api/v1/documents/${doc.id}`)
      .set('Authorization', `Bearer ${memberB.token}`);

    expect(res.status).toBe(404); // 404, not 403 - don't confirm existence
  });
});
```

---

## 20 - Configuration (OWASP ASVS V14)

Standard: OWASP ASVS 5.0 Chapter V14.

Rules:
- Configuration is separated from code (12-factor app principle).
- All configuration schema-validated at startup; fail fast on missing required values.
- Secure defaults: features off by default; opt-in to enable.
- No production credentials in source control or developer machines.
- HTTP security headers set in all environments (see below).
- CORS: explicit allowlist of origins; never wildcard (*) for credentialed requests.
- Remove all debug endpoints, sample data, and default credentials before production.

Required HTTP security headers:
```ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      objectSrc:      ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

Config validation at startup:
```ts
// src/lib/config.ts
import { z } from 'zod';
const ConfigSchema = z.object({
  DATABASE_URL:   z.string().url(),
  JWT_SECRET:     z.string().min(32),
  SESSION_SECRET: z.string().min(32),
  NODE_ENV:       z.enum(['development', 'test', 'production']),
  LOG_LEVEL:      z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});
// Crashes immediately on misconfiguration - fail fast
export const config = ConfigSchema.parse(process.env);
```

---

## 24 - Operations

Rules:
- Health check endpoint (/health or /livez) - returns 200 when ready; no sensitive data.
- Readiness probe separate from liveness probe in container environments.
- Expose metrics: request rate, error rate, latency (P50/P95/P99), saturation.
- Distributed tracing with correlation IDs across all service calls.
- Define alerting thresholds: error rate > 1%, P99 > SLA, disk > 80%.
- Backups: frequency, retention, and restore procedure documented and tested.
- Disaster recovery: RTO and RPO defined; tested at least annually.
- Graceful shutdown: drain in-flight requests before terminating (SIGTERM -> drain -> exit).
- Operational runbooks for: deployment, rollback, DB migration, incident response.

---

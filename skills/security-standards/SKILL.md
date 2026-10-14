---
name: security-standards
description: >-
  Comprehensive Application Security Standards grounded in NIST SSDF SP 800-218 v1.1 and OWASP ASVS 5.0.
  Activate when implementing security controls, conducting security reviews, or auditing code.
  Covers: authentication, authorization, access control (RBAC/ABAC), input validation, SQL injection,
  XSS prevention, CSRF defense, cryptographic standards (Argon2id, AES-GCM), secret management,
  secure headers (CSP, HSTS), supply chain audits (npm audit, Snyk), error handling, and security logging.
trigger: model_decision
---

# Security Standards

> **Normative references**
> - **NIST SP 800-218 v1.1**  -  Secure Software Development Framework (SSDF)
> - **OWASP ASVS 5.0**  -  Application Security Verification Standard
>
> **How to use**: This skill is a mandatory companion to fe-standards,
> be-standards, and all other devmind skills. Read it fully when security
> decisions are being made. Cross-reference section numbers in code reviews.

---

## 0 - Before You Write: Security Interview

Ask once per project before writing security-sensitive code.
Record answers in docs/security-assumptions.md.

| # | Topic | ASK |
|---|-------|-----|
| 1 | Compliance target | ASVS Level 1 (low), 2 (standard - default), or 3 (critical)? |
| 2 | Authentication | Password, OAuth 2.0/OIDC, passkeys, or enterprise SSO? |
| 3 | MFA | All users, admins only, or optional? |
| 4 | Secret management | Cloud SM (AWS/GCP/Azure), HashiCorp Vault, or env injection? |
| 5 | Encryption at rest | Which data classes? Who manages keys? |
| 6 | Logging destination | SIEM, cloud logging, or local? Retention period? |
| 7 | Regulatory scope | GDPR, HIPAA, SOC 2, PCI-DSS, or none? |
| 8 | Threat model | Existing doc, or create one now? |

Echo back a security posture summary for the user to confirm before writing
any security-sensitive code.

---

## 1 - Secure Development (NIST SSDF)

Standard: NIST SP 800-218 v1.1, practices PO, PS, PW, RV.

| SSDF Practice | Rule |
|---------------|------|
| PO.1 | Define security requirements before implementation. Store in docs/security-requirements.md. |
| PO.3 | Integrate SAST, SCA, and secret scanning in CI before code merges. |
| PS.1 | All software components must have known, documented provenance. |
| PS.2 | Protect code from unauthorized access: branch protection, signed commits. |
| PS.3 | Archive each release full dependency graph (SBOM). |
| PW.1 | Use a threat model. Update when architecture changes. Minimum: STRIDE per feature. |
| PW.4 | Reuse vetted security components. No homebrew crypto, auth, or parsers. |
| PW.7 | Security-sensitive changes require a designated security-aware reviewer. |
| PW.8 | Test for all known vulnerability classes before release. |
| RV.1 | Maintain a vulnerability disclosure policy via SECURITY.md at repo root. |
| RV.3 | Remediation SLAs: Critical <= 24h, High <= 7d, Medium <= 30d. |

SECURITY.md template:

```markdown
# Security Policy

## Reporting a Vulnerability
Do NOT open a public GitHub issue for security vulnerabilities.
Email: security@YOUR_DOMAIN with subject "VULN: <summary>".
Response SLA: 48 hours acknowledgement, 7 days triage.

## Remediation SLAs
- Critical: 24 hours
- High: 7 days
- Medium: 30 days
```

---

## 2 - Application Security (OWASP ASVS 5.0)

Standard: OWASP ASVS 5.0, all chapters.
Default target: ASVS Level 2 for all devmind projects.

Key controls agents must verify in generated code:

| ASVS Ref | Control | Enforcement point |
|----------|---------|------------------|
| V2.1 | Password length >= 12, no max < 64 | Auth validation |
| V2.2 | No knowledge-based authentication (security questions) | Never generate KBA flows |
| V3.2 | New session token on login | Auth implementation |
| V3.4 | SameSite=Strict or Lax on session cookies | Cookie config |
| V4.1 | Server-side authorization on every request | No client-side-only guards |
| V5.1 | Input validation allowlist, not blocklist | All input handlers |
| V7.1 | No secrets in logs | Logging config |
| V8.1 | Sensitive data not stored beyond need | Data model review |
| V9.1 | TLS on all connections | Server/infra config |
| V13.1 | API authentication on all endpoints | Route guards |
| V14.2 | Dependencies up-to-date, no known critical CVEs | CI pipeline |

---

## 3 - Secure Coding and Architecture (OWASP ASVS V15)

Standard: OWASP ASVS 5.0 Chapter V15.

Defensive coding rules:
- Never use eval(), Function(), or dynamic code execution with user input.
- Use allowlists for file paths, redirect URLs, and dynamic module loading.
- Validate all inputs at the entry point of every function touching external data.
- Use constant-time comparison for secrets (crypto.timingSafeEqual, never ===).
- Avoid language features with known unsafe defaults.

Dangerous functionality - document threat justification before using any of:
- eval() / new Function() / vm.runInNewContext()
- Dynamic require() / import() with user-controlled path
- child_process.exec() / shell: true in subprocess calls
- fs.readFile() / fs.writeFile() with user-controlled paths
- dangerouslySetInnerHTML (frontend)
- Custom PRNG instead of crypto.randomBytes()
- YAML/pickle deserialization of untrusted data
- Regular expressions on untrusted input without ReDoS analysis

Component risk rules:
- Pin all dependencies to exact versions in lock files.
- Review the full diff of any dependency upgrade before merging.
- Remove unused dependencies - they are unreviewed attack surface.

---

## 4 - API Security (OWASP ASVS V13)

Standard: OWASP ASVS 5.0 Chapter V13.

Mandatory rules:
- Authenticate every endpoint - no route is public by default.
- Authorize at the resource level - check ownership, not just role.
- Validate request body against an explicit schema (Zod/JSON Schema/OpenAPI).
- Rate-limit all endpoints: unauthenticated stricter, authenticated per-user.
- Return 429 with Retry-After on rate limit exhaustion.
- Never return stack traces, internal paths, or library versions in errors.
- Use explicit response allowlists - never serialize full ORM objects.
- Enforce max request body size at the framework/server level.
- Version APIs from day one (/api/v1/...).

```ts
// Response allowlist pattern
// Bad: exposes all fields including sensitive ones
res.json(await db.users.findOne({ id }));

// Good: explicit allowlist
const user = await db.users.findOne({ id });
res.json({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
  // passwordHash, mfaSecret, resetToken - never included
});
```

---

## 5 - Authentication (OWASP ASVS V2)

Standard: OWASP ASVS 5.0 Chapter V2.

Rules:
- Passwords: minimum 12 characters, maximum 64+ characters.
- Check passwords against breach databases (HaveIBeenPwned) at registration.
- Use Argon2id (preferred), bcrypt (cost >= 12), or scrypt. Never MD5/SHA-1.
- Issue a new session token immediately after login (session fixation prevention).
- Expire sessions: 30 minutes idle, 8 hours absolute.
- MFA: require for admins; offer for all users; support TOTP and WebAuthn.
- Lock account or add delay after 5 failed login attempts; alert the user.
- Never reveal whether an email is registered in error messages (no user enumeration).
- Password reset tokens: single-use, expire in <= 1 hour, stored as hash.
- Service-to-service auth: short-lived tokens (<= 1 hour), no shared long-lived credentials.

```ts
// Bad - exposes user enumeration
if (user === null) return res.status(404).json({ error: 'User not found' });
if (!passwordMatch) return res.status(401).json({ error: 'Wrong password' });

// Good - generic message prevents enumeration
if (!user || !passwordMatch) {
  return res.status(401).json({ error: 'Invalid email or password' });
}
```

---

## 6 - Authorization (OWASP ASVS V4)

Standard: OWASP ASVS 5.0 Chapter V4.

Rules:
- Deny by default - every resource is forbidden unless explicitly allowed.
- Enforce authorization server-side on EVERY request. Client-side guards are UX only.
- Check object-level ownership (IDOR prevention): verify the user owns the resource.
- Least privilege: service accounts and DB users have only what they need.
- No privilege escalation paths: users cannot self-assign higher roles.
- Log all authorization failures with userId, resource, and action.

```ts
// Bad - missing IDOR check
async function getDocument(req, res) {
  const doc = await db.documents.findOne({ id: req.params.id });
  return res.json(doc); // any user can read any document
}

// Good - object-level ownership enforced
async function getDocument(req, res) {
  const doc = await db.documents.findOne({
    id: req.params.id,
    userId: req.user.id, // ownership enforced at query level
  });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  return res.json(toDocumentDto(doc));
}
```

---

## 7 - Input and Output (OWASP ASVS V5)

Standard: OWASP ASVS 5.0 Chapter V5.

Input rules:
- Canonicalize before validating: normalize Unicode, decode percent-encoding.
- Allowlist validation: accept only known-good patterns; reject everything else.
- Validate type, length, format, and range for every field.
- Never use blocklists as the primary defense against injection.

Output rules:
- HTML context: escape with a proven library (DOMPurify); never raw concat.
- JSON context: use framework serialization; never build JSON strings manually.
- URL context: use encodeURIComponent(); validate against domain allowlist.
- SQL context: parameterized queries only (see section 8).
- Shell context: avoid shell execution entirely; use structured APIs.

```ts
// Zod validation pattern (shared between client and server)
export const CreateProjectSchema = z.object({
  name:        z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  visibility:  z.enum(['public', 'private']),
  tags:        z.array(z.string().max(30)).max(10).default([]),
});

export async function createProject(req, res) {
  const parsed = CreateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_FAILED',
      issues: parsed.error.flatten().fieldErrors,
    });
  }
  const project = await projectService.create(parsed.data, req.user.id);
  return res.status(201).json(toProjectDto(project));
}
```

---

## 8 - Database (OWASP ASVS V5, V8)

Standard: OWASP ASVS 5.0 Chapters V5 (injection), V8 (data protection).

Rules:
- Parameterized queries ALWAYS - never string-interpolate user data into queries.
- Use an ORM or query builder with built-in parameterization (Drizzle, Prisma, Knex).
- Least-privilege DB accounts: app user has SELECT/INSERT/UPDATE/DELETE only; no DDL.
- Schema migrations are version-controlled, sequential, and reviewed before production.
- Enforce constraints at the DB level (NOT NULL, UNIQUE, FK, CHECK) in addition to app level.
- Use transactions for multi-step operations; handle rollback on failure.
- Index all columns used in WHERE, JOIN ON, and ORDER BY clauses.
- Set query timeouts; never allow unbounded queries.
- Encrypt columns containing PII or sensitive data at rest.

```ts
// Bad - SQL injection
const users = await db.query(`SELECT * FROM users WHERE email = '${req.body.email}'`);

// Good - parameterized
const users = await db.query('SELECT * FROM users WHERE email = $1', [req.body.email]);

// Good - ORM
const users = await prisma.user.findMany({ where: { email: req.body.email } });
```

---

## 9 - Secrets Management (OWASP ASVS V6, NIST SSDF PS.2)

Rules:
- No secrets in source code. No exceptions.
- No secrets in environment files committed to VCS (.env goes in .gitignore).
- Use a secret manager: AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, or Vault.
- Inject secrets at runtime via the platform (CI/CD env, Kubernetes secrets, cloud IAM).
- Rotate all secrets on a defined schedule; rotate immediately on suspected exposure.
- Secrets must not appear in logs, error messages, crash dumps, or URLs.
- Document all critical secrets and rotation requirements in the threat model.
- Use short-lived credentials (OIDC/STS) for CI/CD; no long-lived static keys.
- Scan every commit for accidental secret leaks (Gitleaks, GitHub secret scanning).

Pre-commit checklist:
- git diff --staged contains no credentials, API keys, or tokens
- Secret scanner (Gitleaks/git-secrets) passes
- .env is in .gitignore; .env.example has placeholder values only
- CI uses injected environment variables, not hardcoded values

---

## 10 - Cryptography (OWASP ASVS V6)

Approved algorithms:

| Use | Algorithm | Notes |
|-----|-----------|-------|
| Password hashing | Argon2id | memory=64MB, iterations>=3, parallelism=4 |
| Password hashing alt | bcrypt | cost factor >= 12 |
| Symmetric encryption | AES-256-GCM | With authenticated encryption |
| Asymmetric | RSA-4096 or ECDSA P-256 | Keys stored separately |
| Hashing (integrity) | SHA-256 / SHA-3 | Not for passwords |
| Random tokens | crypto.randomBytes(32) | Never Math.random() |
| TLS | TLS 1.3 preferred, 1.2 minimum | Disable older versions |

Rules:
- Never implement cryptographic algorithms from scratch.
- Use platform or well-audited library primitives (Node.js crypto, libsodium, WebCrypto).
- Manage keys separately from encrypted data; never store key and ciphertext together.
- Never use ECB mode for block ciphers.
- Never use MD5 or SHA-1 for security purposes.
- Use constant-time comparison for all secret/token comparisons.

```ts
// Good - cryptographically secure random token
import { randomBytes, timingSafeEqual } from 'crypto';
const token = randomBytes(32).toString('hex');

// Good - constant-time comparison (prevents timing attacks)
const isValid = timingSafeEqual(
  Buffer.from(providedToken, 'hex'),
  Buffer.from(storedToken, 'hex'),
);

// Bad - timing attack vulnerable
const isValid = providedToken === storedToken;
```

---

## 11 - Dependencies and Supply Chain (NIST SSDF PS, OWASP ASVS V14)

Rules:
- Pin exact versions in lock files (package-lock.json, yarn.lock, pnpm-lock.yaml).
- Run npm audit / pnpm audit in CI; block merges on high/critical findings.
- Use Dependabot or Renovate for automated dependency upgrade PRs.
- Generate and maintain an SBOM (CycloneDX or SPDX format) per release.
- Remove all unused dependencies - they are unreviewed attack surface.
- Review the full changelog of any dependency before upgrading across major versions.
- Do not use packages abandoned for > 2 years without an active fork.
- Prefer packages with a SECURITY.md and responsible disclosure track record.

CI supply-chain pipeline:
```yaml
- name: Audit dependencies
  run: npm audit --audit-level=high

- name: Secret scan
  run: gitleaks detect --source=. --exit-code=1

- name: Generate SBOM
  run: npx @cyclonedx/cyclonedx-npm --output-file sbom.json
```

---

## 12 - Error Handling (OWASP ASVS V7)

Rules:
- Fail safely: on error, deny access rather than fail open.
- Never expose stack traces to external clients in any environment.
- Never expose internal paths, library names, or version numbers in errors.
- Use a consistent error contract for all API responses.
- Distinguish client errors (4xx) from server errors (5xx): never 200 with error body.
- Log server errors (5xx) with full context internally; return sanitized message externally.
- Use structured error types throughout; never throw raw strings.

```ts
// Consistent error response shape
interface ApiErrorResponse {
  error:   string;           // safe to show in UI
  code?:   string;           // machine-readable: "VALIDATION_FAILED"
  issues?: Record<string, string[]>;  // field errors for 400
  traceId: string;           // correlation ID for internal lookup
}

// Global error handler
function globalErrorHandler(err, req, res, _next) {
  const traceId = req.traceId ?? crypto.randomUUID();
  if (err instanceof ApiError) {
    logger.warn({ err, traceId }, 'Client error');
    return res.status(err.status).json({ error: err.message, code: err.code, traceId });
  }
  logger.error({ err, traceId, url: req.url, method: req.method }, 'Unhandled error');
  return res.status(500).json({
    error: 'An unexpected error occurred. Please try again.',
    traceId,
    // Never include: err.stack, err.message (may contain internals)
  });
}
```

---

## 13 - Logging and Auditing (OWASP ASVS V7)

Rules:
- Use structured logging (JSON output) - never printf-style for production.
- Include a correlation/trace ID on every log line for a given request.
- Log all security events (see table below).
- Never log: passwords, tokens, secrets, full credit card numbers, raw PII.
- DEBUG off in production; INFO for normal operations; WARN for recoverable; ERROR for failures.
- Protect log integrity - ship to an external system; tamper-evident.
- Define and enforce log retention (90 days hot, 1 year archive typical).

Security events that MUST be logged:

| Event | Level | Fields |
|-------|-------|--------|
| Authentication success | INFO | userId, ip, userAgent, timestamp |
| Authentication failure | WARN | email (partial), ip, reason, timestamp |
| Account lockout | WARN | userId, ip, timestamp |
| Credential change | INFO | userId, changedBy, timestamp |
| Authorization failure | WARN | userId, resource, action, timestamp |
| Admin actions | INFO | actorId, targetId, action, timestamp |
| Session creation/destruction | INFO | userId, sessionId (hashed), timestamp |
| Data export / bulk access | INFO | userId, recordCount, timestamp |
| Dependency vulnerability | WARN | package, version, cve, timestamp |

```ts
// Structured logger with secret redaction (pino)
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.token', '*.secret'],
    censor: '[REDACTED]',
  },
});
```

---

## 14 - Resilience (OWASP ASVS V12)

Rules:
- Set timeouts on ALL outbound network calls (HTTP, DB, cache, queue). No indefinite blocks.
- Implement bounded retries with exponential backoff + jitter. Cap at 3-5 retries.
- Use a circuit breaker for non-critical external service calls.
- Design all state-changing operations to be idempotent where possible.
- Apply resource limits: max request body size, max upload size, max query result size.
- Graceful degradation: if a non-critical dependency fails, return partial results, not 500.
- Protect against retry storms: use jitter; back off on 429/503 responses.

```ts
// Retry with exponential backoff and jitter
async function withRetry(fn, maxAttempts = 3, baseDelayMs = 500) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      const jitter = Math.random() * baseDelayMs;
      const delay  = baseDelayMs * 2 ** (attempt - 1) + jitter;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
```

---

## 15 - Concurrency

Rules:
- Define explicit transaction boundaries for all multi-step data operations.
- Use SELECT FOR UPDATE (or equivalent) when reading before writing in a transaction.
- Design operations to be idempotent - safe to call multiple times with the same result.
- Use atomic DB operations (upsert, compare-and-swap) over read-modify-write.
- Use distributed locks (Redis SETNX / Redlock) for critical sections across multiple instances.
- Test concurrent scenarios explicitly; race condition tests in the test suite.

```ts
// Idempotency key pattern for mutation endpoints
export async function processPayment(req, res) {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required' });
  }
  const existing = await cache.get(`idem:${idempotencyKey}`);
  if (existing) return res.status(200).json(JSON.parse(existing));
  const result = await paymentService.process(req.body);
  await cache.set(`idem:${idempotencyKey}`, JSON.stringify(result), 'EX', 86400);
  return res.status(201).json(result);
}
```

---

## 16 - Performance

Rules:
- Detect and eliminate N+1 queries before shipping (use query logging in development).
- Paginate all list endpoints; enforce a maximum page size (default 100).
- Never load unbounded data into memory - stream or paginate large datasets.
- Set response body size limits for uploads and API responses.
- Avoid synchronous CPU-bound work in the event loop (Node.js) - offload to workers.
- Use database indexes for all query predicates and sort keys.
- Cache expensive, read-heavy queries with appropriate TTLs and invalidation strategy.
- Performance optimizations must never bypass security controls or input validation.
- Profile before optimizing - measure, never guess.

```ts
// Bad - N+1 query
const projects = await db.projects.findMany({ where: { teamId } });
for (const project of projects) {
  project.owner = await db.users.findOne({ id: project.ownerId }); // N queries
}

// Good - single query with join
const projects = await db.projects.findMany({
  where: { teamId },
  include: { owner: true },
});
```

---

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

## 18 - Code Review (Security)

Standard: NIST SSDF PW.7.

Changes requiring a designated security-aware reviewer:
- Authentication or session management changes
- Authorization / access control changes
- Cryptographic implementation changes
- Any use of dangerous functions (see section 3)
- Dependency additions or major upgrades
- Infrastructure or CI/CD configuration changes
- Data model changes involving PII or sensitive data

Security code review checklist:
- [ ] No secrets or credentials in the diff
- [ ] Input validation present at all entry points
- [ ] Authorization check present on every new endpoint/action
- [ ] Error messages are sanitized (no stack traces, no internal paths)
- [ ] New dependencies scanned for known CVEs
- [ ] Logging added for new security events
- [ ] Tests cover the authorization boundary

---

## 19 - CI/CD (NIST SSDF PO.3, PS.3)

Standard: NIST SSDF PO.3; OWASP ASVS V14.

Mandatory CI pipeline steps (all must pass before merge):
- lint:        eslint . and tsc --noEmit
- format:      prettier --check .
- test:        vitest run --coverage (or jest)
- audit:       npm audit --audit-level=high
- secret-scan: gitleaks detect --source=. --exit-code=1
- sast:        codeql analyze or semgrep --config=auto
- build:       npm run build
- sbom:        cyclonedx-npm --output-file sbom.json

Deployment rules:
- No deployment to production without all CI checks passing.
- Production deployments require approval (GitHub Environments, etc.).
- Every deployment artifact is immutable and tagged with a build SHA.
- Rollback procedure documented and tested.
- Production credentials are never accessible from developer machines.
- Use OIDC/STS for cloud auth from CI; no long-lived service account keys.

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

## 21 - API Contracts (OWASP ASVS V13)

Rules:
- Define an OpenAPI 3.x spec for every HTTP API.
- Request and response schemas must be explicit - no freeform objects.
- Versioning from day one: /api/v1/ path or header-based.
- Backward-incompatible changes require a new version; deprecate then remove.
- All paginated endpoints return: data, page, pageSize, total, totalPages.
- Filtering and sorting parameters have documented max/min bounds.
- Consistent status code semantics across all endpoints.
- All endpoints included in contract tests; schema drift fails CI.

HTTP status code contract:

| Status | Meaning | Notes |
|--------|---------|-------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation failure - include field errors |
| 401 | Unauthenticated | Missing or invalid auth |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource missing OR user lacks access (IDOR) |
| 409 | Conflict | Duplicate resource, stale data |
| 422 | Unprocessable | Business logic violation (not schema) |
| 429 | Too Many Requests | Rate limit - include Retry-After header |
| 500 | Server Error | Unexpected - return traceId, no internals |

---

## 22 - Architecture (NIST SSDF PW.1)

Rules:
- Document trust boundaries between all components.
- Apply defense in depth: never rely on a single security control.
- Separation of concerns: domain logic must not import infrastructure directly.
- Dependency direction: outer layers depend on inner; never reverse.
- Use Architecture Decision Records (ADRs) for security-sensitive decisions.
- Threat model every significant new feature - minimum STRIDE analysis.
- Minimize attack surface: remove unused endpoints, features, and dependencies.
- External services are untrusted - validate all data received from them.

ADR template for security decisions:
```markdown
# ADR-NNN: Title

**Date**: YYYY-MM-DD
**Status**: Accepted | Proposed | Deprecated

## Context
Why was this decision needed? What security concern does it address?

## Decision
What was decided?

## Threat model (STRIDE)
- Spoofing:
- Tampering:
- Repudiation:
- Information Disclosure:
- Denial of Service:
- Elevation of Privilege:

## Consequences
Security trade-offs of this decision.
```

---

## 23 - Data Protection (OWASP ASVS V8)

Rules:
- Collect only minimum data necessary for each feature (data minimization).
- Classify all data: Public / Internal / Confidential / Restricted.
- Enforce access controls matching classification at every layer.
- Encrypt Confidential and Restricted data at rest.
- Define and enforce retention periods; implement automated deletion.
- Log access to Restricted data for audit.
- Mask or anonymize PII in non-production environments.
- Never send PII in URLs (they appear in server logs).
- Implement data subject rights (access, portability, deletion) if GDPR applies.

Data classification table:

| Class | Examples | Storage | Logging |
|-------|---------|---------|---------|
| Public | Product names, public prices | Any | Any |
| Internal | Employee emails, analytics | Encrypted at rest | OK |
| Confidential | PII, API keys, financial data | Encrypted + access log | Masked |
| Restricted | Passwords, payment cards, health records | Encrypted + column-level + audit | Never |

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

## 25 - Documentation

Required documents per project:

| Document | Location | Contents |
|----------|----------|----------|
| docs/architecture.md | Repo root | System diagram, component responsibilities, data flows |
| docs/security-requirements.md | Repo root | ASVS level, compliance scope, security requirements |
| docs/threat-model.md | Repo root | Assets, threats (STRIDE), mitigations, residual risks |
| docs/security-assumptions.md | Repo root | Section 0 interview answers |
| docs/api-contract.md or openapi.yaml | Repo root | Full API specification |
| docs/data-classification.md | Repo root | Data classification table and handling rules |
| docs/runbooks/ | Repo root | Operational procedures |
| docs/adr/ | Repo root | Architecture Decision Records |
| SECURITY.md | Repo root | Vulnerability disclosure policy |
| CHANGELOG.md | Repo root | Human-readable version history |

Documentation rules:
- Document security assumptions, not just what was built.
- Every known limitation or accepted risk documented with a mitigating control.
- Architecture diagrams must include trust boundaries and data flows.
- API contracts must include auth scheme, error shapes, and rate limit policy.
- Runbooks must be tested - a runbook no one has executed is not a runbook.

---

## Master Security Checklist

Use before every release. Failures block deployment.

### Secure Development
- [ ] SECURITY.md present at repo root with disclosure policy and SLAs
- [ ] Threat model updated for all new features in this release
- [ ] Vulnerability remediation SLAs defined and tracked

### Application Security
- [ ] ASVS level confirmed and documented in security-requirements.md
- [ ] All ASVS L2 controls verified for affected chapters

### Code
- [ ] No eval(), Function(), or shell injection vectors
- [ ] No hardcoded secrets or credentials in the diff
- [ ] All user input validated and canonicalized before use
- [ ] All outputs appropriately encoded for context (HTML, URL, SQL, shell)
- [ ] Constant-time comparison used for all secret/token comparisons

### Authentication and Authorization
- [ ] All endpoints require authentication (no unintentional public routes)
- [ ] Object-level authorization verified on all data-returning endpoints (IDOR)
- [ ] Deny-by-default enforced - new permissions are explicit grants

### Data
- [ ] Data classification applied to all new data types introduced
- [ ] PII masked or anonymized in non-production environments
- [ ] Retention and deletion rules implemented for new data

### Dependencies and CI
- [ ] npm audit passes - no high or critical findings
- [ ] Secret scanner (Gitleaks) passes with zero findings
- [ ] SAST scan passes with no new high-severity findings
- [ ] SBOM generated for this release
- [ ] All CI steps pass (lint, format, test, build, audit, secret-scan, sast)

### Configuration and Headers
- [ ] HTTP security headers verified (Content-Security-Policy, HSTS, X-Frame-Options)
- [ ] CORS configured with explicit origin allowlist (no wildcards in production)
- [ ] Config schema validation passes at startup with production environment variables
- [ ] No debug endpoints, admin backdoors, or sample data in production build

### Operations
- [ ] Health and readiness endpoints respond correctly in staging
- [ ] Alerts configured for error rate and P99 latency thresholds
- [ ] Rollback procedure documented, and tested within the last quarter

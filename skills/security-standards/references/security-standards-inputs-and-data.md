# Security boundaries: inputs and data

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

### Data Lifecycle Across Copies

When adding sensitive data or changing retention, trace where it is copied: primary records, object versions, caches, search indexes/embeddings, exports, logs, model-provider storage, replicas, and backups. Apply the chosen retention/access policy to each copy; deleting a primary row or hiding it with a soft-delete flag is not proof of erasure.

- Collect and send only fields needed for the operation. Before introducing a model or other processor, verify its current storage, training-use, region, and deletion settings against the project's requirements; log redaction alone does not control provider retention.
- Make deletion retryable and observable without logging deleted content. Block new work for an offboarded account/tenant before cleanup, and prevent queued imports or old index jobs from recreating deleted data. Record partial failures for retry.
- Distinguish removal from active access, deferred expiration of backups, and any required retention holds. Keep retained copies access-restricted, and reapply current deletion and membership rules before a restore becomes live. Do not promise immediate deletion from immutable backups when the actual policy is expiry.
- Test deletion or permission removal against at least one derived copy and a delayed worker, plus restoration when supported. The previous user must not regain access from a cache, embedding, export link, or restored membership.

Use the existing storage/worker mechanisms; this does not require a new data platform. See [OWASP tenant offboarding and restore guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html#7-tenant-onboarding-offboarding-security).

---

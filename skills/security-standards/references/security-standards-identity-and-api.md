# Security boundaries: identity and api

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

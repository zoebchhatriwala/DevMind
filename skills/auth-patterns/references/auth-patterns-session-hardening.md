# Authentication and authorization: session hardening

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 5 - Token & Session Security Hardening

### 5.1 Cookie Security Attributes

When setting session IDs or refresh tokens in cookies, you must apply all five defensive flags:

```typescript
// Production cookie configuration options
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,                                         // Blocks document.cookie access from JavaScript (mitigates XSS)
  secure: process.env.NODE_ENV === 'production',          // Transmitted exclusively over HTTPS
  sameSite: 'lax' as const,                              // Mitigates CSRF for cross-origin POST requests
  path: '/',                                             // Scope to root
  maxAge: 1000 * 60 * 60 * 24 * 14,                      // 14 days in milliseconds
};
```

### 5.2 Cross-Site Request Forgery (CSRF) Defense

Use the framework's maintained CSRF protection first. Keep GET, HEAD, and OPTIONS free of state changes. `SameSite` is defense in depth; sibling origins can be same-site and still untrusted.

For ordinary HTML forms, use the framework's synchronizer token or signed, session-bound double-submit implementation. A static custom header is a different pattern, suitable for an AJAX API that rejects simple form requests and allows credentialed CORS only from explicitly trusted origins.

The following policy is for that cookie-authenticated AJAX API. Invoke it before every unsafe handler, read `csrfHeader` from `X-CSRF-Guard`, and return 403 on `false`. Enforce the API's JSON content type separately. Configure `trustedOrigin` as the deployment's exact origin (scheme, host, port), never from an untrusted Host or forwarded header. Reject duplicate/malformed headers in the HTTP adapter.

```js
// example: cookie-api-csrf
/**
 * @param {{ method: string, origin?: string, referer?: string, csrfHeader?: string }} request
 * @param {string} trustedOrigin Exact configured origin, e.g. https://app.example.com
 * @returns {boolean}
 */
export function allowsCookieApiRequest(request, trustedOrigin) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  if (request.csrfHeader !== '1') return false;

  // A present Origin must match; null and suffix lookalikes cannot use the fallback.
  if (request.origin !== undefined) return request.origin === trustedOrigin;
  if (request.referer === undefined) return false;
  try {
    return new URL(request.referer).origin === trustedOrigin;
  } catch {
    return false;
  }
}
```

The custom header makes a browser request require preflight; it is not a secret token. Do not allow untrusted origins through credentialed CORS, accept the marker in a form field, or bypass this check when Origin and Referer are missing. Cookie-less bearer clients may use a separately authenticated transport; their existence does not exempt cookie-authenticated handlers. See [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#using-standard-headers-to-verify-origin).

### 5.3 Global Session Revocation ("Log Out All Devices")

Users must be able to terminate all active sessions if their account is compromised:

```typescript
// src/application/services/session.service.ts
export class SessionService {
  // Option A: Stateful sessions (Deletes all session records for this user)
  static async revokeAllUserSessions(userId: string): Promise<void> {
    await db.delete(userSessions).where(eq(userSessions.userId, userId));
  }

  // Option B: Stateless JWT (Increment token_version on user record)
  // Access tokens include tokenVersion in payload. If token.version !== db.user.tokenVersion, reject immediately!
  static async invalidateAllJwtTokens(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId));
  }
}
```

### 5.4 Access Changes and Offboarding

- Check current account status and tenant membership where protected operations execute. Define how quickly role removal, suspension, or compromise revokes access; a self-contained JWT retains old claims until expiry unless a current-state/version check rejects it sooner.
- On account or tenant offboarding, reject new work first, revoke affected sessions and API credentials, then cancel or reauthorize queued work before it runs. A removed tenant membership must stop that tenant's access without disabling the user's unrelated memberships.
- Invalidate permission-sensitive caches and derived retrieval access when authority changes. A still-valid cookie or cached role is not proof of current permission. Recheck authorization before delayed/high-impact execution.
- Keep recovery and administrator remediation available through their own authorized paths. Verify expiry and revocation across every ingress path; use the existing revocation mechanism rather than adding a second session system.

---

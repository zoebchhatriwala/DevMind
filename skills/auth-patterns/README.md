# auth-patterns

> Authentication and Authorization Engineering Standards for fullstack applications.

## What it does

When activated, this skill instructs the agent to:

1. **Interview you** for identity provider, session model, token storage, password hashing, MFA, OAuth providers, and authorization structure (RBAC/ABAC).
2. Enforce the **session vs JWT decision matrix**  -  prohibiting storing tokens in `localStorage` and mandating `httpOnly`, `Secure`, `SameSite=Lax` cookies.
3. Implement **JWT Refresh Token Rotation with automatic reuse detection**, terminating token families upon replay detection.
4. Implement **OAuth 2.0 / OIDC Authorization Code Flow with PKCE (RFC 7636)**, rejecting insecure implicit grants.
5. Standardize on **Argon2id (RFC 9106)** password hashing and enforce NIST SP 800-63B password rules.
6. Prevent **user enumeration** on login, registration, and password recovery using uniform messages and timing defense.
7. Implement **TOTP (RFC 6238)** multi-factor authentication with single-use backup recovery codes and Passkeys (WebAuthn).
8. Architect **granular permissions (`resource:action`) mapped to roles** and enforce resource ownership checks to eliminate IDOR.
9. Defend against CSRF using **SameSite cookies + custom HTTP header verification** and enforce global session revocation.
10. Apply **progressive rate limiting** on authentication endpoints and log structured security audit events.

## Sections

| Sec | Topic |
|-----|-------|
| 0   | User interview (provider, session model, hashing, MFA, RBAC/ABAC) |
| 1   | Core authentication models & flows (sessions vs JWT, refresh rotation with reuse detection, PKCE OAuth) |
| 2   | Password management, hashing & reset flows (Argon2id, NIST SP 800-63B, enumeration defense) |
| 3   | Multi-factor authentication & Passkeys (TOTP RFC 6238, recovery codes, WebAuthn) |
| 4   | Authorization & access control models (RBAC, granular permissions, middleware guards, IDOR prevention) |
| 5   | Token & session security hardening (cookie flags, CSRF defense, global session revocation) |
| 6   | Rate limiting, brute force & account lockout (temporary cooldown, progressive backoff) |
| 7   | Security event audit logging (structured events, sanitization) |
| 8   | Testing authentication & authorization (negative security test matrix) |
| 9   | Agent execution checklist (pre-implementation & verification checklist) |

## Works well with

- `be-standards`  -  backend engineering; coordinates authentication middleware and controllers
- `security-standards`  -  comprehensive security baselines; references NIST SSDF and OWASP ASVS
- `fe-standards`  -  frontend engineering; consumes auth cookies, handles refresh errors, and renders login UX
- `db-standards`  -  database patterns; implements session and refresh token storage schemas

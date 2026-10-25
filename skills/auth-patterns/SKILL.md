---
name: auth-patterns
description: >-
  MANDATORY TRIGGER: Invoke BEFORE touching login, signup, JWT, OAuth, sessions, RBAC/permissions, middleware/guards, password hashing, CSRF, or token refresh logic.
  Keywords & Triggers: login, sign in, signup, register, user authentication, auth, passwords, forgot password, reset password, change password, password hashing, Argon2id, bcrypt, session management, session cookies, HttpOnly cookies, SameSite cookies, JWT, access token, refresh token rotation, token reuse detection, OAuth 2.0, social login, Google login, GitHub login, PKCE, NextAuth, Auth.js, Clerk, Supabase auth, roles, permissions, RBAC, ABAC, protected routes, auth guards, middleware auth, multi-tenant IDOR, 2FA, TOTP, MFA, passkeys, WebAuthn.
  File globs: **/{auth,middleware,session,security}/**
trigger: model_decision
---

# auth-patterns: Authentication & Authorization Engineering Protocol

> **Scope**: Authentication (AuthN) and Authorization (AuthZ) for fullstack web applications and APIs.  
> **Security Baseline**: Aligned strictly with **NIST SP 800-63B** (Digital Identity Guidelines) and **OWASP ASVS 5.0 V2 (Authentication), V3 (Session Management) & V4 (Access Control)**.  
> **Cross-Reference**: Cryptographic primitives, secret handling, and general security controls reference `security-standards`.

---

## 🚨 Pre-Flight Gate (Read Before Coding)

Before authoring or modifying any identity, token, session, or authorization code, verify these 5 non-negotiable gates:

1. **Zero Tokens in Browser Storage**: NEVER store JWT access tokens, refresh tokens, or session IDs in `localStorage` or `sessionStorage` (XSS vulnerability). Browser-based auth MUST use `HttpOnly; Secure; SameSite=Lax; Path=/` cookies.
2. **Argon2id Password Hashing**: NEVER use MD5, SHA-256, or plain text. Use Argon2id (RFC 9106) with memory $\ge 64\text{MB}$, iterations $\ge 3$, parallelism $= 1$ (or bcrypt cost $\ge 12$).
3. **Single-Use Refresh Token Rotation**: Refresh tokens MUST be rotated on every single use. If an already-invalidated token is submitted, treat it as token theft: immediately revoke the entire refresh token family.
4. **User Enumeration Defense**: Authentication, registration, and password-reset endpoints MUST return uniform generic error messages and execute with constant timing (never reveal whether an email exists in the database).
5. **Multi-Tenant Ownership Verification (Anti-IDOR)**: Never authorize an action or fetch a record using only client-provided path/query params. Always scope database queries to the authenticated user's session `organizationId` / `tenantId`.

> **Auth Invariant**: Never invent custom cryptography or proprietary session mechanisms. Rely on standard language/platform primitives (`crypto.randomUUID()`, `crypto.timingSafeEqual`) and battle-tested libraries (`argon2`, `jose`). Keep permission checks simple and explicit.

### Operational Modes:
- **Mode A: Greenfield / New Auth System**: Run the Section 0 Authentication Architecture Checklist below in a single friendly turn.
- **Mode B: Incremental Modification / Patch**: **DO NOT** run the interview questionnaire. Automatically inspect existing session cookies, JWT helpers, and middleware. Enforce all 5 pre-flight gates directly.

---

## ⚡ Golden Patterns (DO vs. DON'T)

### 1. Token Storage in Browsers
```ts
// ❌ [DON'T] Return raw tokens for client JavaScript to put in localStorage
app.post('/api/auth/login', async (req, res) => {
  const { accessToken, refreshToken } = await authService.login(req.body);
  res.json({ accessToken, refreshToken }); // Any XSS flaw steals entire session
});

// ✅ [DO] Set secure, HttpOnly, SameSite cookies from the server
app.post('/api/auth/login', async (req, res) => {
  const { accessToken, refreshToken } = await authService.login(req.body);
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 mins
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  res.json({ success: true });
});
```

### 2. Password Hashing
```ts
// ❌ [DON'T] Fast cryptographic hashes (SHA-256, MD5) are vulnerable to GPU brute-forcing
const hash = crypto.createHash('sha256').update(password).digest('hex');

// ✅ [DO] Memory-hard Argon2id hashing
import argon2 from 'argon2';

const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 1,
});

const isValid = await argon2.verify(hash, password);
```

### 3. User Enumeration Defense
```ts
// ❌ [DON'T] Leaking account existence via status codes or messages
if (!user) return res.status(404).json({ error: 'User does not exist' });
if (!valid) return res.status(401).json({ error: 'Incorrect password' });

// ✅ [DO] Generic message with dummy hash verification for constant-time response
if (!user) {
  await argon2.verify(DUMMY_HASH, password); // Burn CPU time to prevent timing attacks
  return res.status(401).json({ error: 'Invalid email or password' });
}
const valid = await argon2.verify(user.passwordHash, password);
if (!valid) {
  return res.status(401).json({ error: 'Invalid email or password' });
}
```

---

## 🔍 Anti-Amnesia Receipt

Whenever applying `auth-patterns`, the coding agent **MUST** output a 1-line verification receipt at the end of its response:

`🧠 [DevMind: auth-patterns applied | Checked: <top 3 rules verified>]`

*Example:* `🧠 [DevMind: auth-patterns applied | Checked: HttpOnly cookie storage, Argon2id hashing, timing-safe enumeration defense]`

---

## 0 - Before You Write: Architecture Interview

### Authentication Architecture Checklist

| # | Topic | ASK | Recommended Default |
|---|-------|-----|---------------------|
| 1 | Identity Provider | Self-hosted (custom DB), Better-Auth, Lucia, NextAuth/Auth.js, Clerk, Supabase Auth, or Auth0? | Self-hosted or Better-Auth / Lucia for full control |
| 2 | Primary Auth Model | Stateful server-side sessions (Redis/DB) or Stateless JWT Access + Refresh token rotation? | Stateful sessions (monolith/SSR) OR JWT + Refresh rotation (SPA/mobile) |
| 3 | Token / Session Storage | `httpOnly`, `Secure`, `SameSite=Lax` Cookie (recommended) or Authorization header? | `httpOnly` secure cookies for browsers; Bearer header for mobile/APIs |
| 4 | Password Hashing | Argon2id (default recommended) or bcrypt ($2b$)? | Argon2id (RFC 9106) |
| 5 | Multi-Factor Auth (MFA) | TOTP (RFC 6238 / Authenticator app), WebAuthn/Passkeys, Email magic link, or None? | TOTP + Single-use recovery codes |
| 6 | Social OAuth | Google, GitHub, Apple, Microsoft, or None? | Google + GitHub with PKCE |
| 7 | Authorization Model | Simple Roles (RBAC), Granular Permissions (`resource:action`), or Policy/Attribute-Based (ABAC)? | Granular permissions mapped to roles |
| 8 | Multi-Tenancy Scoping | Single-tenant, Organization/Workspace-scoped memberships, or Global roles? | Organization-scoped roles (`organization_id`, `user_id`, `role`) |

Echo back an **authentication architecture summary** for confirmation before implementing auth controllers or tables.

---

## 1 - Core Authentication Models & Protocol Flows

### 1.1 Decision Matrix: Sessions vs JWT Tokens

```
DO NOT store authentication tokens in localStorage or sessionStorage.
Any JavaScript running on the page (XSS vulnerabilities, malicious npm packages)
can immediately steal tokens stored in localStorage.
```

| Criteria | Stateful Server-Side Sessions | Stateless JWT + Refresh Token Rotation |
|----------|-------------------------------|----------------------------------------|
| **Storage in browser** | `httpOnly`, `Secure`, `SameSite=Lax` Cookie | Access Token in memory; Refresh Token in `httpOnly` Cookie |
| **Revocation speed** | Instantaneous (delete session row / Redis key) | Instant for Refresh Token; Access Token lives until TTL (5â€“15 min) |
| **Horizontal scaling** | Requires shared Redis / database lookup | Zero-lookup verification via asymmetric public key (RS256/EdDSA) |
| **Best suited for** | Monoliths, Next.js / Remix SSR, traditional web apps | Microservices, distributed APIs, mobile apps with decoupled backends |

---

### 1.2 Stateful Session Architecture (Production Standard)

```
Browser                         API Gateway / Backend                     Redis / PostgreSQL
   |                                      |                                        |
   |-- 1. POST /api/auth/login ---------->|                                        |
   |      (email, password)               |-- 2. Verify Argon2id hash ------------>|
   |                                      |-- 3. Generate 32-byte crypto ID ------>|
   |                                      |-- 4. Store session with TTL (7-30d) -->|
   |<-- 5. Set-Cookie: sid=abc; ---------|                                        |
   |      HttpOnly; Secure; SameSite=Lax  |                                        |
   |                                      |                                        |
   |-- 6. GET /api/user/profile --------->|                                        |
   |      (Cookie: sid=abc automatically) |-- 7. Fetch session & extend idle TTL ->|
   |<-- 8. 200 OK (User DTO) -------------|                                        |
```

#### Session Schema & Cookie Rules
```sql
CREATE TABLE user_sessions (
    id VARCHAR(64) PRIMARY KEY, -- SHA-256 hash of the cookie token (never raw token in DB)
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);
```

---

### 1.3 JWT Access Token + Refresh Token Rotation (With Reuse Detection)

When building decoupled APIs or mobile clients requiring JWTs, you **must** implement Refresh Token Rotation with automatic theft/reuse detection.

```
LIFETIME RULES:
- Access Token (AT): Short-lived (5 to 15 minutes max). Contains user_id, tenant_id, permissions.
- Refresh Token (RT): Long-lived (7 to 30 days). Single-use only.
- Token Family: Every time an RT is exchanged, it is invalidated and replaced with a new RT in the same family.
- REUSE DETECTION: If an already-invalidated RT is presented to /refresh, THE ENTIRE TOKEN FAMILY IS IMMEDIATELY REVOKED (assumes token theft occurred).
```

#### Database Schema for Token Families
```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL, -- Ties rotated tokens together
    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 of raw refresh token
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_token_hash ON refresh_tokens(token_hash);
```

#### Refresh Rotation Handler Implementation
```typescript
// src/application/services/auth-token.service.ts
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db } from '../../infrastructure/db';
import { refreshTokens } from '../../infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { UnauthorizedError } from '../../domain/errors/app-errors';

export class AuthTokenService {
  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  async rotateRefreshToken(rawOldRefreshToken: string): Promise<{ accessToken: string; newRefreshToken: string }> {
    const oldHash = this.hashToken(rawOldRefreshToken);

    const existingToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, oldHash),
    });

    // 1. Check existence and expiration
    if (!existingToken || existingToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // 2. REUSE DETECTION (THEFT PREVENTION)
    // If a revoked token is used again, an attacker and a victim both possess copies of this token family.
    if (existingToken.isRevoked) {
      // Nukes all sessions/tokens in this family immediately!
      await db
        .update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.familyId, existingToken.familyId));

      throw new UnauthorizedError('Token reuse detected. All sessions in this chain have been terminated.');
    }

    // 3. Invalidate current token
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.id, existingToken.id));

    // 4. Issue new single-use refresh token in the same family
    const newRawRefreshToken = crypto.randomBytes(32).toString('hex');
    const newHash = this.hashToken(newRawRefreshToken);

    await db.insert(refreshTokens).values({
      familyId: existingToken.familyId,
      tokenHash: newHash,
      userId: existingToken.userId,
      isRevoked: false,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14), // 14 days
    });

    // 5. Issue new short-lived access token (15 mins)
    const accessToken = jwt.sign(
      { sub: existingToken.userId },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '15m', algorithm: 'HS256' } // Or RS256/EdDSA with private key
    );

    return { accessToken, newRefreshToken: newRawRefreshToken };
  }
}
```

---

### 1.4 OAuth 2.0 / OIDC Authorization Code Flow with PKCE (RFC 7636)

> [!IMPORTANT]
> The OAuth 2.0 "Implicit Grant" is **deprecated and forbidden** (RFC 8252, OAuth 2.1).
> Always use **Authorization Code Flow with Proof Key for Code Exchange (PKCE)**, even for confidential backend servers.

```
Client / Frontend                         Backend (Client)                     OAuth Provider (Google/GitHub)
      |                                           |                                           |
      |-- 1. Click "Sign in with Google" -------->|                                           |
      |                                           |-- 2. Generate code_verifier (high-entropy)|
      |                                           |-- 3. code_challenge = SHA256(verifier)    |
      |                                           |-- 4. Store verifier in short-lived cookie |
      |<-- 5. Redirect to Auth Provider ----------|                                           |
      |      (?client_id&response_type=code       |                                           |
      |       &code_challenge&state=random_uuid)  |                                           |
      |                                           |                                           |
      |-- 6. User approves on Provider Page ------------------------------------------------->|
      |<-- 7. Redirect back with ?code=abc&state=random_uuid ---------------------------------|
      |                                           |                                           |
      |-- 8. GET /api/auth/callback/google ------>|                                           |
      |      (?code=abc&state=random_uuid)        |-- 9. Verify state matches session state   |
      |                                           |-- 10. POST /oauth/token ----------------->|
      |                                           |      (code, code_verifier, client_secret) |
      |                                           |<-- 11. Returns id_token & user profile ---|
      |<-- 12. Authenticated Session Cookie ------|                                           |
```

---

## 2 - Password Management, Hashing & Reset Flows

### 2.1 Password Hashing with Argon2id

> [!IMPORTANT]
> **Argon2id (RFC 9106)** is the winner of the Password Hashing Competition and the current gold standard. Use `argon2` or `@node-rs/argon2`. If constrained by legacy dependencies, use `bcrypt` with cost factor 12+. Never use MD5, SHA-1, SHA-256, or plain SHA-512 for password storage.

```typescript
// src/infrastructure/security/password-hasher.ts
import argon2 from 'argon2';

export class PasswordHasher {
  // OWASP / NIST recommended parameters for Argon2id
  private static readonly OPTIONS: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,       // 3 iterations
    parallelism: 4,    // 4 threads
  };

  static async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, this.OPTIONS);
  }

  static async verify(hash: string, plainPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainPassword);
    } catch {
      return false;
    }
  }

  // Automatic upgrade check: hashes created with older parameters can be rehashed on login
  static needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, this.OPTIONS);
  }
}
```

### 2.2 NIST SP 800-63B Password Policy Standards

Discard archaic rules requiring 1 uppercase, 1 number, 1 special character (which leads to predictable substitutions like `P@ssword1`). Enforce length and breach-checking:

| Rule | Requirement | Rationale |
|------|-------------|-----------|
| **Minimum Length** | $\ge 12$ characters (16+ recommended) | Length beats complexity for entropy |
| **Maximum Length** | $\ge 64$ characters (allow up to 128) | Prevents DoS on hashing algorithms while allowing passphrases |
| **Permitted Characters** | All ASCII and Unicode (including emoji and spaces) | Supports multi-word passphrases (`correct horse battery staple`) |
| **Breach Checking** | Check HaveIBeenPwned API via k-Anonymity | Block known compromised passwords |
| **Composition Rules** | **DO NOT** require arbitrary character classes | Encourages weak, predictable patterns |
| **Periodic Expiry** | **DO NOT** force 90-day password resets | Users make trivial modifications (`Spring2026!` $\rightarrow$ `Summer2026!`) |

### 2.3 Account Recovery & Password Reset Flow

```
User                         Application API                     Email Provider (Resend/SES)
  |                                 |                                        |
  |-- 1. POST /forgot-password ---->|                                        |
  |      (email: alex@test.com)     |-- 2. Lookup user                       |
  |                                 |-- 3. Generate 32-byte crypto token     |
  |                                 |-- 4. Store SHA-256(token) in DB (15m)  |
  |<-- 5. Always 200 OK ------------|-- 6. Send raw token in email link ---->|
  |      "If account exists..."     |                                        |
  |                                 |                                        |
  |-- 7. Click email link --------->|                                        |
  |      POST /reset-password       |-- 8. Hash input token & compare in DB  |
  |      (token, newPassword)       |-- 9. Update password hash (Argon2id)   |
  |                                 |-- 10. Invalidate ALL user sessions     |
  |<-- 11. 200 OK (Login required) -|                                        |
```

```sql
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 of the reset token sent to email
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reset_token_hash ON password_reset_tokens(token_hash);
```

### 2.4 User Enumeration Defense

Never leak whether an email address exists in the database during login, registration, or password reset.

```typescript
// src/application/controllers/auth.controller.ts
export async function handleForgotPassword(req: Request, res: Response) {
  const { email } = forgotPasswordSchema.parse(req.body);

  // Artificial timing protection to equalize duration whether user exists or not
  const startTime = Date.now();
  await authService.requestPasswordReset(email);
  const elapsed = Date.now() - startTime;
  if (elapsed < 300) {
    await new Promise((resolve) => setTimeout(resolve, 300 - elapsed));
  }

  // Always return the exact same generic message with HTTP 200:
  return res.status(200).json({
    message: 'If an account with that email exists, we have sent password reset instructions.',
  });
}
```

---

## 3 - Multi-Factor Authentication (MFA) & WebAuthn

### 3.1 Time-Based One-Time Password (TOTP - RFC 6238)

TOTP generates a 6-digit numeric code rotating every 30 seconds based on an HMAC-SHA1 or HMAC-SHA256 secret shared between the server and the authenticator app (Google Authenticator, 1Password, Authy).

```typescript
// src/application/services/totp.service.ts
import { generateSecret, generateURI, verifyToken } from 'node-2fa';
import qrcode from 'qrcode';

export class TotpService {
  // Step 1: Initiate MFA Setup
  static async startSetup(userEmail: string, appName = 'DevMind App') {
    const { secret, uri } = generateSecret({ name: appName, account: userEmail });
    const qrCodeDataUrl = await qrcode.toDataURL(uri);

    return {
      secret, // Store encrypted in DB temporary holding until verified
      qrCodeDataUrl,
    };
  }

  // Step 2: Confirm Setup with First Code
  static verifyCode(secret: string, token: string): boolean {
    // Allows 1 window (30s) clock drift tolerance backward or forward
    const result = verifyToken(secret, token, 1);
    return result !== null && result.delta >= -1 && result.delta <= 1;
  }
}
```

### 3.2 Single-Use Backup / Recovery Codes

Whenever a user enables MFA, generate **10 single-use emergency recovery codes**.
- Store the codes **hashed** (SHA-256 or Argon2id) in the database.
- Format: `xxxx-xxxx` (e.g., `a7d2-99fe`) for human readability.
- When an emergency code is used to authenticate, immediately delete or mark it as consumed.

```sql
CREATE TABLE user_mfa_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL, -- SHA-256 of code
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mfa_codes_user ON user_mfa_recovery_codes(user_id);
```

### 3.3 Passkeys & WebAuthn (FIDO2)

Passkeys replace passwords and MFA with public-key cryptography backed by secure hardware (Apple Touch ID / Face ID, Windows Hello, YubiKey).

- **Backend Library**: `@simplewebauthn/server`
- **Frontend Library**: `@simplewebauthn/browser`
- The server stores the user's `publicKey` and credential `counter` to detect cloning.
- Passkeys provide 100% phishing resistance because authentication is strictly bound to the origin domain by the browser.

---

## 4 - Authorization & Access Control Models

Authentication answers *"Who are you?"*; Authorization answers *"Are you allowed to do this?"*.

### 4.1 RBAC vs Granular Permissions vs ABAC

```
RECOMMENDED HYBRID: Role-to-Permission Mapping with Ownership Check
Roles contain permissions. Controllers guard against PERMISSIONS, not raw roles.
Services check RESOURCE OWNERSHIP.
```

```
[User] --assigned--? [Role (e.g., 'Editor')] --contains--? [Permissions ('article:read', 'article:write')]
                                                                     ¦
                                                                     ?
                                                Controller verifies 'article:write'
                                                                     ¦
                                                                     ?
                                                Service verifies article.authorId === user.id
```

### 4.2 Production Permission Guard Implementation

```typescript
// src/infrastructure/security/permissions.ts
export const Permissions = {
  // User domain
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_DELETE: 'user:delete',

  // Billing domain
  BILLING_READ: 'billing:read',
  BILLING_MANAGE: 'billing:manage',

  // Project domain
  PROJECT_READ: 'project:read',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
} as const;

export type Permission = typeof Permissions[keyof typeof Permissions];

export const RolePermissions: Record<string, Permission[]> = {
  admin: Object.values(Permissions),
  member: [
    Permissions.USER_READ,
    Permissions.PROJECT_READ,
    Permissions.PROJECT_CREATE,
    Permissions.PROJECT_UPDATE,
  ],
  viewer: [
    Permissions.USER_READ,
    Permissions.PROJECT_READ,
  ],
};
```

#### Permission Middleware
```typescript
// src/presentation/http/middleware/require-permission.ts
import { Request, Response, NextFunction } from 'express';
import { Permission, RolePermissions } from '../../../infrastructure/security/permissions';
import { ForbiddenError, UnauthorizedError } from '../../../domain/errors/app-errors';

export function requirePermission(requiredPermission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    const userPermissions = RolePermissions[user.role] ?? [];
    if (!userPermissions.includes(requiredPermission)) {
      throw new ForbiddenError(`Missing required permission: ${requiredPermission}`);
    }

    next();
  };
}
```

---

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

Even with `SameSite=Lax`, top-level GET navigations and certain cross-origin forms can send cookies.
1. **Rule of Idempotent GET**: GET, HEAD, and OPTIONS requests **must never** modify state or execute business logic.
2. **Double-Submit Cookie / Header Verification**:
   Require a non-simple custom HTTP header (e.g., `X-Requested-With: XMLHttpRequest` or `X-CSRF-Token`) on all state-modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`). Browsers prevent cross-origin HTML forms from attaching custom headers without explicit CORS preflight clearance.

```typescript
// src/presentation/http/middleware/csrf-check.ts
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../../../domain/errors/app-errors';

export function verifyCsrfHeader(req: Request, res: Response, next: NextFunction) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Modern browsers: check origin or referer matches server origin
  const origin = req.headers['origin'];
  const host = req.headers['host'];

  if (origin && !origin.includes(host!)) {
    throw new ForbiddenError('Cross-origin request blocked');
  }

  next();
}
```

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

---

## 6 - Rate Limiting, Brute Force & Account Lockout

> [!WARNING]
> Permanent account lockout allows attackers to trigger a Denial of Service against arbitrary users simply by submitting wrong passwords 5 times for known email addresses. Use **temporary exponential backoff** instead.

```
BRUTE-FORCE MITIGATION POLICY:
1. Per IP + Email tuple: Max 5 attempts per 15 minutes.
2. Global per IP: Max 20 failed login attempts across all accounts per 15 minutes.
3. On 3rd failed attempt: Require CAPTCHA (Cloudflare Turnstile).
4. On 5th failed attempt: 15-minute temporary cooldown.
5. Password reset requests: Max 3 requests per hour per email.
```

```typescript
// src/presentation/http/middleware/rate-limiter.ts
import rateLimit from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // Limit each IP to 5 failed login attempts per window
  standardHeaders: true,    // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,     // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: true, // Only count failed logins
  message: {
    status: 429,
    message: 'Too many failed login attempts. Please wait 15 minutes or reset your password.',
  },
});
```

---

## 7 - Security Event Audit Logging

Every identity state change must be emitted to structured logs for security incident response (SIEM / SOC).

| Event Type | Trigger | Severity | Key Attributes Logged |
|------------|---------|----------|------------------------|
| `auth.login.success` | Valid password / token / OAuth | INFO | `userId`, `ip`, `userAgent`, `authMethod` |
| `auth.login.failure` | Invalid password or user not found | WARN | `emailAttempted`, `ip`, `userAgent`, `reason` |
| `auth.mfa.challenge` | Prompting for TOTP code | INFO | `userId`, `ip` |
| `auth.mfa.failure` | Invalid TOTP code | WARN | `userId`, `ip`, `attemptCount` |
| `auth.password.changed`| Successful password change | NOTICE | `userId`, `ip`, `allSessionsRevoked: true` |
| `auth.token.reuse_detected` | Revoked refresh token submitted | CRITICAL | `userId`, `familyId`, `ip`, `userAgent` |
| `auth.logout` | User initiated session termination | INFO | `userId`, `sessionId` |

> [!CAUTION]
> Never log raw passwords, plain session tokens, TOTP secrets, or authorization header values in audit logs.

---

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

## ✅ Post-Implementation Checklist

Before finishing any authentication or authorization feature, verify every item:

- [ ] **Anti-Amnesia Receipt**: Output 1-line verification badge `🧠 [DevMind: auth-patterns applied | Checked: ...]` in response.

### AuthN Checklist
- [ ] Passwords hashed exclusively with **Argon2id** (preferred) or **bcrypt** ($2b$, cost $\ge 12$).
- [ ] No tokens stored in `localStorage` or `sessionStorage` in browser clients.
- [ ] Cookies configured with `HttpOnly; Secure; SameSite=Lax; Path=/`.
- [ ] Refresh tokens rotated on every single use; token reuse detection triggers immediate family revocation.
- [ ] User enumeration blocked on `/login`, `/register`, and `/forgot-password` (uniform responses and timing).
- [ ] Password reset tokens single-use, cryptographically random, hashed in DB, expired within $\le 15$ minutes.
- [ ] Changing passwords automatically revokes all other active sessions and tokens.
- [ ] Rate limiting active on login, registration, and reset endpoints.

### AuthZ Checklist
- [ ] Granular permissions verified in route middleware before executing controller handlers.
- [ ] Service layer verifies tenant ID and resource ownership (eliminating IDOR).
- [ ] Roles contain permissions; controllers never hard-code raw user role strings.
- [ ] Audit logs emit security events without logging passwords or plain session tokens.

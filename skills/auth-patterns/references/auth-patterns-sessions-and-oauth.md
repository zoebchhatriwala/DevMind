# Authentication and authorization: sessions and oauth

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

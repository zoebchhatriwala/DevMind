# Authentication and authorization: abuse and auditing

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

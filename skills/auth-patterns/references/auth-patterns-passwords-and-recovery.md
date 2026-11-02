# Authentication and authorization: passwords and recovery

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

### 2.4 Sensitive Account Changes

- Before changing a password, registered email, MFA factor, or recovery method, require recent authentication appropriate to the existing identity provider and risk. An old session alone must not let an attacker replace the account's recovery channels. Reuse the provider's step-up flow; do not invent a new factor for a routine patch.
- Bind verification to the account, intended new value, and operation; expire it and consume it once. Keep an email change pending until the new address is verified, and notify the existing verified channel. Changing the target after verification requires verification of the new target.
- Apply the change and invalidate relevant recovery tokens atomically. Revoke or rotate sessions according to the account's security policy, especially after suspected compromise. MFA removal/recovery needs its own strong proof, not merely knowledge of the account email.
- For federated account linking, require an authenticated linking flow that proves control of both identities. Identify an OIDC identity by validated issuer and subject; matching email addresses alone are not sufficient proof for automatic linking.

See [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#require-re-authentication-for-sensitive-features) and the existing provider's recovery/linking documentation.

### 2.5 User Enumeration Defense

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

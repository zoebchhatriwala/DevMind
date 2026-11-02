# Authentication and authorization: mfa and passkeys

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

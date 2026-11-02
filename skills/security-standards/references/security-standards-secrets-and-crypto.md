# Security boundaries: secrets and crypto

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

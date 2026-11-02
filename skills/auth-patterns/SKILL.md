---
name: auth-patterns
description: >-
  Implement or review login, sessions, OAuth/OIDC, password recovery, MFA, permission checks, and token lifecycle. Reuse the existing identity provider and auth library.
---

# Authentication and authorization

## 🚨 Pre-Flight Gate

Trace login through session creation, protected requests, refresh/revocation, and logout. Identify the identity provider, cookie/token transport, tenant boundary, and existing guards. For new auth architecture, resolve browser versus non-browser clients, account recovery, and access policy before implementation.

Inspect first: callers, existing helpers, dependencies, project instructions, and applicable tests. For a patch, infer stack decisions without an interview. For genuinely new architecture, ask only consequential unresolved questions with recommended defaults. Use `inspect.mjs <project> --json` from the installed skill's `scripts/`, the project's `.devmind/scripts/`, or this repository's root `scripts/`; verify the path first.

## ⚡ Golden Patterns

- Prefer the established provider and reviewed library over custom cryptography or token handling. Validate external identity claims server-side, including issuer, audience, expiry, and allowed algorithms where applicable.
- For browser sessions, use Secure, HttpOnly cookies with an appropriate SameSite policy and CSRF protection. Keep long-lived credentials out of browser storage and logs. Rotate session identifiers after login and privilege changes.
- Enforce authorization and object ownership at the server operation, including tenant scope. Hiding a control in the browser does not restrict access. Deny by default and test access as another user.
- Make refresh rotation/reuse detection atomic. Recovery tokens must be random, scoped, expiring, stored safely, and consumed once. Avoid account enumeration in login and recovery responses.
- Use the existing supported password hashing library and work factor, rate-limit abuse-prone operations, and preserve recovery and revocation paths. Do not add MFA or a new identity provider unless required.

## Topic references

The gates above are sufficient for small changes. Read a reference only when the task needs its examples; search headings and read the relevant slice. Existing framework conventions and these gates take precedence over example scaffolding.

- [sessions and oauth](./references/auth-patterns-sessions-and-oauth.md)
- [passwords and recovery](./references/auth-patterns-passwords-and-recovery.md)
- [mfa and passkeys](./references/auth-patterns-mfa-and-passkeys.md)
- [permissions](./references/auth-patterns-permissions.md)
- [session hardening](./references/auth-patterns-session-hardening.md)
- [abuse and auditing](./references/auth-patterns-abuse-and-auditing.md)
- [testing](./references/auth-patterns-testing.md)

## 🔍 Anti-Amnesia Receipt

Print once in the initial implementation update, using checks actually inspected:

`🧠 [DevMind: auth-patterns/<tier> | Checked: <three concrete checks>]`

## ✅ Post-Implementation Checklist

Verify success, unauthenticated access, forbidden cross-user/tenant access, expiry, and relevant replay or revocation behavior. Inspect logs and responses for credential leakage.

Run the existing relevant quality gates and a runnable check for changed non-trivial logic. Review the diff for extra abstractions, dependencies, duplicate state, and weakened controls. Use `verify.mjs <project> --json` as supporting evidence, not proof. Keep task/handover notes concise; finish with the outcome, actual check results, and material gaps.

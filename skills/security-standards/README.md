# security-standards

> Comprehensive security standards for fullstack applications grounded in NIST SSDF SP 800-218 v1.1 and OWASP ASVS 5.0.

## What it does

When activated, this skill instructs the agent to:

1. **Interview you** for security posture, compliance scope, and threat model requirements.
2. Apply **NIST SSDF** practices across the full software development lifecycle.
3. Enforce **OWASP ASVS 5.0 Level 2** controls on all application code.
4. Check **25 security domains** systematically (see table below).
5. Run a **master security checklist** before marking any release complete.

## Covered domains

| # | Domain | Standard |
|---|--------|---------|
| 1 | Secure Development Lifecycle | NIST SSDF SP 800-218 |
| 2 | Application Security | OWASP ASVS 5.0 |
| 3 | Secure Coding & Architecture | OWASP ASVS V15 |
| 4 | API Security | OWASP ASVS V13 |
| 5 | Authentication | OWASP ASVS V2 |
| 6 | Authorization | OWASP ASVS V4 |
| 7 | Input / Output | OWASP ASVS V5 |
| 8 | Database | OWASP ASVS V5, V8 |
| 9 | Secrets Management | OWASP ASVS V6, NIST SSDF PS.2 |
| 10 | Cryptography | OWASP ASVS V6 |
| 11 | Dependencies & Supply Chain | NIST SSDF PS, OWASP ASVS V14 |
| 12 | Error Handling | OWASP ASVS V7 |
| 13 | Logging & Auditing | OWASP ASVS V7 |
| 14 | Resilience | OWASP ASVS V12 |
| 15 | Concurrency | General + ASVS V4 |
| 16 | Performance | General |
| 17 | Testing (Security) | NIST SSDF PW.8 |
| 18 | Code Review | NIST SSDF PW.7 |
| 19 | CI/CD | NIST SSDF PO.3, OWASP ASVS V14 |
| 20 | Configuration | OWASP ASVS V14 |
| 21 | API Contracts | OWASP ASVS V13 |
| 22 | Architecture | NIST SSDF PW.1 |
| 23 | Data Protection | OWASP ASVS V8 |
| 24 | Operations | General |
| 25 | Documentation | NIST SSDF PO.1 |

## Works well with

- `fe-standards`  -  frontend companion; references this skill for security controls
- `be-standards`  -  backend patterns; references this skill for all security rules
- `db-standards`  -  database patterns; references Section 8 for DB security
- `api-design`  -  API contract design; references Section 21 for contract rules

## References

- [NIST SP 800-218 v1.1](https://csrc.nist.gov/pubs/sp/800/218/final)
- [OWASP ASVS 5.0](https://owasp.github.io/www-project-application-security-verification-standard/)
- [OWASP ASVS V15  -  Secure Coding and Architecture](https://github.com/OWASP/ASVS/blob/master/5.0/en/0x24-V15-Secure-Coding-and-Architecture.md)

# Security boundaries: review and threat model

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 1 - Secure Development (NIST SSDF)

Standard: NIST SP 800-218 v1.1, practices PO, PS, PW, RV.

| SSDF Practice | Rule |
|---------------|------|
| PO.1 | Define security requirements before implementation. Store in docs/security-requirements.md. |
| PO.3 | Integrate SAST, SCA, and secret scanning in CI before code merges. |
| PS.1 | All software components must have known, documented provenance. |
| PS.2 | Protect code from unauthorized access: branch protection, signed commits. |
| PS.3 | Archive each release full dependency graph (SBOM). |
| PW.1 | Use a threat model. Update when architecture changes. Minimum: STRIDE per feature. |
| PW.4 | Reuse vetted security components. No homebrew crypto, auth, or parsers. |
| PW.7 | Security-sensitive changes require a designated security-aware reviewer. |
| PW.8 | Test for all known vulnerability classes before release. |
| RV.1 | Maintain a vulnerability disclosure policy via SECURITY.md at repo root. |
| RV.3 | Remediation SLAs: Critical <= 24h, High <= 7d, Medium <= 30d. |

SECURITY.md template:

```markdown
# Security Policy

## Reporting a Vulnerability
Do NOT open a public GitHub issue for security vulnerabilities.
Email: security@YOUR_DOMAIN with subject "VULN: <summary>".
Response SLA: 48 hours acknowledgement, 7 days triage.

## Remediation SLAs
- Critical: 24 hours
- High: 7 days
- Medium: 30 days
```

---

## 2 - Application Security (OWASP ASVS 5.0)

Standard: OWASP ASVS 5.0, all chapters.
Default target: ASVS Level 2 for all devmind projects.

Key controls agents must verify in generated code:

| ASVS Ref | Control | Enforcement point |
|----------|---------|------------------|
| V2.1 | Password length >= 12, no max < 64 | Auth validation |
| V2.2 | No knowledge-based authentication (security questions) | Never generate KBA flows |
| V3.2 | New session token on login | Auth implementation |
| V3.4 | SameSite=Strict or Lax on session cookies | Cookie config |
| V4.1 | Server-side authorization on every request | No client-side-only guards |
| V5.1 | Input validation allowlist, not blocklist | All input handlers |
| V7.1 | No secrets in logs | Logging config |
| V8.1 | Sensitive data not stored beyond need | Data model review |
| V9.1 | TLS on all connections | Server/infra config |
| V13.1 | API authentication on all endpoints | Route guards |
| V14.2 | Dependencies up-to-date, no known critical CVEs | CI pipeline |

---

## 18 - Code Review (Security)

Standard: NIST SSDF PW.7.

Changes requiring a designated security-aware reviewer:
- Authentication or session management changes
- Authorization / access control changes
- Cryptographic implementation changes
- Any use of dangerous functions (see section 3)
- Dependency additions or major upgrades
- Infrastructure or CI/CD configuration changes
- Data model changes involving PII or sensitive data

Security code review checklist:
- [ ] No secrets or credentials in the diff
- [ ] Input validation present at all entry points
- [ ] Authorization check present on every new endpoint/action
- [ ] Error messages are sanitized (no stack traces, no internal paths)
- [ ] New dependencies scanned for known CVEs
- [ ] Logging added for new security events
- [ ] Tests cover the authorization boundary

---

## 22 - Architecture (NIST SSDF PW.1)

Rules:
- Document trust boundaries between all components.
- Apply defense in depth: never rely on a single security control.
- Separation of concerns: domain logic must not import infrastructure directly.
- Dependency direction: outer layers depend on inner; never reverse.
- Use Architecture Decision Records (ADRs) for security-sensitive decisions.
- Threat model every significant new feature - minimum STRIDE analysis.
- Minimize attack surface: remove unused endpoints, features, and dependencies.
- External services are untrusted - validate all data received from them.

ADR template for security decisions:
```markdown
# ADR-NNN: Title

**Date**: YYYY-MM-DD
**Status**: Accepted | Proposed | Deprecated

## Context
Why was this decision needed? What security concern does it address?

## Decision
What was decided?

## Threat model (STRIDE)
- Spoofing:
- Tampering:
- Repudiation:
- Information Disclosure:
- Denial of Service:
- Elevation of Privilege:

## Consequences
Security trade-offs of this decision.
```

---

## 25 - Documentation

Required documents per project:

| Document | Location | Contents |
|----------|----------|----------|
| docs/architecture.md | Repo root | System diagram, component responsibilities, data flows |
| docs/security-requirements.md | Repo root | ASVS level, compliance scope, security requirements |
| docs/threat-model.md | Repo root | Assets, threats (STRIDE), mitigations, residual risks |
| docs/security-assumptions.md | Repo root | Confirmed security requirements and assumptions |
| docs/api-contract.md or openapi.yaml | Repo root | Full API specification |
| docs/data-classification.md | Repo root | Data classification table and handling rules |
| docs/runbooks/ | Repo root | Operational procedures |
| docs/adr/ | Repo root | Architecture Decision Records |
| SECURITY.md | Repo root | Vulnerability disclosure policy |
| CHANGELOG.md | Repo root | Human-readable version history |

Documentation rules:
- Document security assumptions, not just what was built.
- Every known limitation or accepted risk documented with a mitigating control.
- Architecture diagrams must include trust boundaries and data flows.
- API contracts must include auth scheme, error shapes, and rate limit policy.
- Runbooks must be tested - a runbook no one has executed is not a runbook.

---

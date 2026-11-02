---
name: security-standards
description: >-
  Review or change security-sensitive boundaries: input validation, uploads, secrets, authorization, cryptography, browser policies, PII, and dependency risk. Apply controls relevant to the changed flow.
---

# Security boundaries

## 🚨 Pre-Flight Gate

Identify untrusted inputs, sensitive assets, execution authority, and the boundary crossed by the change. Trace real callers and existing controls before adding a guard. Use this entrypoint for ordinary boundary checks; load only the relevant topic for a deeper review. Security review does not authorize external scans or production changes.

Inspect first: callers, existing helpers, dependencies, project instructions, and applicable tests. For a patch, infer stack decisions without an interview. For genuinely new architecture, ask only consequential unresolved questions with recommended defaults. Use `inspect.mjs <project> --json` from the installed skill's `scripts/`, the project's `.devmind/scripts/`, or this repository's root `scripts/`; verify the path first.

## ⚡ Golden Patterns

- Validate external data at the boundary with existing schemas, use parameterized database operations and argument arrays for processes, and encode output for its rendering context. Avoid shell interpolation and unsafe HTML.
- Enforce authentication, authorization, ownership, and tenant scope where authority lives. Verify signatures and replay controls for external events. Client-provided role, price, or ownership is never authoritative.
- Use established cryptographic libraries and platform secret stores. Keep credentials out of source, browser bundles, errors, telemetry, and reports. Preserve redaction and least-privilege access.
- Bound payloads, file sizes, timeouts, concurrency, and retries. For uploads, validate permitted content and safe storage paths. For outbound requests, enforce allowed destinations and redirect behavior where SSRF is relevant.
- Reuse existing controls without adding a competing validator or security package. Evaluate changed dependencies with available audit tools and distinguish a finding from a confirmed exploit.

## Topic references

The gates above are sufficient for small changes. Read a reference only when the task needs its examples; search headings and read the relevant slice. Existing framework conventions and these gates take precedence over example scaffolding.

- [review and threat model](./references/security-standards-review-and-threat-model.md)
- [inputs and data](./references/security-standards-inputs-and-data.md)
- [identity and api](./references/security-standards-identity-and-api.md)
- [secrets and crypto](./references/security-standards-secrets-and-crypto.md)
- [supply chain and ci](./references/security-standards-supply-chain-and-ci.md)
- [errors and resilience](./references/security-standards-errors-and-resilience.md)
- [testing and operations](./references/security-standards-testing-and-operations.md)

## 🔍 Anti-Amnesia Receipt

Print once in the initial implementation update, using checks actually inspected:

`🧠 [DevMind: security-standards/<tier> | Checked: <three concrete checks>]`

## ✅ Post-Implementation Checklist

Trace the changed boundary and exercise valid, invalid, and denied input. Run applicable existing security checks, especially for changed dependencies or secrets. State evidence, confidence, and manual gaps; scanner output cannot certify security or compliance.

Run the existing relevant quality gates and a runnable check for changed non-trivial logic. Review the diff for extra abstractions, dependencies, duplicate state, and weakened controls. Use `verify.mjs <project> --json` as supporting evidence, not proof. Keep task/handover notes concise; finish with the outcome, actual check results, and material gaps.

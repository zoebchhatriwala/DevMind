# Security boundaries: supply chain and ci

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 11 - Dependencies and Supply Chain (NIST SSDF PS, OWASP ASVS V14)

Rules:
- Pin exact versions in lock files (package-lock.json, yarn.lock, pnpm-lock.yaml).
- Run npm audit / pnpm audit in CI; block merges on high/critical findings.
- Use Dependabot or Renovate for automated dependency upgrade PRs.
- Generate and maintain an SBOM (CycloneDX or SPDX format) per release.
- Remove all unused dependencies - they are unreviewed attack surface.
- Review the full changelog of any dependency before upgrading across major versions.
- Do not use packages abandoned for > 2 years without an active fork.
- Prefer packages with a SECURITY.md and responsible disclosure track record.

CI supply-chain pipeline:
```yaml
- name: Audit dependencies
  run: npm audit --audit-level=high

- name: Secret scan
  run: gitleaks detect --source=. --exit-code=1

- name: Generate SBOM
  run: npx @cyclonedx/cyclonedx-npm --output-file sbom.json
```

---

## 19 - CI/CD (NIST SSDF PO.3, PS.3)

Standard: NIST SSDF PO.3; OWASP ASVS V14.

Mandatory CI pipeline steps (all must pass before merge):
- lint:        eslint . and tsc --noEmit
- format:      prettier --check .
- test:        vitest run --coverage (or jest)
- audit:       npm audit --audit-level=high
- secret-scan: gitleaks detect --source=. --exit-code=1
- sast:        codeql analyze or semgrep --config=auto
- build:       npm run build
- sbom:        cyclonedx-npm --output-file sbom.json

Deployment rules:
- No deployment to production without all CI checks passing.
- Production deployments require approval (GitHub Environments, etc.).
- Every deployment artifact is immutable and tagged with a build SHA.
- Rollback procedure documented and tested.
- Production credentials are never accessible from developer machines.
- Use OIDC/STS for cloud auth from CI; no long-lived service account keys.

---

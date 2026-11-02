# Deployment and infrastructure: ci

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 2 - GitHub Actions CI/CD Pipeline Standards

Pipelines must be fast, deterministic, secure, and cost-efficient.

### 2.1 Continuous Integration (CI) Workflow: PR Validation

Every Pull Request must pass automated verification before merge. Outdated CI runs on subsequent pushes to the same PR branch must be cancelled automatically.

```yaml
# .github/workflows/ci.yml
name: CI Quality Gate

on:
  pull_request:
    branches: [main, master]
  push:
    branches: [main, master]

# Cancel previous runs on the same branch when a new commit is pushed
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: read
  security-events: write

jobs:
  lint-and-typecheck:
    name: Lint & Typecheck
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript Strict Check
        run: npm run typecheck

  test-suite:
    name: Unit & Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run Vitest Suite with Coverage
        run: npm run test:ci

  security-audit:
    name: Dependency Vulnerability Audit
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Audit Production Dependencies
        run: npm audit --omit=dev --audit-level=high

  docker-dry-run:
    name: Verify Docker Container Build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker Image (No Push)
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: app:test-build
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

# deployment

> CI/CD, Containerization, Infrastructure, and Production Deployment Standards.

## What it does

When activated, this skill instructs the agent to:

1. **Interview you** for hosting platform, CI/CD provider, containerization approach, zero-downtime strategy, reverse proxy, and secrets management.
2. Build hardened **multi-stage production Dockerfiles** running unprivileged (`USER appuser`), utilizing `dumb-init` for PID 1 signal management, and optimizing Docker layer caching.
3. Configure fast, deterministic **GitHub Actions CI/CD workflows** with dependency caching, strict linting, typechecking, Vitest execution, and concurrency control.
4. Eliminate static cloud credentials using **OpenID Connect (OIDC)** authentication for AWS/GCP deployments.
5. Implement true **zero-downtime rolling deployments** with differentiated `/healthz/live` and `/healthz/ready` probes.
6. Wire production **graceful shutdown sequences** handling `SIGTERM`, draining in-flight requests, and closing database connection pools before exit.
7. Configure modern **reverse proxies (Caddy / Nginx)** with automated TLS, HTTP/2 & HTTP/3, and strict security headers (HSTS, CSP).
8. Enforce **12-Factor App secrets management**, zero secrets in images, and structured JSON logging to `stdout`.

## Sections

| Sec | Topic |
|-----|-------|
| 0   | User interview (platform, CI/CD, container, zero-downtime, secrets) |
| 1   | Multi-stage production Dockerfiles (non-root, dumb-init, layer caching, .dockerignore) |
| 2   | GitHub Actions CI/CD pipeline standards (PR quality gate, concurrency, vulnerability audits) |
| 3   | Continuous delivery & OIDC authentication (zero static keys, automated pre-deploy migrations) |
| 4   | Zero-downtime deployment & graceful shutdown (liveness vs readiness, SIGTERM draining) |
| 5   | Reverse proxy & edge routing (Caddy production configuration, TLS, security headers) |
| 6   | Secrets management & the 12-factor app (environment validation, zero secrets in layers) |
| 7   | Production observability & monitoring (structured stdout logging, Pino) |
| 8   | Agent execution checklist (container checklist, pipeline checklist) |

## Works well with

- `be-standards`  -  backend engineering; handles graceful shutdown hooks, Pino logging, and health routes
- `security-standards`  -  security compliance; references for vulnerability scanning, secret storage, and NIST SSDF
- `db-standards`  -  database standards; executes pre-deploy migrations safely during CD deployment

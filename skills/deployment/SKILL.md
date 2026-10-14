---
name: deployment
description: >-
  CI/CD, Containerization, Infrastructure, and Production Deployment Standards.
  Activate when writing Dockerfiles, GitHub Actions workflows, reverse proxy configs, or deploy scripts.
  Covers: hardened multi-stage Docker builds (non-root user, dumb-init, layer caching),
  GitHub Actions CI/CD pipelines (PR quality gates, dependency caching, concurrency control),
  cloud deployments via OIDC (zero static credentials), zero-downtime rolling updates,
  health probes (/healthz/live vs /healthz/ready), graceful shutdown (SIGTERM draining), Caddy/Nginx reverse proxy,
  and 12-factor secrets management.
trigger: model_decision
---

# Deployment, CI/CD & Infrastructure Standards

> **Scope**: Containerization, automated CI/CD pipelines, cloud orchestration, and production release safety.
> **Audience**: Coding agents authoring Dockerfiles, GitHub Actions, server configurations, or release scripts.
> **Security Baseline**: Aligned with **NIST SSDF SP 800-218 (PS.1, PW.7, PW.8, RV.1)** and **CIS Docker / Kubernetes Benchmarks**.
> **Cross-Reference**: Image vulnerability scanning and secret management reference `security-standards`.

---

## 0 - Before You Write: Interview the User

Before generating Dockerfiles, pipeline workflows, or infrastructure configs, resolve deployment requirements with the user in a single turn. Skip any item already answered by existing repository files.

| # | Topic | ASK | Recommended Default |
|---|-------|-----|---------------------|
| 1 | Target Hosting Platform | AWS (ECS/EKS/Cloud Run), GCP, Railway, Render, Fly.io, Vercel, or VPS/Coolify? | Docker on AWS ECS / GCP Cloud Run (backend) + Vercel (frontend) |
| 2 | CI/CD Platform | GitHub Actions, GitLab CI, Bitbucket Pipelines, or CircleCI? | GitHub Actions |
| 3 | Container Strategy | Multi-stage Node/Bun Dockerfile (Alpine/Distroless), standalone binary, or PaaS buildpack? | Multi-stage Docker with non-root user |
| 4 | Deployment Strategy | Rolling update, Blue/Green, Canary, or Recreate? | Rolling update with zero-downtime health probes |
| 5 | Ingress & Reverse Proxy | Cloudflare, Caddy, Nginx, AWS ALB, or Platform-managed? | Cloudflare + Caddy / AWS ALB |
| 6 | Secrets Management | GitHub Secrets + AWS Secrets Manager, Infisical, Doppler, or Platform env vars? | Cloud-native Secrets Manager / Infisical |
| 7 | Infrastructure as Code | Terraform / OpenTofu, Pulumi, AWS CDK, or Platform UI/CLI? | Terraform / OpenTofu |
| 8 | Observability & Logs | Structured stdout (Datadog / Grafana Loki / CloudWatch), Sentry, and OpenTelemetry? | Pino stdout + Sentry error tracking |

Echo back an **infrastructure & deployment summary** for user confirmation before creating workflow or container files.

---

## 1 - Multi-Stage Production Dockerfiles

### 1.1 The Golden Rules of Production Containers

1. **Never run as root**: Always use `USER node` or create an unprivileged system user (`appuser:appgroup`).
2. **Multi-stage builds**: Keep build dependencies (compilers, devDependencies, TypeScript) out of the final runtime image.
3. **Layer caching**: Copy `package.json` and lockfiles first. Run install before copying application source code.
4. **Init process for PID 1**: Node.js does not reap zombie processes or handle Linux `SIGTERM` signals properly as PID 1. Use `dumb-init` or `tini`.
5. **Strict `.dockerignore`**: Never allow `.git`, `node_modules`, `.env*`, tests, or coverage reports to leak into image layers.

### 1.2 Production Backend Dockerfile (Node.js / Express / Fastify / NestJS)

```dockerfile
# syntax=docker/dockerfile:1.7-check

# ==========================================
# STAGE 1: Dependency Installation & Build
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build essentials for native addons if needed
RUN apk add --no-cache libc6-compat

# Copy dependency manifests first to leverage Docker layer caching
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./

# Install all dependencies (including devDependencies for build)
RUN \
  if [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  else echo "Lockfile missing!" && exit 1; \
  fi

# Copy application source code
COPY . .

# Run build step (e.g., tsc or vite build)
RUN npm run build

# Prune devDependencies to keep production layer small
RUN \
  if [ -f pnpm-lock.yaml ]; then pnpm prune --prod; \
  elif [ -f package-lock.json ]; then npm prune --omit=dev; \
  fi


# ==========================================
# STAGE 2: Minimal Production Runtime
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install dumb-init to properly handle PID 1, signals, and zombie reaping
RUN apk add --no-cache dumb-init

# Create unprivileged application user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy production dependencies and compiled artifacts from builder
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

# Switch to unprivileged user
USER appuser

EXPOSE 3000

# Instruct container runtime on how to terminate gracefully
STOPSIGNAL SIGTERM

# Run application using dumb-init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/app.js"]
```

### 1.3 Production `.dockerignore`

```
.git
.github
node_modules
dist
build
coverage
test
tests
*.test.ts
*.spec.ts
.env
.env.*
!.env.example
README.md
Dockerfile*
docker-compose*.yml
.vscode
.idea
*.log
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*
```

---

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

## 3 - Continuous Delivery (CD) & OIDC Authentication

### 3.1 Security Standard: Zero Long-Lived Cloud Keys

> [!CAUTION]
> Never store permanent `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in GitHub repository secrets. If secrets leak, attackers gain persistent access to your cloud infrastructure.
> Use **OpenID Connect (OIDC)** to request short-lived (1-hour) temporary STS credentials dynamically for each workflow run.

### 3.2 Production CD Workflow (GitHub Actions $\rightarrow$ AWS ECS / ECR)

```yaml
# .github/workflows/deploy.yml
name: CD Production Deployment

on:
  push:
    branches: [main]

permissions:
  id-token: write # Required for requesting the JWT from GitHub OIDC provider
  contents: read

jobs:
  deploy-production:
    name: Build, Migrate & Deploy
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      # 1. Authenticate securely via AWS OIDC (No static credentials)
      - name: Configure AWS Credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsDeploymentRole
          aws-region: us-east-1

      # 2. Log in to Amazon ECR
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      # 3. Build & Push Multi-Arch Docker Image
      - name: Build and Push Docker Image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ steps.login-ecr.outputs.registry }}/app-backend:${{ github.sha }}
            ${{ steps.login-ecr.outputs.registry }}/app-backend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # 4. Run Pre-Deploy Database Migrations (Transient Task)
      - name: Run Database Migrations
        run: |
          aws ecs run-task \
            --cluster production-cluster \
            --task-definition app-migration-task \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[subnet-abc],securityGroups=[sg-123],assignPublicIp=ENABLED}"

      # 5. Trigger Zero-Downtime Rolling Update on Service
      - name: Deploy to Amazon ECS
        run: |
          aws ecs update-service \
            --cluster production-cluster \
            --service backend-service \
            --force-new-deployment
```

---

## 4 - Zero-Downtime Deployment & Graceful Shutdown

During rolling deployments or autoscaling, load balancers continuously terminate old containers and route traffic to new ones. Without graceful shutdown handling, active client requests are abruptly aborted with `502 Bad Gateway` or `Connection Reset`.

### 4.1 Container Lifecycle Events

```
1. Orchestrator (K8s/ECS) sends SIGTERM to the application container.
2. Load Balancer deregisters container from routing pool (stops sending NEW requests).
3. Application enters SHUTTING_DOWN state.
4. Liveness probe continues returning 200 OK (process is still alive).
5. Readiness probe immediately returns 503 Service Unavailable (signals not to route traffic).
6. Application completes all currently in-flight requests (up to 30-second timeout).
7. Application closes DB pools, Redis connections, and message consumers.
8. Process exits cleanly with code 0.
```

### 4.2 Production Graceful Shutdown Implementation (Node.js)

```typescript
// src/server.ts
import { createServer } from 'node:http';
import { app } from './app';
import { dbPool } from './infrastructure/db';
import { redisClient } from './infrastructure/cache/redis';
import { logger } from './infrastructure/logging/logger';

const server = createServer(app);
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Application server successfully started');
});

// Flag indicating shutdown state
let isShuttingDown = false;

// Liveness & Readiness endpoints
app.get('/healthz/live', (req, res) => {
  // Liveness: Process is alive and responding
  res.status(200).json({ status: 'live' });
});

app.get('/healthz/ready', async (req, res) => {
  // Readiness: Ready to process traffic (fails if shutting down or DB disconnected)
  if (isShuttingDown) {
    return res.status(503).json({ status: 'shutting_down' });
  }

  try {
    // Ping database
    await dbPool.query('SELECT 1');
    return res.status(200).json({ status: 'ready' });
  } catch (error) {
    return res.status(503).json({ status: 'unhealthy', error: 'Database unreachable' });
  }
});

// Signals handler
const handleSignal = (signal: string) => {
  logger.info({ signal }, 'Shutdown signal received. Initiating graceful shutdown sequence...');
  isShuttingDown = true;

  // Set 25-second emergency force-kill timeout (orchestrator kill timeout is usually 30s)
  const forceKillTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 25000);
  forceKillTimer.unref();

  // 1. Stop receiving new HTTP requests
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, 'Error closing HTTP server');
      process.exit(1);
    }
    logger.info('HTTP server closed. In-flight requests drained.');

    // 2. Close external connections cleanly
    try {
      await dbPool.end();
      logger.info('Database pool drained and disconnected.');

      await redisClient.quit();
      logger.info('Redis client disconnected.');

      logger.info('Graceful shutdown complete. Exiting cleanly.');
      process.exit(0);
    } catch (cleanupErr) {
      logger.error({ cleanupErr }, 'Error during resource disconnection');
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => handleSignal('SIGTERM'));
process.on('SIGINT', () => handleSignal('SIGINT'));
```

---

## 5 - Reverse Proxy & Edge Routing (Caddy / Nginx)

Never expose Node.js runtime servers directly to the public internet. Front them with an edge proxy or reverse proxy (Caddy, Nginx, or AWS ALB) to handle TLS termination, request buffering, HTTP/2, compression, and security headers.

### 5.1 Production Caddyfile (Modern, Fast, Automated TLS)

```caddyfile
# /etc/caddy/Caddyfile
{
    email admin@example.com
    admin off
}

api.example.com {
    # Encode with Zstandard and Gzip
    encode zstd gzip

    # Upstream backend container
    reverse_proxy backend:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}

        # Health checks to upstream container
        health_uri /healthz/ready
        health_interval 5s
        health_timeout 2s
    }

    # Strict Production Security Headers
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        -Server # Strip server identity header
    }

    # Logging in structured JSON
    log {
        output stdout
        format json
    }
}
```

---

## 6 - Secrets Management & The 12-Factor App

### 6.1 Principles of Runtime Configuration

1. **Strict Separation of Config and Code**: Store configuration in environment variables, never in the repository.
2. **Zero Secrets in Docker Images**: Running `docker history <image>` or inspecting layers must never reveal database passwords or API keys.
3. **Fail-Fast Validation**: Application startup must immediately abort if required environment variables are missing or misconfigured (using Zod validation as enforced in `be-standards`).

```typescript
// src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
});

export const env = envSchema.parse(process.env);
```

---

## 7 - Production Observability & Monitoring

### 7.1 Structured Standard Output (stdout) Logging

Containers are ephemeral. Applications must **never write logs to local disk files** inside the container.
- Emit structured JSON directly to `stdout`.
- The container runtime / daemon (Docker, Kubernetes, AWS FireLens) captures stdout and ships logs to centralized aggregators (Datadog, Grafana Loki, AWS CloudWatch).

```typescript
// Fastify / Pino structured output
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.secret'],
    remove: true,
  },
});
```

---

## 8 - Agent Execution Checklist

Before finishing any deployment, infrastructure, or containerization task, verify:

### Container Checklist
- [ ] Base image uses minimal Alpine or Distroless image (`node:20-alpine`).
- [ ] Non-root user created and activated (`USER appuser`).
- [ ] Dependencies installed with frozen lockfile (`npm ci` or `pnpm install --frozen-lockfile`).
- [ ] Multi-stage build isolates build tools and devDependencies from runner image.
- [ ] PID 1 init wrapper included (`dumb-init` or `tini`) for signal handling.
- [ ] `.dockerignore` excludes `.git`, `node_modules`, `.env*`, tests, and local builds.

### Pipeline & Infrastructure Checklist
- [ ] GitHub Actions concurrency group cancels obsolete PR builds.
- [ ] No static long-lived cloud credentials in secrets; OIDC authentication used.
- [ ] Automated dependency vulnerability audit step runs in CI.
- [ ] Database migrations execute safely in an isolated pre-deploy step before updating services.
- [ ] `/healthz/live` and `/healthz/ready` endpoints separated and tested.
- [ ] Graceful shutdown drains in-flight requests and closes DB pools on `SIGTERM`.
- [ ] Reverse proxy applies HSTS, X-Content-Type-Options, and TLS 1.3.

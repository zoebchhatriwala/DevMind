# Deployment and infrastructure: containers

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

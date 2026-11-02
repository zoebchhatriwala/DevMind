# Deployment and infrastructure: observability

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

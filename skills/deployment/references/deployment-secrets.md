# Deployment and infrastructure: secrets

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

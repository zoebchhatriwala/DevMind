# API contracts: openapi

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 3 - Code-First OpenAPI 3.1 Generation from Zod

Never manually hand-edit large OpenAPI YAML files. Derive OpenAPI specifications directly from your application's single source of truth: **Zod schemas**.

```typescript
// src/presentation/http/schemas/user-api.schema.ts
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const UserResponseDtoSchema = z.object({
  id: z.string().uuid().openapi({ example: '01927e1b-85d7-7000-8000-000000000001' }),
  email: z.string().email().openapi({ example: 'alex@example.com' }),
  fullName: z.string().min(2).openapi({ example: 'Alex Developer' }),
  role: z.enum(['admin', 'member', 'viewer']).openapi({ example: 'member' }),
  createdAt: z.string().datetime().openapi({ example: '2026-10-14T10:00:00.000Z' }),
}).openapi('UserResponseDto');

export const CreateUserRequestSchema = z.object({
  email: z.string().email().openapi({ example: 'sarah@example.com' }),
  fullName: z.string().min(2).openapi({ example: 'Sarah Connor' }),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
}).openapi('CreateUserRequest');
```

#### Generating the OpenAPI Registry & Spec
```typescript
// src/presentation/http/openapi-registry.ts
import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { UserResponseDtoSchema, CreateUserRequestSchema } from './schemas/user-api.schema';

export const registry = new OpenAPIRegistry();

// Register Security Scheme
registry.registerComponent('securitySchemes', 'CookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'sid',
});

// Register Endpoint Route
registry.registerPath({
  method: 'post',
  path: '/api/v1/users',
  summary: 'Create a new user',
  description: 'Registers a new user within the organization and sends invitation.',
  security: [{ CookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateUserRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User successfully created',
      content: {
        'application/json': {
          schema: UserResponseDtoSchema,
        },
      },
    },
    422: {
      description: 'Validation failed',
    },
  },
});

export function generateOpenApiSpec() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'DevMind Core API',
      version: '1.0.0',
      description: 'Production REST API specification generated from typed Zod definitions.',
    },
    servers: [{ url: 'https://api.example.com' }],
  });
}
```

---

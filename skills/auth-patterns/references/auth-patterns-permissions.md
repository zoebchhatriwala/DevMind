# Authentication and authorization: permissions

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 4 - Authorization & Access Control Models

Authentication answers *"Who are you?"*; Authorization answers *"Are you allowed to do this?"*.

### 4.1 RBAC vs Granular Permissions vs ABAC

```
RECOMMENDED HYBRID: Role-to-Permission Mapping with Ownership Check
Roles contain permissions. Controllers guard against PERMISSIONS, not raw roles.
Services check RESOURCE OWNERSHIP.
```

```
[User] --assigned--? [Role (e.g., 'Editor')] --contains--? [Permissions ('article:read', 'article:write')]
                                                                     ¦
                                                                     ?
                                                Controller verifies 'article:write'
                                                                     ¦
                                                                     ?
                                                Service verifies article.authorId === user.id
```

### 4.2 Production Permission Guard Implementation

```typescript
// src/infrastructure/security/permissions.ts
export const Permissions = {
  // User domain
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_DELETE: 'user:delete',

  // Billing domain
  BILLING_READ: 'billing:read',
  BILLING_MANAGE: 'billing:manage',

  // Project domain
  PROJECT_READ: 'project:read',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
} as const;

export type Permission = typeof Permissions[keyof typeof Permissions];

export const RolePermissions: Record<string, Permission[]> = {
  admin: Object.values(Permissions),
  member: [
    Permissions.USER_READ,
    Permissions.PROJECT_READ,
    Permissions.PROJECT_CREATE,
    Permissions.PROJECT_UPDATE,
  ],
  viewer: [
    Permissions.USER_READ,
    Permissions.PROJECT_READ,
  ],
};
```

#### Permission Middleware
```typescript
// src/presentation/http/middleware/require-permission.ts
import { Request, Response, NextFunction } from 'express';
import { Permission, RolePermissions } from '../../../infrastructure/security/permissions';
import { ForbiddenError, UnauthorizedError } from '../../../domain/errors/app-errors';

export function requirePermission(requiredPermission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    const userPermissions = RolePermissions[user.role] ?? [];
    if (!userPermissions.includes(requiredPermission)) {
      throw new ForbiddenError(`Missing required permission: ${requiredPermission}`);
    }

    next();
  };
}
```

---

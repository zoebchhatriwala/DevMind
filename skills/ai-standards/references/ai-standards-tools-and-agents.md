# LLM applications: tools and agents

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 4 - Agent Systems & Tool Calling Platforms

### 4.1 Strict Schema Definitions
Every tool exposed to an agent must have an unambiguous name, clear description, and typed parameters with property descriptions:

```ts
import { z } from 'zod';

export const SearchUsersToolSchema = z.object({
  query: z.string().describe('Search string: name, email, or user ID'),
  department: z.enum(['engineering', 'sales', 'support', 'finance']).optional().describe('Filter by department'),
  limit: z.number().int().min(1).max(50).default(10).describe('Max records to return'),
});
```

### 4.2 Independent Tool Authorization Gates
Never execute a tool call based solely on the LLM's decision:
1. Parse arguments through the Zod schema.
2. Verify user session permissions deterministically in application code (`session.can('user:search')`).
3. If the tool mutates state (refunds, deletes, database writes), require a human confirmation step or an idempotency key.

### 4.3 Cycle Detection & Circuit Breakers
- Enforce `max_iterations = 5` (or 10 for complex multi-step pipelines).
- Track tool call hashes: if the agent generates the exact same tool name and arguments twice in a row, break the cycle and return an error to prompt re-planning.

---

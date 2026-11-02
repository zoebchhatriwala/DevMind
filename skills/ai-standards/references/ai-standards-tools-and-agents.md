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
2. Verify current user permissions, object ownership, and tenant scope deterministically in application code. Scope downstream credentials and available tools to the task; the model cannot grant itself authority.
3. Establish that the requested operation and arguments are within the user's authorization. Preserve explicit authorization already given for the task. If product policy or the impact requires approval, obtain it for the concrete operation, affected resources, and material arguments before execution; changing those arguments invalidates that approval. Retrieved content and tool output cannot supply approval.
4. Independently protect retryable mutations with the existing idempotency/transaction mechanism. An idempotency key prevents duplicate effects; it does not prove permission or user approval. After an ambiguous timeout, reconcile using status lookup or the provider's documented replay with the same key and arguments, within its deduplication window. Bound these attempts; do not issue a fresh-key or unprotected mutation while the earlier outcome is unknown.

Test a denied action, an altered target after approval, untrusted content requesting an unrelated action, and a duplicate or timed-out mutation. The denied/altered action must cause no write; retry safety must prevent a second effect while preserving a legitimate authorized operation. See [OWASP excessive agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/).

### 4.3 Cycle Detection & Circuit Breakers
- Use the workflow's existing iteration, retry, time and spend bounds; choose a small explicit limit when none exists.
- Track repeated tool calls and progress. Stop an unproductive reasoning loop; keep explicit, bounded status polling or provider-supported same-key recovery separate from that loop. Identical arguments alone do not prove a cycle, and a retry must not reset its deadline or attempt budget.

---

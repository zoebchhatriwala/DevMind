# LLM applications: conversation and streaming

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 3 - Chat Systems & Multi-Turn Conversations

### 3.1 Bounded Context Management
Unbounded arrays of messages (`messages: [...history]`) cause quadratic cost growth and sudden context limit crashes.

- **Sliding Window**: Retain system prompt + last 6–10 turns.
- **Recursive Summarization**: When history exceeds a threshold (e.g. 4,000 tokens), call a fast model (e.g. `gpt-4o-mini`, `claude-3-5-haiku`) to compress older turns into a single `<conversation_summary>` block:
  ```markdown
  <conversation_summary>
  User is building an OAuth 2.0 PKCE auth service in Node.js. Database is PostgreSQL.
  User previously confirmed they want to use Argon2id for password hashing.
  </conversation_summary>
  ```
- **Prompt Caching**: Keep static system instructions and tool schemas at the prompt prefix so providers (Anthropic, OpenAI, Gemini) cache tokens, slashing latency and cutting input costs by 80–90%.

### 3.2 Streaming & Provenance
- Use Server-Sent Events (SSE) for chat responses.
- Always attach an `AbortController` to cancel generation when the client disconnects, preventing wasted GPU compute.
- Emit citation tags (`[1]`, `[Doc Title](url)`) mapped directly to retrieved chunk IDs.

### 3.3 Silent Competence & Clean Product Integration
- **Server Isolation**: Prompts and AI orchestration belong exclusively in backend handlers or server actions. Never inline system prompts, keys, or templates in client-side components.
- **Humble Product Language**: Model outputs must be formatted as clean product data (JSON, markdown content), not conversational assistant filler ("Here is the requested analysis...").
- **No Raw Trace Spilling**: Chain-of-thought, thinking tokens, and intermediate prompt scaffolding must not leak into client-facing UI unless building a deliberate, developer-only debug drawer.

---

# ai-standards

> AI Agent, LLM, RAG, and Prompt Engineering Standards for production applications.

## What it does

When activated, this skill instructs the agent to:

1. **Interview you** for the AI task, model selection (Claude, GPT, Gemini, local), structured output format, retrieval strategy, guardrails, and evaluation approach.
2. Enforce the **Principle of Simplicity & YAGNI**: avoid overengineering, speculative vector databases, multi-agent frameworks, or unnecessary LLM calls.
3. Enforce **runtime structured output validation** using native Zod or Pydantic schemas on all model responses.
4. Keep **critical business logic, math, and authorization deterministic** in code rather than delegating them to the model.
5. Architect **secure RAG pipelines**: semantic chunking, metadata preservation, pre-retrieval access control, and the untrusted document principle.
6. Guard against **hallucinations and ungrounded claims** by enforcing strict citations and acknowledging missing or conflicting evidence.
7. Craft **structured, production-grade prompts** with clean separation between trusted instructions, user queries, and retrieved context.
8. Enforce **layered guardrails** against direct and indirect prompt injection attacks (OWASP Top 10 for LLMs).
9. Require **independent authorization and human-in-the-loop gates** for all high-impact or destructive tool calls.
10. Establish a **continuous evaluation and regression test suite** using the RAG triad (Context Relevance, Groundedness, Answer Relevance).
11. Audit and maintain **official, lightweight SDKs and dependencies** with zero known security vulnerabilities.

## Sections

| Sec | Topic |
|-----|-------|
| 0   | User interview (task mode, provider, schema, retrieval, security, evaluation) |
| 1   | Simplicity, minimal architecture & YAGNI (complexity ladder, anti-patterns) |
| 2   | LLM integration & reliability (model selection, Zod schemas, boundary validation) |
| 3   | RAG architecture (chunking, pre-retrieval access control, untrusted documents, groundedness) |
| 4   | Robust prompt engineering (anatomy of production prompt, delimiters, human tone) |
| 5   | Guardrails, security & safety (OWASP LLM Top 10, injection defense, tool authorization gates) |
| 6   | Evaluation, benchmarking & continuous feedback (RAG triad, regression suite, metrics) |
| 7   | Dependencies, SDKs & maintenance (official client SDKs, licensing, dependency audit) |
| 8   | Mandatory completion checklist (15-point verification checklist) |

## Works well with

- `be-standards` — backend engineering; hosts AI service endpoints, database adapters, and authentication
- `fe-standards` — frontend engineering; renders human, natural AI responses, streaming UI, and citations
- `security-standards` — security compliance; validates input sanitization, token secrets, and OWASP LLM controls
- `db-standards` — database patterns; implements `pgvector` indexing, hybrid search, and multi-tenant isolation
- `api-design` — API contracts; models streaming SSE endpoints and structured JSON tool payloads

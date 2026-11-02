---
name: ai-standards
description: >-
  Implement or review LLM integrations, prompts, retrieval, embeddings, tool calls, model routing, and AI evaluations. Optimize against measured task quality, latency, and cost.
---

# LLM applications

## 🚨 Pre-Flight Gate

Inspect the actual model adapter, prompts, data sources, tool schemas, authorization, budgets, and evaluations. For new architecture, resolve the user outcome, sensitive data, model/provider constraints, and success criteria. A simple completion does not require retrieval, reranking, agents, or a new evaluation framework.

Inspect first: callers, existing helpers, dependencies, project instructions, and applicable tests. For a patch, infer stack decisions without an interview. For genuinely new architecture, ask only consequential unresolved questions with recommended defaults. Use `inspect.mjs <project> --json` from the installed skill's `scripts/`, the project's `.devmind/scripts/`, or this repository's root `scripts/`; verify the path first.

## ⚡ Golden Patterns

- Separate trusted instructions from user and retrieved content. Treat tool output and retrieved text as untrusted data. Validate model output and tool arguments with runtime schemas before they affect application state.
- Authorize each tool action using the application identity and permissions. Model intent is not authorization. Bound iterations, retries, time, concurrency, and spend; preserve cancellation and avoid replaying non-idempotent actions.
- Retrieve only data the user may access, filtering tenant and permission scope before retrieval. Keep citations tied to observed source IDs. Add hybrid search, reranking, or larger context only when evaluations show the simpler baseline is inadequate.
- Keep conversation and retrieval context bounded. Preserve user constraints and provenance during summarization. Handle provider timeouts, malformed structured output, incomplete streams, and unavailable sources without fabricated success.
- Use the existing SDK and telemetry with secrets and PII redacted. Compare representative task quality, latency, and cost before claiming a prompt/model change improves results. Product copy describes the user's outcome.

## Topic references

The gates above are sufficient for small changes. Read a reference only when the task needs its examples; search headings and read the relevant slice. Existing framework conventions and these gates take precedence over example scaffolding.

- [retrieval](./references/ai-standards-retrieval.md)
- [prompts](./references/ai-standards-prompts.md)
- [conversation and streaming](./references/ai-standards-conversation-and-streaming.md)
- [tools and agents](./references/ai-standards-tools-and-agents.md)
- [evaluations](./references/ai-standards-evaluations.md)
- [guardrails and cost](./references/ai-standards-guardrails-and-cost.md)

## 🔍 Anti-Amnesia Receipt

Print once in the initial implementation update, using checks actually inspected:

`🧠 [DevMind: ai-standards/<tier> | Checked: <three concrete checks>]`

## ✅ Post-Implementation Checklist

Run a small representative evaluation for the changed behavior, including a malformed/denied tool call or provider failure when relevant. Record the model/settings, fixture, observed output, latency/cost when measured, and unresolved quality gaps.

Run the existing relevant quality gates and a runnable check for changed non-trivial logic. Review the diff for extra abstractions, dependencies, duplicate state, and weakened controls. Use `verify.mjs <project> --json` as supporting evidence, not proof. Keep task/handover notes concise; finish with the outcome, actual check results, and material gaps.

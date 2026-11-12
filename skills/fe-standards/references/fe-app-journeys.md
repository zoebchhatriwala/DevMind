# Web application journeys

Read when adding a multi-step application workflow or changing navigation, mutation state, permissions, or persistence. Ordinary copy/layout patches need only affected checks. Keep the existing router, design system, schema tools, and data layer.

## Build one complete user outcome

Trace the smallest useful journey through entry, input, server operation, persisted result, and reopening that result. Record the real entity and primary task, then complete that slice before adding surrounding screens. An invoice workflow succeeds when the saved invoice can be reopened, not when a toast appears.

| Contract | Question to resolve in the current implementation |
| --- | --- |
| Entry and navigation | Can a user enter by URL, refresh, and use back/forward without losing required context? |
| Authority | Which server operation verifies identity, ownership/tenant, and validated input? |
| Commit | When is the result durable, and what happens if the response is lost? |
| Recovery | What input survives denial, validation failure, timeout, or dependency outage? |
| Return | Does reopening/refetching show the committed result rather than an optimistic copy? |

## Navigation and state

Put shareable navigation state in the existing URL/router when appropriate: selected record, filters, page, or tab. Keep secrets and sensitive free text out of URLs, analytics, and logs. Use the existing query cache for server state, local state for transient interaction, and derived values without duplicate stores. Do not add a global state package merely because several screens exist.

Use the framework's existing loader/action or query/mutation path. Cover direct entry and refresh, missing/removed records, expired sessions, and back navigation. A hidden button is not authorization. Server operations must reject unauthorized requests independently of the rendered screen.

## Mutations and failures

Validate on the server using existing schemas; client validation improves feedback. Prevent accidental duplicate submissions locally and use the backend's idempotency contract where repeated effects matter. A timeout is an unknown outcome, not proof of failure. Check the operation result or retry using the existing stable identity before creating a duplicate invoice, booking, or charge.

Invalidate/refetch the existing cache or use its established optimistic rollback mechanism. Preserve entered data on recoverable failure. Announce errors usefully and keep focus near the relevant problem. Treat optimistic completion as provisional until the required commit succeeds.

Distinguish no records, no matching results, unavailable service, and no access. Each has a different useful next action. Do not invent integrations, backend persistence, progress percentages, or demo metrics to make a journey look complete.

## Verification

Run the normal path and one meaningful recovery path through the real application. Check direct URL entry/refresh, keyboard operation, supported widths, and reopening the saved entity. Exercise denied identity/ownership at the server boundary separately. Mocked browser responses establish UI behavior only; database/server integration needs its own evidence. Use the existing [verification tools](./fe-verification.md) and report gaps explicitly.

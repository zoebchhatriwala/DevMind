# Mobile lifecycle and offline recovery

Load for drafts, navigation races, offline mutations, synchronization, or background work. Determine whether the feature needs online-only writes, local drafts, or durable offline mutations. A network failure does not automatically require a synchronization engine.

## Ownership and interruption

Keep temporary UI state with its owner and persisted data in the existing storage/query layer. Reuse cancellation/request identity so late results from a prior screen, account, or search cannot overwrite current state. Dispose subscriptions and owned work.

Assume OS termination without a final callback. Persist promised drafts incrementally through existing storage facilities with a documented acceptable loss window. On cold start/resume, reload durable truth and revalidate stale authorization. Navigation or optimistic rendering does not prove persistence.

Partition private caches and queued mutations by account. Logout/account switch must prevent another user from seeing or replaying previous work. Revalidate authorization during sync; a queued mutation is not a permanent grant.

| Need | Smallest sufficient contract |
| --- | --- |
| Reading previous content | Bounded cache with freshness and honest stale state. |
| Filling a form offline | Local draft, explicit online submission, preserved input on failure. |
| Committing changes offline | Existing durable outbox with replay and conflict rules. |

Bound timeouts and retries; respect cancellation and server retry guidance. Validation/permission errors need recovery, not endless replay.

## Durable mutations, when required

Persist the mutation and stable operation ID together before claiming local commit. Dequeue only after a matching durable server acknowledgment. A lost response retries with the same ID; the server must deduplicate within a defined scope/retention window. Client bookkeeping alone cannot prevent duplicate server effects.

Define ordering for dependent work. A single worker is often sufficient; parallel replay needs explicit ownership/ordering. Handle crashes between send, acknowledgment, and local dequeue using the existing transactional store. In-memory arrays are not crash-safe. Surface conflicts/terminal errors instead of dropping work or silently overwriting newer data.

Background tasks run under OS constraints. Foreground resumption must recover even if background work never executes. Do not introduce persistent polling to simulate reliability.

## Evidence

When supported by the feature, test interruption after local commit, lost response after server commit, stable retry IDs, invalid acknowledgments, restart, account switch, and conflicts. Distinguish test doubles from actual storage/server integration.

The bundled `mobile-outbox-retry` task isolates acknowledgment ordering. It excludes persistence, concurrent workers, backoff, native background scheduling, and production deduplication; those remain integration checks.

Primary source: [Flutter offline-first alternatives](https://docs.flutter.dev/app-architecture/design-patterns/offline-first). Retain the user's framework idioms when applying the decision criteria.

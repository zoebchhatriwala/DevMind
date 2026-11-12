# Mobile standards

Use [SKILL.md](./SKILL.md) for installed iOS and Android applications. References cover lifecycle/offline recovery and device boundaries/releases without imposing a framework.

The `mobile-outbox-retry` task in `node scripts/eval.mjs --list` tests acknowledgment and replay in a single-worker Node contract. It does not replace device, persistence, or backend integration tests.

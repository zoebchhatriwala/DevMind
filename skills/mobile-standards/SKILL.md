---
name: mobile-standards
description: >-
  Build, modify, or review iOS and Android applications using React Native, Expo, Flutter, Swift, or Kotlin. Address lifecycle, device permissions, secure storage, deep links, offline recovery, and native release verification. Responsive websites alone do not need this guide.
---

# Mobile applications

Complete the journey on the device, including OS interruptions, denied permissions, and unreliable connectivity. Preserve the existing framework and native conventions.

## 🚨 Pre-Flight Gate

Inspect framework/version, navigation, state ownership, persistence, network client, manifests/entitlements, and device tests. Trace the changed screen to its storage/server operation. Use existing discovery tools for supported files, then inspect native configuration directly; a web-focused inventory is incomplete for Swift, Kotlin, and Dart.

For new architecture, resolve supported OSes, the primary journey, device features, connectivity needs, and distribution constraints only when unknown. Do not select a framework or build an offline queue without requirements.

Record action, permission, local/server commit, interruption, and recovery in task notes. Load only the needed reference:

- [Lifecycle and offline recovery](./references/mobile-lifecycle.md): cancellation, drafts, retries, and account changes.
- [Device boundaries and delivery](./references/mobile-boundaries.md): secrets, permissions, links, native UX, and releases.

## ⚡ Golden Patterns

- Distinguish view lifetime, app lifetime, and durable state. Backgrounding does not guarantee execution time; shutdown callbacks cannot reliably persist work. Save promised user work before claiming it is safe.
- Show truthful states: saved on device, waiting to synchronize, synchronized, or needs attention. Optimistic UI must retain recovery when the server rejects a change.
- Connectivity signals are hints; handle actual failures. A timeout may follow a server commit. Reuse stable operation IDs and server deduplication for mutations requiring safe retries; client retries alone cannot promise exactly-once effects.
- Use the stack's platform-backed secure credential storage. App bundles/build-time environment values cannot keep service secrets. Authorization and authoritative values remain on the server.
- Request device permissions in context. Explain the benefit and support denied, limited, and revoked access without repeated prompt loops.
- Respect native back/navigation, safe areas, keyboard insets, large text, and screen-reader semantics. Preserve entered values through reasonable interruptions. Avoid forcing web dashboard conventions onto a touch interface.
- Reuse schemas, storage, networking, and navigation. Do not add duplicate state, persistent background services, or a speculative synchronization engine.

## 🔍 Anti-Amnesia Receipt

Print once with checks actually inspected:

`🧠 [DevMind: mobile-standards applied | Checked: lifecycle traced, commit boundary identified, permission recovery reviewed]`

## ✅ Post-Implementation Checklist

Run existing project checks and a focused check for changed state transitions. The bundled `mobile-outbox-retry` evaluation covers a single-worker queue contract and lost acknowledgment. It does not prove persistence, native lifecycle behavior, or server deduplication.

Exercise the actual supported runtime: changed journey, back navigation, keyboard/large text, and relevant interruption, permission, timeout, and retry states. Check account switches for private cached data. Use release builds for performance/native integration claims; mobile browser emulation is insufficient. Report absent device/simulator, signing, store, and native checks as unverified. Update task and handover evidence.

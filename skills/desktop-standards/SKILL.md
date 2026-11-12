---
name: desktop-standards
description: >-
  Build, modify, or review installed desktop applications using Electron, Tauri, or native frameworks. Address privileged bridges, local files, window lifecycle, OS integration, packaging, and updates. A website viewed at desktop width does not need this guide.
---

# Desktop applications

Deliver the user's task in the installed application, including recovery when the OS, filesystem, or network interrupts it. A working development server is only one part of desktop delivery.

## 🚨 Pre-Flight Gate

Inspect the framework/version, view entrypoint, privileged handlers, window creation, storage, packaging, and supported operating systems. Search all callers of changed bridges or commands. Use the existing inspector and tests; do not switch frameworks for an incremental feature.

For new architecture, resolve supported OSes, the primary workflow, required device/file integrations, and distribution constraints only when unknown. Preserve supplied choices. Do not assume one desktop framework is universally preferable.

Record the changed journey in task notes: action, privilege crossed, data committed, interruption, and recovery. Load only the relevant reference:

- [Privilege boundaries](./references/desktop-boundaries.md): IPC, Tauri commands, file access, deep links, and external content.
- [Lifecycle and delivery](./references/desktop-delivery.md): windows, saving, packaging, and update recovery.

## ⚡ Golden Patterns

- Treat renderer messages as untrusted even when the UI ships locally. Authenticate the calling window/frame, validate the payload in the privileged handler, and authorize the resource. A typed bridge alone establishes none of these properties.
- Expose narrow domain operations such as `savePreferences`, not general shell, filesystem, IPC, or database access. Reuse framework isolation and permissions; check the installed version's behavior.
- File-picker selection grants an intended operation, not unrestricted access to future caller-supplied paths. Enforce authority and containment in the host. Keep credentials in the stack's OS-backed credential facility, separate from ordinary preferences.
- Keep slow IO and CPU work from blocking interaction. Bound work, support meaningful cancellation, and release listeners/resources when their owning window closes.
- Preserve OS conventions: menus, shortcuts, focus, accessibility, text scaling, multiple displays, and open/save dialogs. Do not force browser navigation onto a document application.
- Distinguish saved locally from synchronized remotely. Acknowledge only the required successful commit; preserve work and recovery on save/update failure.
- Reuse existing build, test, and release tooling. Do not add an updater, daemon, plugin system, or multi-window architecture for an unrelated feature.

## 🔍 Anti-Amnesia Receipt

Print once with checks actually inspected:

`🧠 [DevMind: desktop-standards applied | Checked: privileged callers traced, file authority reviewed, packaged journey identified]`

## ✅ Post-Implementation Checklist

Run existing project checks. Exercise a successful privileged operation plus denied callers, malformed payloads, and relevant IO failures. The bundled `desktop-ipc-authority` evaluation tests a synthetic handler contract; it does not launch Electron or prove packaged security.

For changed UI, run the actual application and inspect pointer, keyboard, focus, resizing, and applicable OS integration. For release changes, test the packaged build on each supported target, including upgrade/failure recovery. Browser screenshots cannot establish native behavior. Report unavailable OS, signing, hardware, and packaging checks as unverified. Update task and handover evidence.

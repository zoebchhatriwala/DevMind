# Desktop lifecycle and delivery

Load for window behavior, persistence, packaging, or updates. Preserve the existing toolkit and release process.

## User work and process lifetime

Determine whether closing hides a window, closes a document, or exits. Follow the application's OS conventions. Unsaved work needs deliberate save/discard/cancel outcomes; cancellation must leave the document usable. Unregister listeners, cancel owned work, and prevent callbacks to destroyed views.

Define success: memory, local commit, or server acknowledgment. For replaced files, use the stack's atomic-write pattern and preserve originals on failure. Atomic replacement alone does not guarantee power-loss durability; use stronger platform facilities when required. Handle read-only directories, full disks, locked files, and external changes without silently overwriting newer work.

Validate/migrate persisted state. Restore windows onto available displays so a disconnected monitor cannot strand them. Check menus, shortcuts, drag/drop, large text, screen readers, and focus on the supported OSes.

## Release artifacts and updates

Check current official target-specific instructions and installed framework versions before changing signing/updating. Developer launch, packaged launch, installer execution, OS code signing, and update authenticity are separate checks.

Record artifact/version, OS/architecture, install route, and results. Exercise first launch and upgrade from a supported prior version with existing data. Follow the product's retention policy on uninstall. Keep signing material in the existing secret facility, outside bundles/logs.

For an existing updater, verify artifacts with its supported signing mechanism. TLS alone does not authenticate a release artifact. Reject altered/incorrectly signed updates. Preserve a working installation and user data if download, verification, migration, or restart fails. Do not improvise downgrade recovery after irreversible migrations; plan compatible migrations or explicit recovery.

Use release builds and representative data for performance claims. Optimize observed UI blocking without speculative architectural replacement.

| Change | Useful behavior evidence |
| --- | --- |
| Local save | Reopen committed data; failed replacement preserves the original. |
| Window lifetime | Close/cancel/reopen works; no callbacks target destroyed views. |
| OS integration | The actual target handles associations, links, menus, or dialogs. |
| Packaging | A fresh install launches the packaged artifact on every claimed target. |
| Update | Prior supported versions upgrade; bad signatures/interruption are recoverable. |

Use existing Electron, WebDriver, native UI, or manual testing. Browser audits cannot verify installers, OS dialogs, signatures, or native accessibility. Leave unavailable environments unverified.

Primary sources: [Electron distribution](https://www.electronjs.org/docs/latest/tutorial/application-distribution), [Tauri distribution](https://v2.tauri.app/distribute/), [Tauri updater](https://v2.tauri.app/plugin/updater/).

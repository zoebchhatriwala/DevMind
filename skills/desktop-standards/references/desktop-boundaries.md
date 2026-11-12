# Desktop privilege boundaries

Read for IPC/commands, files, external URLs, or authentication callbacks. Inspect installed framework versions and actual handler registrations. The renderer, webview, and imported document supply input; the host owns authority.

## Electron

Use context isolation and renderer sandboxing; keep Node integration disabled in renderers. Inspect preloads, navigation, new-window behavior, and permission handlers together. A safe initial page is insufficient if navigation can replace it with hostile content.

Expose individual operations through the context bridge. Do not expose arbitrary channel invocation, `ipcRenderer`, or privileged event objects. Before side effects, verify the expected live sender/frame and allowed origin, validate the payload, then authorize the resource. Other windows and subframes must not inherit access accidentally. Match exact parsed origins, not URL substrings/prefixes. Avoid treating opaque `file:` origins as app identity; follow custom-protocol guidance.

Use a restrictive CSP and explicit permission decisions. Parse external URLs and allow only required protocols/destinations before opening them. Do not expose caller-selected shell commands; justified subprocesses use fixed executables and argument arrays.

Primary source: [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

## Tauri

Inspect capability files, plugin permissions/scopes, custom commands, and window/webview labels together. Avoid broad filesystem/shell scopes or granting remote sources native permissions to fix a development error.

Do not assume capability files restrict every custom command. The documentation distinguishes registered app commands, allowed by default, from commands included in the app manifest for permission control. Check `AppManifest::commands` and the installed version's actual permission configuration. A capability name or Rust argument type does not prove resource authorization or valid business input. Commands still check authority, payloads, and resources.

Primary source: [Tauri capabilities and custom commands](https://v2.tauri.app/security/capabilities/).

## Files and incoming links

Prefer host-issued identifiers tied to approved documents or picker results over arbitrary renderer-supplied absolute paths. Scope grants to the operation and necessary lifetime. For directory containment, resolve paths with segment semantics, including symlinks, existing parents for new files, and Windows volumes. Prefix checks are insufficient. Address check/open races using platform-supported safe handles/flags or restrict the operation; do not claim a general sandbox from a path helper.

Bound imported file size and parser work. Treat document HTML, links, archives, and metadata as untrusted. Preserve original files on parse/write failure and avoid logging private paths/content by default.

Route deep links through an allowlisted grammar on cold start and in an existing process. Links cannot confer file authority or authenticated identity. Authentication callbacks retain the existing OAuth state/PKCE checks. Duplicate link delivery must not repeat destructive work.

## Evidence

Record caller -> host -> resource -> side effect. Exercise denied windows/frames, malformed inputs, unwanted navigation, dangerous schemes, path escapes, and an applicable IO failure. Verify denied calls produce no side effects. Test doubles establish only their contracts; repeat applicable checks in the real runtime.

# Device boundaries and release evidence

Load for credentials, permissions, incoming links, device APIs, and release changes. Check installed framework versions and current platform documentation before changing manifests, entitlements, or store configuration.

## Credentials and links

App code, resources, and build-time environment values are inspectable. Keep service secrets on the server. Use existing platform-backed secure storage for necessary tokens, with deliberate backup, device-lock, and invalidation behavior. Ordinary preferences/databases are not secure credential stores. Never log tokens, callback codes, or private notification content.

Reuse system-browser/native authentication with applicable PKCE/state checks. Do not introduce permissive authentication webviews. Validate incoming URLs by scheme, destination, path grammar, and parameter schema, routing only known actions. Verified app links help routing ownership; they do not authorize record access. Notifications/links are untrusted navigation input on cold start and duplicate delivery.

Primary source: [React Native security guidance](https://reactnative.dev/docs/security).

## Permissions and interaction

Request the smallest permission for the action, using existing native integrations. Prefer scoped OS pickers when sufficient. Handle first request, denial, restricted/limited access, and revocation. Offer alternatives or an appropriate settings route; do not reopen prompts the OS will not show again.

Inspect platform declarations and runtime behavior together. Test cancellation/unavailable hardware. Release camera/location/file resources with their owner. Background access requires an explicit product need and current platform review.

Respect safe areas, keyboard insets, native back gestures, and large text. Use meaningful native accessibility roles, labels, values, and announcements. Provide alternatives to gesture-only actions and check focus after navigation/dialogs. DOM checks do not review the native accessibility tree.

Use existing virtualized lists for representative large datasets. Measure startup, frames, memory, and battery/network work on representative hardware in a release build before adding optimization machinery.

## Delivery

Reuse simulator/device tests and release scripts. Record OS/version, device/emulator, artifact/build type, journey, and observations. Web exports cannot establish native compatibility.

For release changes, verify clean install and upgrade with prior data, production configuration, relevant permissions/entitlements, and signing through the existing pipeline. Check current privacy/disclosure rules when data collection changes. Keep signing material out of bundles/logs. Existing over-the-air updates need native-runtime compatibility and their supported integrity/recovery model.

Report absent hardware, OS runners, signing, and store checks as unverified. Mocked permissions, unit tests, and phone-sized browser screenshots are not device verification.

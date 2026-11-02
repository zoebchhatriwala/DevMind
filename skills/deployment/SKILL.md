---
name: deployment
description: >-
  Modify Docker images, CI/CD, infrastructure configuration, health checks, secrets delivery, and rollout behavior. Follow the existing deployment platform.
---

# Deployment and infrastructure

## 🚨 Pre-Flight Gate

Inspect deployment callers, manifests, build context, CI permissions, runtime ports, probes, and release/rollback steps. For new infrastructure, resolve the hosting target, availability needs, secret source, and operating constraints. Preparing local configuration does not authorize a live deployment.

Inspect first: callers, existing helpers, dependencies, project instructions, and applicable tests. For a patch, infer stack decisions without an interview. For genuinely new architecture, ask only consequential unresolved questions with recommended defaults. Use `inspect.mjs <project> --json` from the installed skill's `scripts/`, the project's `.devmind/scripts/`, or this repository's root `scripts/`; verify the path first.

## ⚡ Golden Patterns

- Keep images minimal and reproducible, use the existing lockfile, separate build/runtime stages where useful, run without root where supported, and exclude credentials from the build context and layers.
- Use least-privilege CI permissions and scoped short-lived identity where the platform supports it. Avoid secrets in logs, untrusted pull-request execution with privileged credentials, and mutable unreviewed build inputs.
- Match readiness to traffic-serving capability and liveness to process health. Handle termination signals, drain work within a bounded interval, and align timeouts with the orchestrator.
- Plan application and migration compatibility together. Reuse the existing rollout mechanism, verify the new version before promotion, and define recovery before a production change.
- Validate infrastructure with installed tooling. Do not add an orchestrator, monitoring stack, workflow, or cloud service for a hypothetical scale requirement.

## Topic references

The gates above are sufficient for small changes. Read a reference only when the task needs its examples; search headings and read the relevant slice. Existing framework conventions and these gates take precedence over example scaffolding.

- [containers](./references/deployment-containers.md)
- [ci](./references/deployment-ci.md)
- [delivery and identity](./references/deployment-delivery-and-identity.md)
- [rollouts and shutdown](./references/deployment-rollouts-and-shutdown.md)
- [proxy routing](./references/deployment-proxy-routing.md)
- [secrets](./references/deployment-secrets.md)
- [observability and recovery](./references/deployment-observability.md): read for production signals, alerts, reliability objectives, or state recovery; a small configuration patch does not require a monitoring stack.

## 🔍 Anti-Amnesia Receipt

Print once in the initial implementation update, using checks actually inspected:

`🧠 [DevMind: deployment/<tier> | Checked: <three concrete checks>]`

## ✅ Post-Implementation Checklist

Run relevant existing config validation and build checks. Where possible, start the image and exercise health and shutdown behavior. Report live rollout, provider policy, and recovery steps that were not exercised.

Run the existing relevant quality gates and a runnable check for changed non-trivial logic. Review the diff for extra abstractions, dependencies, duplicate state, and weakened controls. Use `verify.mjs <project> --json` as supporting evidence, not proof. Keep task/handover notes concise; finish with the outcome, actual check results, and material gaps.

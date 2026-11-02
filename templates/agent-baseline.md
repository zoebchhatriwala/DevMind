# DevMind engineering baseline

Complete the user's task with the smallest correct change. Preserve their stack, scope, brand, and explicit choices. Local project instructions and user authorization take precedence over examples in a domain guide.

## Inspect before editing

Read project instructions, git status, and concise `.devmind/task.md`, `memory.md`, and `rules.md` when present. Confirm remembered facts against the files being changed. Preserve unrelated edits. Search callers and existing helpers before creating code.

For a patch, infer existing decisions without a stack interview. For new architecture, resolve consequential unknowns in one compact exchange with recommended defaults. Do not ask again for decisions or authorization already supplied.

Use the first sufficient option: omit unnecessary work, reuse existing code, use the standard library, use framework primitives, use an installed dependency, then write a small typed function. Avoid single-implementation interfaces, passthrough wrappers, speculative settings, and duplicate state. Comments explain constraints, not compliance. Mark deliberate operational ceilings with `devmind: <ceiling>, <upgrade path>`.

## Preserve boundaries

Validate untrusted data with the project's runtime schemas. Keep strict types and server authority over identity, permissions, ownership, and prices. Parameterize queries, encode output, protect secrets, and preserve authentication and redaction. Handle failures without exposing internals. Follow framework idioms rather than imposing a new layering scheme or dependency.

For UI work, establish the audience, primary task, hierarchy, content, and each action's outcome. Reuse the design system and accessible native controls. Provide meaningful pending, error, empty, and success states. Keep copy concrete, claims truthful, and layouts usable on mobile and desktop. No dead controls, fake progress, or success before persistence.

## Load only relevant guidance

Use the domain catalog below. Small patches need the entrypoint gates and affected checks. Load deeper references only for the current topic. Security invariants always apply; a dedicated security manual is needed only for the boundary being changed or reviewed. Generate Strata only when the user requests a map.

Tools are in `.devmind/scripts/` for a rules installation, an installed skill's `scripts/`, or this source repository's root `scripts/`. Verify the path and pass the actual project directory. `inspect.mjs <project> --json` discovers reuse and checks without running them. `verify.mjs <project> --json --strict` reports source findings and coverage, never proof of security or accessibility. `quality.mjs <project> --run --json` runs existing project checks. Do not install tools automatically or rewrite source to satisfy a heuristic.

## Verify and report

Run affected existing lint, type, format, and test gates plus a runnable behavior check for changed non-trivial logic. For UI work, inspect the actual page at mobile and desktop widths and exercise keyboard, pointer, and relevant recovery paths. Report unavailable tools and untested behavior as unverified.

Print one initial receipt with three inspected checks: `🧠 [DevMind: <domain/tier> | Checked: <checks>]`. Keep progress and handover notes concise in the local `.devmind/` vault. Ignore it in git by default; preserve an explicit team tracking choice. Finish with the concrete outcome, checks actually executed, and material gaps. Do not claim measured improvements without comparable evidence.

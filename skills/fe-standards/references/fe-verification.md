# Verification and skill evaluation

Use the installed skill's `scripts/` paths or the local `.devmind/scripts/` copies. Pass the real project directory. Tools do not install dependencies automatically.

## Scale verification to the change

| Change | Required evidence |
| --- | --- |
| Copy or spacing patch | Inspect affected component, run relevant existing checks, review the affected viewport/state. Do not rebuild unrelated journeys. |
| Component behavior | Verify changed behavior, its failure/recovery path, keyboard use, and at least one unchanged caller where shared code changes. |
| Page or user journey | Mobile/desktop captures, meaningful state transitions, real assertions, existing code checks, and visual observations. |
| Trust boundary | Trace validation, authorization, and server authority through actual callers; add a runnable negative-path check. Source patterns alone are insufficient. |

For a targeted change, raw browser artifacts and relevant check results are sufficient; the full aggregate review is primarily for page/journey work and release review. Record why broader checks are unnecessary rather than silently marking them passed.

## Source and project checks

```text
node <skill>/scripts/inspect.mjs <project> --json
node <skill>/scripts/verify.mjs <project> --json --strict
node <skill>/scripts/quality.mjs <project> --json
node <skill>/scripts/quality.mjs <project> --run --json
```

`verify` reuses an installed TypeScript compiler API for supported JS/TS/JSX/TSX AST checks. Unsupported syntax and other checks retain labeled lexical hints. `--tooling <directory>` can select an existing tooling workspace. Missing or incompatible parser APIs are reported rather than silently treated as semantic analysis. Neither parsing nor the presence of a schema proves authorization or data-flow correctness.

The implementation uses the documented [TypeScript compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API). Compiler APIs can change across major releases; capability detection and actual project checks remain necessary.

`quality` first discovers existing root package scripts: format:check/check:format, lint, typecheck/type-check/check:types, and test. Only `--run` executes those project scripts. Read the package commands before running in an unfamiliar repository. The tool uses npm to invoke existing scripts, never installs packages, does not claim missing scripts passed, and refuses direct recursive quality/review commands. For monorepos, run it in the relevant package or use existing workspace-level scripts. For other toolchains, run established commands directly and retain their results; do not add a competing JS toolchain.

Command output is omitted from the report to avoid copying sensitive project logs. Failed script names and exit codes identify the command to rerun locally for diagnostics.

## Browser plans

Start the project's existing development/test server yourself using the established command. Run the audit against an isolated loopback URL. It does not start a server, log into a personal browser profile, or click unspecified controls.

```text
node <skill>/scripts/browser-audit.mjs <project> http://127.0.0.1:3000 --plan browser-plan.json --json
```

Reuse installed playwright, @playwright/test, or playwright-core. `--channel chrome` or `--channel msedge` selects an installed browser. `--tooling <directory>` reuses a separate existing installation. No package or browser is downloaded automatically.

Browser operations follow the official [Page](https://playwright.dev/docs/api/class-page), [Locator](https://playwright.dev/docs/api/class-locator), and [BrowserContext](https://playwright.dev/docs/api/class-browsercontext) APIs. Verify compatibility with the installed version rather than assuming every version supports the newest API.

```json
{
  "version": 1,
  "viewports": [{ "width": 390, "height": 844 }, { "width": 1440, "height": 900 }],
  "responses": [{ "path": "/api/invoices", "status": 503, "body": { "error": "unavailable" } }],
  "steps": [
    { "action": "fill", "label": "Client", "value": "Riverton Studio" },
    { "action": "fill", "label": "Amount", "value": "4250" },
    { "action": "click", "role": "button", "name": "Save invoice" },
    { "action": "expectText", "role": "alert", "value": "Could not save invoice" },
    { "action": "expectValue", "label": "Client", "value": "Riverton Studio" }
  ]
}
```

Locators use a CSS selector, an accessible label, or a role/name pair. Actions include click, fill, press, select, and check. Assertions include expectVisible, expectHidden, expectText, expectValue, expectCount, and expectFocused. Count, value, and focus assertions inspect the current state; precede them with a visible-state expectation when asynchronous work must settle. Text checks match the whole normalized text, so "Not Saved" cannot satisfy "Saved". Text/visibility checks wait for the target. Use press Tab and expectFocused steps to test the intended keyboard journey, not just pointer interaction.

Each viewport gets a fresh context, initial/final screenshots, DOM hints for overflow and missing names/alt, and runtime error counts. HTTP(S) requests to other origins are blocked. Mock responses are local fixtures and do not prove the real backend works. Non-GET/HEAD requests are blocked unless mocked or `allowMutations: true` is explicitly supplied for an isolated test environment. Add real backend tests separately.

Screenshots mask password fields and elements marked data-private. Other private data can still appear; use synthetic test records and review artifacts before sharing them. Browser logs are counted rather than copied into reports. Missing packages/browsers are not-run, not passed. An audit without outcome assertions remains incomplete.

## Evidence report

```text
node <skill>/scripts/review.mjs <project> --quality .devmind/quality.json --browser .devmind/browser/report.json --assessment .devmind/assessment.json --scope ui --json
```

Create the assessment only after inspecting the real screenshots and interactions. Copy the sourceDigest from the current browser report. Use version 1, a reviewer name, and criteria entries for task-fit, hierarchy, composition, content, responsive, keyboard, and states. Each reviewed entry needs status (passed/failed/not-run), concrete notes, and evidence paths relative to the project. Omitted criteria remain not-run.

```json
{
  "version": 1,
  "sourceDigest": "copy-from-the-current-browser-report",
  "reviewer": "reviewing agent or person",
  "criteria": [{
    "id": "responsive",
    "status": "passed",
    "notes": "At 390px, the long client name wraps and the page has no horizontal overflow.",
    "evidence": [".devmind/browser/1-390x844-final.png"]
  }]
}
```

Review rejects mismatched source fingerprints, inconsistent report status, missing/changed screenshot files, and missing assessment evidence files. Visual criteria must reference current screenshot artifacts. Files remain editable artifacts, not signed attestations. A passed report describes supplied coverage; it does not certify universal security, accessibility, or visual quality.

## Evaluate the skill's actual output

```text
node <skill>/scripts/eval.mjs --list
node <skill>/scripts/eval.mjs --case accessibility-fix --prepare .devmind/evals/candidate
node <skill>/scripts/eval.mjs .devmind/evals/candidate --case accessibility-fix --url http://127.0.0.1:3000 --json
```

Preparation writes only into an empty child directory of the current working directory and never overwrites existing work. Give the agent TASK.md plus the seed files and the skill being evaluated. The five cases cover invoice success/failure, search/reset, a print storefront, keyboard accessibility, and a shared component extension. The runner checks actual candidate artifacts; it does not invoke a model on its own or treat helper-unit tests as skill-quality evidence.

Run a baseline and revised skill against identical seeds, task wording, model/settings, environment, and viewport plans. Do not give the agent the intended patch. Use an independent reviewer where available and authorized. Retain failures as well as successes, use the same rubric, and repeat runs before claiming a general improvement. `--baseline report.json` compares recorded outcomes for the same case; it does not calculate an "AI slop score". Inspect code reuse and screenshots using the case's review notes. Attach a current combined review using `--review` when the reviewer assessment is complete.

`behaviorStatus` describes executed source and browser task checks. Overall `status` also requires the reviewer assessment. A targeted patch can have successful behavior checks and sufficient raw review evidence while the full evaluation remains incomplete. Do not turn missing project tooling into a reason to install a ceremonial test framework or mark unrun checks passed.

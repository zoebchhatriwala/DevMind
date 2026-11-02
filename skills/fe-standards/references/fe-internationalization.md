# Internationalization and locale-sensitive interfaces

Read when the product needs multiple languages, locale-sensitive formatting, or right-to-left content. Inspect supported locales, locale selection/persistence, message catalogs, and existing framework utilities first. A single-language copy change does not justify a translation dependency or language selector.

## Keep meaning separate from presentation

- Reuse the established locale source and fallback. Distinguish language, regional formatting, currency, and time zone: one does not reliably determine the others. Do not infer billing currency from browser language.
- Use existing formatting helpers or native `Intl.NumberFormat` and `Intl.DateTimeFormat` with the chosen locale and relevant currency/time zone. Preserve canonical numeric/date values for calculations and APIs; formatted strings are display values. Handle localized input with the project's established parser and validation boundary.
- Treat calendar dates, such as a birthday, separately from instants. Follow the domain's time-zone policy rather than shifting a date-only value through the machine's default time zone. Server and client should use consistent locale/time-zone inputs for initial rendering.
- Translate complete messages with named placeholders. Do not concatenate sentence fragments or assume `count === 1` covers every language. Reuse the installed message system's plural rules or `Intl.PluralRules` when implementing a small, justified formatter. Preserve ordinary text escaping; translations do not authorize raw HTML.

The [ECMAScript internationalization specification](https://tc39.es/ecma402/) defines the native formatting and plural APIs. Use the runtime's supported locales; do not silently claim a locale is supported because a formatter accepted its name.

## Language and direction belong in the interface

Follow [W3C internationalization guidance](https://www.w3.org/International/quicktips/): declare the document language and mark language changes where needed. Set the appropriate base `dir` for supported RTL content; prefer logical spacing/alignment properties over hard-coded left/right assumptions. Isolate mixed-direction user content with an appropriate native mechanism such as `bdi`; avoid reversing strings or mirroring every icon indiscriminately.

Allow translated labels to wrap or grow without hiding controls. Use the same messages for visible and accessible names where appropriate. Preserve real names, addresses, and Unicode text instead of imposing an English-only character pattern. Use supplied or reviewed translations; label placeholders honestly rather than inventing production translations.

## Observable checks

Use representative fixtures for each affected locale: long translated labels, zero/one/multiple counts, currency/decimal grouping, a date near a time-zone boundary, and mixed-direction content if RTL is supported. Assert the displayed result, document language/direction, and the unchanged canonical value submitted to the server. Exercise the critical keyboard journey at a narrow viewport. Test a missing message or unsupported locale through the existing fallback.

An English-only fixture or a visually mirrored screenshot does not establish localization correctness. Report locales, runtime support, reviewed translations, and browser checks actually exercised; leave untested cases explicit.

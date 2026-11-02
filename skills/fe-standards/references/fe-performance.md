# Frontend performance

Read for a measured slowdown, performance requirement, or substantial change to client code/assets. Reuse the project's build, browser, and framework tools. A copy or spacing patch does not require a new benchmark suite or monitoring service.

## Choose a meaningful measurement

Identify the affected route and user action, representative data volume, supported browser/device, and network conditions. Capture a baseline before optimizing and repeat under the same conditions. Use a production build for representative bundle and loading measurements; development instrumentation can change results.

- For page loading, responsiveness, and visual stability, inspect [Core Web Vitals](https://web.dev/articles/vitals): LCP, INP, and CLS. A local lab run helps diagnose a regression; it does not establish real-user percentile performance. Lighthouse's TBT is a lab diagnostic, not an INP measurement.
- For an application task, also measure the actual bottleneck: typing/filtering latency, navigation, rendering a representative list, or completion of a save. Separate network/server wait from main-thread rendering work before choosing a fix.
- Use existing field telemetry when authorized and available. Record its date range, device segment, and sample limitations. Do not add analytics or claim field results from screenshots or a single local run.

Choose budgets from the product's target devices, user needs, existing baseline, and delivery constraints. A budget might limit transferred JavaScript on one route or latency of a frequent interaction. Record the measurement method and acceptable regression; avoid a universal bundle size or Lighthouse score. Reuse an existing CI budget when present.

## Fix the observed bottleneck

Prefer the framework's existing image, font, route-loading, and cache facilities over custom loaders. Inspect the actual waterfall and bundle before adding memoization or dependencies.

- Serve appropriately sized responsive images, reserve their dimensions, and defer offscreen media. Do not lazy-load the image responsible for initial visible content. Reuse the current font strategy and load only the families/weights needed.
- Split heavy optional code at an actual route or interaction boundary. Avoid introducing a waterfall for essential content. Remove unused client dependencies before adding another optimization package.
- For expensive interactions, profile render and computation costs with realistic data. Reduce repeated work; use existing pagination or virtualization only when volume warrants it. Preserve keyboard access, focus, and usable pending/error states.

## Evidence before completion

Repeat the affected measurement after the change, retaining the build/route, conditions, before/after values, and artifact paths. Exercise the original user action and failure recovery as well as timing it. Report remaining field or device coverage as unverified. A faster empty fixture does not demonstrate a faster populated page.

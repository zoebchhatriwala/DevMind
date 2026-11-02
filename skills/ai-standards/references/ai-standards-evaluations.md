# LLM applications: evaluations

## Reproducible DevMind comparison

Use the bundled tools from the installed skill's `scripts/` or this repository's root `scripts/`.

1. List cases with `node <scripts>/eval.mjs --list`. Five browser cases cover frontend behavior; three Node cases cover pagination, tenant authorization, and transactional failure recovery.
2. Prepare two empty isolated workspaces from the same case using `--case <id> --prepare <directory>`. Give the same task and seed to the same fixed model/version/settings, once without DevMind and once with it. Record the skill revision. Do not give the baseline the skill's instructions or a corrected solution.
3. Let the model perform the task. Record actual provider/runner metrics when available. Do not invent missing token, cost, or latency values.
4. Evaluate each candidate with `node <scripts>/eval.mjs <candidate> --case <id> --model-run <run.json>`. Browser cases also require `--url <loopback-url>` and existing Playwright/browser tooling. Node cases execute bundled contracts against `operation.mjs`; use isolated environments and review the code before executing it.
5. Add `--baseline <baseline-report.json>` to the candidate evaluation. The tool rejects different tasks, seeds, execution environments, or declared model/settings. Runner-supplied provenance is not independent proof that those controls were followed. Artifact-only comparisons are labeled unverified.
6. Review the case's rubric independently. Report failures and unresolved review criteria, repeat trials, and separate functional success from visual quality, maintainability, model cost, and latency. The transaction fixture models rollback; it does not prove production database isolation.

Model-run records use this shape. Replace the example model and revision with actual identifiers; omit metrics unless observed:

```json
{
  "model": "provider/exact-model-version",
  "settings": { "temperature": 0 },
  "condition": "with-skill",
  "skillRevision": "tested-git-commit"
}
```

The baseline uses `"condition": "without-skill"`. Optional `metrics` fields are `durationMs`, `inputTokens`, `outputTokens`, and `costUsd`. No model API calls or packages are installed by the evaluator. Passing helper tests validates the harness, not a claim that the skill improves a model.

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 5 - Automated AI Evaluation (Evals) & Quality Gates

Do not ship changes to prompts, chunking algorithms, models, or retrieval without runnable eval checks.

### 5.1 The RAG Triad Metrics
1. **Context Precision / Relevance**:
   $$\text{Precision} = \frac{|\text{Relevant Chunks in Retrieved Set}|}{|\text{Total Retrieved Chunks}|}$$
2. **Faithfulness / Groundedness**:
   $$\text{Faithfulness} = \frac{|\text{Claims in Answer supported by Context}|}{|\text{Total Claims in Answer}|}$$
3. **Answer Relevance**:
   Measures semantic alignment between the question and the generated answer, penalizing incomplete or evasive replies.

### 5.2 DeepEval / Ragas Test Pipeline Pattern
Create an automated test in `tests/ai/rag.eval.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LLMTestCase, assertTest, FaithfulnessMetric, ContextualPrecisionMetric } from 'deepeval';
import goldenDataset from './fixtures/golden-dataset.json';

describe('Production AI Evaluation Suite', () => {
  for (const item of goldenDataset) {
    it(`evaluates test case: "${item.input.slice(0, 30)}..."`, async () => {
      const { output, context } = await runPipeline(item.input);

      const testCase = new LLMTestCase({
        input: item.input,
        actualOutput: output,
        expectedOutput: item.expectedOutput,
        retrievalContext: context,
      });

      const faithfulness = new FaithfulnessMetric({ threshold: 0.90 });
      const precision = new ContextualPrecisionMetric({ threshold: 0.85 });

      const evaluation = await assertTest(testCase, [faithfulness, precision]);
      expect(evaluation.success).toBe(true);
    });
  }
});
```

Gate CI/CD pull requests on eval scores: any prompt or chunking tweak that drops Faithfulness below 0.90 fails the build.

---

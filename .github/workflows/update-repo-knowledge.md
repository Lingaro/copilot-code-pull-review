---
description: Update repository knowledge after merged code changes
on:
  push:
    branches:
      - main
permissions:
  contents: read
  pull-requests: read
  copilot-requests: write
engine: copilot
max-turns: 15
timeout-minutes: 20
tools:
  edit:
  bash:
    - "git diff"
    - "git show"
    - "git status"
ambient-folders:
  - .github/agents
safe-outputs:
  create-pull-request:
    title-prefix: "[knowledge] "
    draft: true
    max: 1
    fallback-as-issue: false
---

# Update Repository Knowledge

## Goal

Keep `repo-knowledge/` aligned with the actual code on the `main` branch so `agent-pr-impact-reviewer` can identify cross-file impacts, broken workflows, and other regressions.

This workflow must work across repository types, programming languages, frameworks, and architectures.

## Instructions

1. Inspect the latest push and identify the changed files using the available Git diff and history.

2. Read `.github/agents/agent-knowledge-base-maker.agent.md` if it exists. Follow its knowledge-maintenance, accuracy, migration, and safety rules. If it is missing, follow the instructions in this workflow and report that limitation.

3. Before making any changes, inspect and read all relevant existing knowledge files, including files in `repo-knowledge/` and any older knowledge files elsewhere in the repository. Read-only inspection must not modify, overwrite, rename, move, or delete files.

4. Read `repo-knowledge/index.md` first if it exists. Use it to navigate the existing knowledge base, then inspect the other relevant files.

5. Determine which knowledge is affected by the latest push. Trace relevant dependencies and verify important findings against the current source code. Do not assume a particular architecture or technology stack.

6. Use these standard files under `repo-knowledge/`:
   - `index.md` — entry point, navigation, topic index, and documentation gaps.
   - `system-overview.md` — purpose, architecture, major components, and responsibilities.
   - `dependencies-and-flows.md` — dependencies, data flows, integrations, and applicable user or system journeys.
   - `contracts-and-risks.md` — applicable contracts, schemas, validation, configuration, compatibility constraints, and verified risks.

7. If the knowledge base does not exist, create the required structure only after completing the initial read-only inspection. Populate it using verified repository evidence. Omit inapplicable concepts rather than inventing information.

8. If older knowledge files exist, migrate them only when necessary. Preserve useful information, verify the migration, check relevant references, and remove obsolete knowledge files only after confirming that their useful contents have been migrated. If verification is incomplete, preserve the original files and report the unresolved issues.

9. Update only the knowledge sections affected by the latest push. Refresh `index.md` whenever file contents, navigation, topics, or documentation gaps change. Do not rewrite the entire knowledge base unnecessarily.

10. Keep entries concise. Include repository-relative file paths and relevant symbols where useful. Clearly distinguish verified facts from assumptions and unresolved questions.

11. Do not modify application code, tests, application configuration, infrastructure, workflows, or agent definitions. Only modify files inside `repo-knowledge/`.

12. Do not install dependencies, deploy applications, change branches, stage or commit changes, or expose secrets. Never merge a generated PR automatically.

13. If no knowledge changes are necessary, do not create a PR.

14. If knowledge files change, create at most one draft PR with the title `Update repository knowledge`. The configured title prefix will add `[knowledge]` automatically.

15. In the PR description, summarize:
    - The knowledge files created or updated.
    - Why the changes were necessary.
    - Important evidence and affected components.
    - Any migration performed.
    - Unresolved questions or verification limitations.

## Final Validation

Before creating the draft PR:

- Verify that changes are limited to `repo-knowledge/`.
- Review the diff for accidental information loss or unsupported claims.
- Check relevant links and file references where practical.
- Confirm that existing knowledge was preserved or safely migrated.
- Do not claim checks were performed if they were not.

Never merge the generated PR automatically.

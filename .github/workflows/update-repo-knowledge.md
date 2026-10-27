---
description: Update repository knowledge after merged code changes
on:
  push:
    branches:
      - main
    paths:
      - 'src/**'
      - 'app/**'
      - 'api/**'
      - 'services/**'
      - 'package.json'
      - 'pyproject.toml'
      - 'go.mod'
      - 'pom.xml'
permissions:
  contents: read
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

Keep `repo-knowledge/` aligned with the actual code on the
main branch so the AI PR reviewer can identify cross-file
impacts and broken user journeys.

## Instructions

1. Inspect the changes introduced by the latest push and
   identify affected source files and dependencies.

2. Read `.github/agents/agent-knowledge-base-maker.agent.md`
   if it exists. Follow its knowledge-maintenance rules.

3. Read `repo-knowledge/knowledge-index.md` first if it exists.

4. Update only relevant knowledge files under `repo-knowledge/`.
   If the knowledge base does not exist, create an initial
   index and the essential architecture and dependency notes.

5. Verify architecture and dependencies against the current
   source code. Update critical user journeys or API contracts
   only when evidence supports the change.

6. Keep entries concise. Include repository-relative file paths
   and relevant symbols. Clearly identify uncertainty.

7. Do not modify application code, tests, configuration,
   infrastructure, workflows, or agent definitions.
   Do not install dependencies, run deployments, or expose secrets.

8. If no knowledge changes are necessary, do not create a PR.

9. If knowledge files changed, create one draft PR titled
   "[knowledge] Update repository knowledge".

10. In the PR description, summarize the changed knowledge files,
    why they changed, and any unresolved questions.

Never merge the generated PR automatically.

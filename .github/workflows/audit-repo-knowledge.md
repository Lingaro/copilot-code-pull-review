---
description: Weekly audit of repo-knowledge against the current code on main
on:
  schedule: weekly
  workflow_dispatch:
permissions:
  contents: read
  pull-requests: read
  copilot-requests: write
engine: copilot
max-turns: 30
timeout-minutes: 30
tools:
  edit:
  bash:
    - "git log"
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

# Audit Repository Knowledge

## Goal

Catch knowledge drift that the push-triggered update may have missed. Verify every file in `repo-knowledge/` against the current source on `main`, so `agent-pr-impact-reviewer` works from accurate context.

This workflow must work across repository types, programming languages, frameworks, and architectures.

## Instructions

1. Read `.github/agents/agent-knowledge-base-maker.agent.md` if it exists. Follow its accuracy, safety, and "Last verified" stamp rules. If it is missing, follow the instructions in this workflow and report that limitation.

2. Read `repo-knowledge/index.md` first, then every other file in `repo-knowledge/`.

3. For each knowledge file, check its claims against the current source code. Use the "Last verified" commit SHA to focus on code that changed since then, with `git log` and `git diff`.

4. Fix only claims that are stale, incorrect, or missing for applicable concepts. Preserve accurate content. Do not rewrite files unnecessarily.

5. Update the "Last verified" stamp of every file you checked, with today's date and the current `main` commit SHA. Refresh `index.md` if navigation or documentation gaps change.

6. Do not modify application code, tests, configuration, workflows, or agent definitions. Only modify files inside `repo-knowledge/`.

7. If any file changed, create at most one draft PR titled `Update repository knowledge`, and summarize each correction and the evidence for it in the PR description.

8. If nothing needed correction, do not create a PR. Call the `noop` safe output with a one-line reason and stop.

9. Never merge the generated PR automatically.

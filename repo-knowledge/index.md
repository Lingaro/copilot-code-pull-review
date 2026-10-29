# Repository Knowledge

This repository configures an Auth0 tenant with Terraform and deploys Auth0 Actions implemented in JavaScript. Start here, then read only the knowledge file relevant to the changed code.

## Files

- [system-overview.md](system-overview.md) - purpose, Terraform ownership boundaries, major configuration areas, and test inventory.
- [dependencies-and-flows.md](dependencies-and-flows.md) - action deployment wiring, trigger order, integrations, and data paths.
- [contracts-and-risks.md](contracts-and-risks.md) - runtime/configuration contracts, verified risks, and evidence gaps.

## Topics

- Terraform, Auth0 resources, and external core module: [System Overview](system-overview.md)
- Signup, login, and phone verification flows: [Dependencies and Flows](dependencies-and-flows.md)
- Variables, secrets, action contracts, and verified concerns: [Contracts and Risks](contracts-and-risks.md)

## Review Navigation

The PR review workflow in `.github/workflows/ai-pr-review.md` reads this index first when present and expects knowledge files to guide targeted investigation. Verify documented facts against current source before relying on them.

## Documentation Gaps

- `README.md` contains only the repository title and a short description; setup, deployment, and testing procedures are not documented there.
- No `package.json`, test-runner configuration, Terraform test files, or checked-in variable-value files were found in the repository tree inspected. The action specs exist, but their intended invocation is unverified.
- The implementation of the referenced private Terraform module is outside this repository; its internal behavior and contracts are not verified here.
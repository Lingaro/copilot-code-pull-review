# Repository Knowledge

Entry point for repository architecture and cross-file impact notes. Verify each dependency against current source before relying on it in a review.

## Topics

- [Architecture](./architecture.md) — Terraform-managed Auth0 tenant configuration and customizations.
- [Component dependencies](./component-dependencies.md) — trigger order and connections between Actions, templates, and infrastructure.
- [Critical user journeys](./critical-user-journeys.md) — signup, login, and phone verification flows.
- [API contracts](./api-contracts.md) — Action inputs/outputs, metadata, claims, and external service payloads.
- [Configuration and integrations](./configuration-and-integrations.md) — Terraform variables, secrets, providers, and service dependencies.
- [Known risks](./known-risks.md) — verified configuration gaps and evidence limits.

## Update guidance

This repository currently has no root package manifest or CI workflow in the tracked tree. Action tests are colocated as Jest-style `*.spec.js` files. Terraform is the deployment source for Auth0 Actions and tenant resources; source changes alone do not update a deployed Action.

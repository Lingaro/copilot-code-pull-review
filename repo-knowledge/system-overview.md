# System Overview

## Purpose and Ownership

This repository is an Auth0 tenant configuration project, not a standalone application service. Root Terraform files configure Auth0 through the `auth0/auth0` provider and a referenced private core module. JavaScript source under `scripts/actions/` is packaged into Auth0 Actions by resources in `main.tf`.

The module `app.terraform.io/example-org/core-dev/auth0` is pinned to `~> 1.0`. It receives tenant-wide configuration for email, log streams, token/session lifetimes, database connection settings, network controls, and a list of additional database clients. Its implementation is external and not documented here.

## Major Components

- `main.tf`: Terraform root configuration; declares the core module, Auth0 tenant resources, clients and grants, actions and trigger order, email/branding/prompt configuration. Action source and HTML templates are read from repository paths at deployment time.
- `variables.tf`: inputs for tenant identity, client metadata, third-party endpoints, action dependencies, feature switches, and tenant policy. Several credentials are marked `sensitive`.
- `scripts/actions/pre-registration/`: signup validation, blocked-domain filtering, application metadata assignment, and external registration.
- `scripts/actions/post-login/`: external user-ID dispatch, token claims, and conditional MFA.
- `scripts/actions/send-phone-message/`: phone-number checks and Twilio Verify SMS delivery.
- `templates/` and `custom-prompts/signup/`: Universal Login, email, and signup form HTML consumed by Terraform.
- `scripts/actions/**/__mocks__/`: test doubles for Auth0, Axios, UUID, and OpenTelemetry dependencies.

## Runtime and Infrastructure

- Terraform requires `>= 1.13.0`; the Auth0 provider is pinned to `1.38.0`.
- Action runtime is selected by `var.node_runtime_version`; dependency versions are supplied through Terraform variables.
- The root Terraform cloud block currently has empty organization and workspace names, and the referenced module source contains `example-org`. Whether these values are replaced for deployment is not documented.
- No application server, database implementation, or independent API service is defined in this repository. External systems are called by Auth0 Actions or configured through the private module.

## Tests

Five JavaScript spec files are present for `AddAppMetadata`, `CDPRegistration`, `ValidateRegistrationFields`, `SendOktaUserId`, and `AddCustomClaims`. The repository tree inspected has no test-runner manifest/configuration. No spec was found for `BlockedDomainFilter`, `MFAHandler`, `PhoneNumberVerify`, or `TwilioVerify`.
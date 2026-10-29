# Contracts and Risks

## Configuration Contracts

- Root module inputs are declared in `variables.tf`; secret-like inputs marked `sensitive = true` must be handled as secrets. Do not copy secret values into this knowledge base or review comments.
- Terraform requires version `>= 1.13.0` and Auth0 provider `1.38.0`. The action Node runtime and npm dependency versions are variable-driven.
- Action trigger IDs/versions and ordered action attachments are declared in `main.tf`. Source entrypoints are `onExecutePreUserRegistration`, `onExecutePostLogin`, and `onExecuteSendPhoneMessage` as appropriate to the Auth0 trigger.
- Action secret names are part of the source/deployment contract: source reads from `event.secrets`, while the corresponding `auth0_action` resources populate those names. When changing a secret reference, check both source and Terraform wiring.
- Signup client metadata must include `mp_type`, the matching `<mp_type>_mpid`, `sourceId`, and `region` for the actions that consume them. `AddAppMetadata` writes the user's `mpid`, `sourceId`, and generated `consumerId`; downstream registration and login actions use those app-metadata fields.
- Phone verification flags and JSON-encoded prefix/whitelist values are passed as action secrets. Keep their string parsing and variable formats aligned across `variables.tf`, `main.tf`, and `PhoneNumberVerify.js`.
- The private core module contract, deployment workspace values, and the source of runtime Terraform variable values are not available in this repository.

## Verified Risks and Gaps

- **Unresolved Terraform local:** nine action resources in `main.tf` iterate over `local.otel_dependencies`, but the inspected Terraform files contain no `locals` declaration or other definition. This is a verified configuration inconsistency and is expected to prevent successful validation/planning unless supplied by an untracked/generated source.
- **Registration logs include personal data:** `CDPRegistration.js` logs the `userFields` object for non-Lead Ads registrations, including email, first name, last name, gender, and birth date. Review logging changes and log retention/access with this data exposure in mind.
- **Deployment readiness is unclear:** `main.tf` has empty Terraform Cloud organization/workspace names and references a module source containing `example-org`. These may be environment-specific placeholders, but replacement is not evidenced in the repository.
- **Test coverage is partial:** specs exist for five actions; there are no corresponding specs for the blocked-domain filter, MFA handler, or either phone-verification action. No test runner configuration was found, so test commands and CI execution are unverified.
- **Operational documentation is sparse:** `README.md` does not describe setup, deployment, or testing. The private core module implementation and deployment variable provisioning are not inspectable here.

Git history was not inspected; this knowledge base makes no historical-defect claims.
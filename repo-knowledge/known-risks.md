# Known Risks and Verification Gaps

## Verified configuration gap

- **Terraform OpenTelemetry dependency local is unresolved in the tracked root configuration.** [`main.tf`](../main.tf) iterates over `local.otel_dependencies` in the Action resources, but the tracked Terraform files contain no `locals` block or assignment defining `otel_dependencies`. This is a likely Terraform validation/plan blocker unless the configuration is generated or composed with files not present in this checkout. Confirm against the deployment workspace before making a change.

## Cross-file compatibility risks

- Action order is a functional dependency: pre-registration metadata creation precedes CGW registration; phone validation precedes Twilio message delivery. Changes should be evaluated at the full trigger-flow level.
- Signup form field names and values are consumed by Actions as request body keys. Renaming a field in a prompt partial without updating validation and CDP mapping breaks the signup contract.
- `BlockedDomainFilter` uses the case-sensitive email domain substring directly against a set, while the domain list is injected during deployment. Changes to casing/normalization or replacement format need to preserve the intended block behavior.
- `PhoneNumberVerify` and `TwilioVerify` share a cache key based on the recipient's combined prefix/number and rely on the same Auth0 Action cache. Changes to number normalization or cache payload shape affect the second Action's destination number.

## Repository verification limits

- The root README contains only a short project label, and no root package manifest, Terraform lock file, or CI workflow was found in the tracked tree. This checkout alone does not establish a reproducible test or deployment process.
- Action specs exist only for selected actions; phone verification and MFA have no colocated spec files in the current tree.
- No Terraform validation or Action test command was run for this documentation update.

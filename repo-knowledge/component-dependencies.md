# Component Dependencies

## Auth0 trigger chains

The `auth0_trigger_actions` resources in [`main.tf`](../main.tf) define the ordering:

1. **Pre-user-registration:** `BlockedDomainFilter` → `Validate Data` → `Add App Metadata` → `CDP Registration`.
2. **Post-login:** `SendOktaUserId` → `Add Custom Claims` → `MFA-Handler`.
3. **Send-phone-message:** `Phone-Number-Verify` → `Twilio-Verify`.

Changing an Action's metadata contract or outcome can affect later Actions in the same trigger. The registration flow relies on metadata being populated before CDP registration; post-login claims rely on signup or other provisioning having populated app metadata.

## Important cross-component links

- Terraform deploys [`BlockedDomainFilter.js`](../scripts/actions/pre-registration/BlockedDomainFilter.js) with a generated blocked-domain set from [`blocked_domains.json`](../scripts/actions/pre-registration/blocked_domains.json).
- [`AddAppMetadata.js`](../scripts/actions/pre-registration/AddAppMetadata.js) reads `event.client.metadata` (`mp_type`, `<mp_type>_mpid`, and `<mp_type>_sourceId`) and writes `mpid`, `sourceId`, and a generated `consumerId` to app metadata. Terraform client metadata in `main.tf` supplies these values.
- [`CDPRegistration.js`](../scripts/actions/pre-registration/CDPRegistration.js) reads app metadata from the preceding flow and sends registration information to CGW.
- [`AddCustomClaims.js`](../scripts/actions/post-login/AddCustomClaims.js) maps app metadata and client region to access-token claims and adds login count/enrollment to the ID token.
- [`SendOktaUserId.js`](../scripts/actions/post-login/SendOktaUserId.js) dispatches the Auth0 user ID to CGW only when `app_metadata.flow.tasks.needs_okta_id_dispatch` is truthy and `oktauseridInCDP` is not already set. Success writes `oktauseridInCDP=true`.
- [`PhoneNumberVerify.js`](../scripts/actions/send-phone-message/PhoneNumberVerify.js) performs configured prefix/fraud checks and optionally calls the CIAM connector for uniqueness. It stores lookup results in Auth0 Action cache for ten minutes. [`TwilioVerify.js`](../scripts/actions/send-phone-message/TwilioVerify.js) extracts the OTP and sends it through Twilio Verify, reusing cached normalized phone data if present.
- Signup fields in [`form-content-start.html`](../custom-prompts/signup/form-content-start.html) use the `ulp-*` names consumed by validation and CDP registration. Consent from [`form-content-end.html`](../custom-prompts/signup/form-content-end.html) is read by CDP registration.
- [`main.tf`](../main.tf) wires custom prompt partials and the Universal Login template; changes to markup may affect Auth0 form submission and the corresponding Action request-body fields.

## Shared technical concerns

Each Action independently initializes OpenTelemetry and flushes spans with a bounded wait. External calls and their error policy are action-specific: CDP registration denies registration on failure, Okta ID dispatch preserves login on failure, phone validation errors are rethrown, and Twilio send errors become user-facing errors.

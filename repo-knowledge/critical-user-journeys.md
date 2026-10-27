# Critical User Journeys

## Signup / registration

1. The Universal Login signup form and partials collect email, first name, last name, gender, birth date, and consent (`custom-prompts/signup/`).
2. `BlockedDomainFilter` checks email against the deployed blocked-domain list.
3. `Validate Data` validates email, conditionally validates required fields and age using Action secrets, and exempts configured M2M clients from its checks.
4. `Add App Metadata` derives `mpid` and `sourceId` from client metadata and writes a generated `okta_<uuid>` consumer ID.
5. `CDP Registration` builds registration traits/options and posts to CGW. It denies signup if the CGW call or enclosing processing fails.

**Impact:** Changes to form field names, client metadata, Action ordering, validation flags, or CGW schema can prevent signup or produce incomplete CDP profiles. See [API contracts](./api-contracts.md).

## Login / token issuance

1. `SendOktaUserId` may PUT the Auth0 ID to CGW when orchestrator task metadata requests it; API failures are logged/traced but do not block login.
2. `Add Custom Claims` sets access-token claims `mpid`, `sourceId`, `consumerId`, and `region`; it optionally sets `akamaiId`, and adds `login_count` and `enrolled` to the ID token.
3. `MFA-Handler` enables MFA only for its configured client when the transaction's `acr_values` contains the configured MFA URL and enrollment/`useMFA` conditions require it.

**Impact:** Missing app/client metadata can yield missing claims or runtime errors. Changes to client IDs, flow-task metadata, `acr_values`, or enrollment rules change dispatch/MFA behavior.

## Phone enrollment / verification message

1. `Phone-Number-Verify` parses the recipient as a prefix and phone-number pair, applies prefix policy and optional Twilio Lookup checks for VoIP and SMS-pumping risk, and can call the CIAM connector to reject duplicate phone numbers.
2. Lookup results are cached by full number for ten minutes. A configured whitelist bypasses uniqueness lookup; Guardian-enrolled users skip uniqueness checking.
3. `Twilio-Verify` extracts the leading six-digit OTP from the message text and sends it through the configured Twilio Verify service. It uses cached normalized phone data when available.

**Impact:** Recipient formatting, Action ordering/cache behavior, secrets, validation configuration, or Twilio/CIAM response changes may block phone verification or permit a check to be skipped. Phone values are intentionally obfuscated in some logs/spans; verify privacy if changing telemetry.

## Recovery and presentation

Password reset and welcome email bodies are provided to the Terraform core module from `templates/`. Signup prompt content and styles live in `custom-prompts/signup/` and `templates/index.html`; a markup change can affect Auth0 prompt rendering and signup field submission.

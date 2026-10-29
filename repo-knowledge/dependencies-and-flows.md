# Dependencies and Flows

## Terraform Deployment Path

`main.tf` reads JavaScript action source and supplies it to `auth0_action` resources. It supplies package names/versions and action secrets through the same resources, then assigns action IDs to Auth0 triggers with `auth0_trigger_actions`. `BlockedDomainFilter` additionally receives `blocked_domains.json` by replacing its source placeholder at Terraform evaluation time.

The root `core` module receives tenant-wide settings and the IDs of ten tenant-specific database clients. Direct resources in `main.tf` define additional clients, grants, the custom domain, Guardian, actions, email template, branding, and localized prompt text. See [System Overview](system-overview.md) for ownership boundaries.

## Auth0 Trigger Flows

### Pre-user-registration

The configured order is:

1. `BlockedDomainFilter`: checks the email domain against the injected blocked-domain set and denies invalid addresses.
2. `ValidateRegistrationFields`: validates email and, when enabled, required signup fields; configured M2M clients skip this validation.
3. `AddAppMetadata`: reads client metadata (`mp_type`, the corresponding `<mp_type>_mpid`, and `<mp_type>_sourceId`), creates an `okta_`-prefixed UUID consumer ID, and writes `mpid`, `sourceId`, and `consumerId` to user app metadata.
4. `CDPRegistration`: posts registration information to the configured CGW endpoint. Lead Ads registrations take a distinct path; other registrations include signup fields and opt-in details. A failed request denies registration.

These actions share OpenTelemetry exporter configuration. `ValidateRegistrationFields` also receives Zod and feature-flag/M2M-client secrets; `CDPRegistration` receives the CGW endpoint, API key, country code, and Lead Ads client ID.

### Post-login

The configured order is:

1. `SendOktaUserId`: conditionally sends the Auth0 user ID to CGW when orchestrator metadata requests dispatch and the app-metadata completion flag is not set. A successful response sets `oktauseridInCDP`; request failures are logged and do not block login.
2. `AddCustomClaims`: adds `mpid`, `sourceId`, `consumerId`, and client `region` to the access token; optionally adds `akamaiId`. It also adds login count and MFA enrollment state to the ID token.
3. `MFAHandler`: for the configured client, enables MFA only when the transaction's `acr_values` contains the configured MFA URL and the request/enrollment conditions require it. New users use Guardian; other users use any available factor.

### Send-phone-message

The configured order is `Phone-Number-Verify`, then `Twilio-Verify`. The first action parses runtime flags, may validate prefixes and query Twilio Lookup for VoIP/SMS-pumping risk, caches lookup results for ten minutes, and may check phone uniqueness through the CIAM connector. A detected duplicate or validation/API error throws and stops the flow. A configured whitelist skips uniqueness checks. Guardian-enrolled users skip uniqueness checking but still use cached or fresh phone lookup validation. The second action extracts the OTP from the message and sends it through Twilio Verify.

## External Integrations and Data

- Auth0 is managed by Terraform's Auth0 provider and the private `core` module.
- CGW receives registration events and, on eligible logins, Auth0 user IDs. Request routing and authentication are passed as action secrets.
- The CIAM connector receives phone-number uniqueness checks when enabled.
- Twilio Lookup and Verify provide phone risk/line-type checks and SMS verification.
- OpenTelemetry traces are exported to the configured OTLP endpoint by the actions.
- AWS SES, Azure log streams, and RTDF settings are passed to the private module; their internal usage is not visible in this repository.
- Akamai-related fields are passed as database connection configuration to the private module; runtime behavior is unverified here.

Signup form fields consumed by validation/registration include `ulp-first-name`, `ulp-last-name`, `ulp-gender`, `ulp-birth-date`, and `ulp-terms-of-service-1`. The exact outbound registration payload is assembled in `CDPRegistration.js`.
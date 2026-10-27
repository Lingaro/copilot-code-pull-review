# API Contracts

## Auth0 Action contracts

All handlers are CommonJS exports using Auth0 event/API objects:

| Trigger | Handler | Key inputs | Behavior/output |
|---|---|---|---|
| `pre-user-registration` | `BlockedDomainFilter` | `event.user.email`, tenant/user context, `OTLP_EXPORTER_url`; deployed blocked-domain set | Calls `api.access.deny(...)` for invalid/blocked email. |
| `pre-user-registration` | `ValidateRegistrationFields` | `event.user.email`, `event.request.body`, client ID, `AGE_CHECK`, `REQUIRED_FIELDS_CHECK`, M2M IDs | Denies unsafe/invalid email, invalid required fields, invalid birth date, or age under 18; skips validation for configured M2M IDs. Uses Zod v4. |
| `pre-user-registration` | `AddAppMetadata` | `event.client.metadata.mp_type`, `<mp_type>_mpid`, `<mp_type>_sourceId` | Calls `api.user.setAppMetadata` for `mpid`, `sourceId`, and `consumerId=okta_<uuid>`. |
| `pre-user-registration` | `CDPRegistration` | user email/app metadata, `ulp-*` signup body, client region; CGW URL, API key, country code, Lead Ads client ID | POSTs a `RegistrationComplete` payload containing `ids`, `opts`, `traits`, and `dependents`; denies registration if the call/processing fails. Lead Ads path filters app metadata and omits the standard signup options/traits. |
| `post-login` | `SendOktaUserId` | user ID and app metadata task flag; client region; CGW endpoint/API key | Conditional PUT to CGW with consumer/source/MPN/region/user ID headers; on success sets `oktauseridInCDP=true`. Failure is graceful and does not block login. |
| `post-login` | `AddCustomClaims` | user app metadata, client region, login count, MFA enrollment | Sets access-token claims `mpid`, `sourceId`, `consumerId`, `region`, optional `akamaiId`; ID-token claims `login_count` and boolean `enrolled`. |
| `post-login` | `MFAHandler` | configured client ID and MFA URL; transaction `acr_values`; request `useMFA`; user enrollment/app metadata | Calls `api.multifactor.enable("guardian")` for a new user or `"any"` for an eligible returning user. |
| `send-phone-message` | `PhoneNumberVerify` | recipient formatted as `prefix + space + number`; fraud/uniqueness secrets; user metadata and Action cache | Applies prefix and optional Twilio Lookup policy; optionally POSTs CIAM uniqueness query. Throws for disallowed/duplicate numbers or dependency failures. |
| `send-phone-message` | `TwilioVerify` | same recipient format, message text beginning with a six-digit OTP, cache; Twilio Verify secrets | Sends SMS verification via Twilio; throws a sanitized user-facing error on failure. |

## Signup form fields

The signup partial names are part of the Action request-body contract:

- `ulp-first-name`, `ulp-last-name`, `ulp-gender`, `ulp-birth-date`
- `ulp-terms-of-service-1`

Gender values in the form are `F`, `M`, and `O`. CDP registration maps these fields to `firstName`, `lastName`, `gender`, and `birthDate` traits, and uses the consent checkbox to set both configured opt statuses.

## External service contracts

- **CGW registration:** HTTP POST with `X-Api-Key`, `consumerid`, `sourceId`, `mpn`, and `region` headers; JSON body uses event name `RegistrationComplete`, `transmitterSourceId`, IDs, options, traits, and dependents.
- **CGW Okta ID dispatch:** HTTP PUT with the same identity/region headers plus `oktauserid`; empty object body.
- **CIAM uniqueness connector:** HTTP POST with access token header and JSON containing MPN, source ID, country code, consumer ID, phone prefix/number, domain, user ID, and region. Expects HTTP 200 and `response.data.isExists`.
- **Twilio Lookup:** Requests configured fields `line_type_intelligence` and/or `sms_pumping_risk`; expects line type and numeric pumping risk data.
- **Twilio Verify:** Calls the configured service's `verifications.create({to, channel: "sms", customCode})`.

Source of truth for actual request construction is the corresponding Action implementation; Terraform maps runtime variables to Action secrets in [`main.tf`](../main.tf) and declares most inputs in [`variables.tf`](../variables.tf).

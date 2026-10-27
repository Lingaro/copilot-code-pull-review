# Configuration and Integrations

## Terraform deployment

- [`main.tf`](../main.tf) uses Terraform Cloud, Auth0 provider `1.38.0`, and a required Terraform version of at least `1.13.0`.
- The `core` module receives tenant settings, email templates, log-stream configuration, session/token settings, access controls, and tenant-specific DB client IDs.
- Auth0 Action resources set their runtime from `var.node_runtime_version`, deploy JavaScript source, declare npm dependencies, and map Terraform variables/client IDs to Action secrets.
- [`variables.tf`](../variables.tf) declares required tenant, integration, and policy inputs. Sensitive values are marked for API keys, access tokens, and account credentials.

## External integrations

- **Auth0:** Custom domain, database clients/grants, Guardian phone provider, Actions and trigger pipelines, Universal Login branding/theme, and custom prompt text/partials.
- **CGW:** Registration endpoint and Okta user-ID endpoint. Both use a configured API key.
- **CIAM connector:** Phone uniqueness endpoint and access token.
- **Twilio:** Lookup and Verify SDK integrations. Lookup behavior is controlled by prefix, VoIP, SMS-pumping, threshold, and uniqueness settings; Verify uses account and service credentials.
- **OpenTelemetry:** All Action resources receive the configured OTLP exporter URL and tracing dependencies through `local.otel_dependencies` references.
- **Email and logging:** The core module receives SES settings, welcome/reset email templates, and Azure/RTDF logging configuration.

## Behavioral configuration

- Signup validation is controlled by `AGE_CHECK` and `REQUIRED_FIELDS_CHECK`; client IDs control the M2M bypass.
- Blocked domains are read from `scripts/actions/pre-registration/blocked_domains.json` and embedded into deployed Action code by Terraform `replace(...)`.
- Phone policy is controlled by Action secrets such as `ALLOW_ALL_PREFIXES`, `ALLOWED_PREFIXES`, `BLOCK_VOIP_NUMBERS`, `BLOCK_SMS_PUMPING_ATTACKS`, `SMS_PUMPING_RISK_THRESHOLD`, `PHONE_UNIQUENESS_CHECK_ENABLED`, and `PHONE_UNIQUENESS_WHITELIST`.
- MFA is scoped to the configured client and MFA URL in the post-login Action resource.

## Secret handling

Terraform variables marked `sensitive` include CGW/CIAM credentials, Twilio account credentials, and Akamai credentials. Action handlers should continue masking credentials and sensitive identifiers when logging; the phone actions obfuscate phone numbers in selected logs and spans.

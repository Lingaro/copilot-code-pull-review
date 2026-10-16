terraform {
  required_version = ">= 1.13.0"
  cloud {
    organization = ""
    workspaces {
      project = "dev"
      name    = ""
    }
  }
  required_providers {
    auth0 = {
      source  = "auth0/auth0"
      version = "1.38.0" // Refer to docs for latest version
    }
  }
}

module "core" {
  source  = "app.terraform.io/example-org/core-dev/auth0"
  version = "~> 1.0"

  # Tenant identity
  domain        = var.domain
  client_region = var.client_region

  # Email (SES)
  aws_ses_custom_email_address         = var.aws_ses_custom_email_address
  aws_ses_custom_email_provider_id     = var.aws_ses_custom_email_provider_id
  aws_ses_custom_email_provider_secret = var.aws_ses_custom_email_provider_secret
  aws_ses_custom_email_provider_region = var.aws_ses_custom_email_provider_region

  # Email templates
  reset_email_body                    = file("${path.module}/templates/passwordReset.html")
  reset_email_subject                 = var.reset_email_subject
  reset_email_active                  = var.reset_email_active
  reset_email_result_url              = var.reset_email_result_url
  reset_email_url_lifetime_in_seconds = var.password_reset_email_url_lifetime_in_seconds
  welcome_email_body                  = file("${path.module}/templates/welcomeEmail.html")
  welcome_email_subject               = var.welcome_email_subject
  welcome_email_active                = var.welcome_email_active

  # Log streams
  azure_region               = var.azure_log_stream_region
  azure_resource_group       = var.azure_log_stream_resource_group
  azure_subscription_id      = var.azure_log_stream_subscription_id
  rtdf_http_endpoint         = var.rtdf_http_endpoint
  rtdf_authorization_api_key = var.rtdf_authorization_api_key

  # Token lifetimes
  jwt_token_lifetime    = var.jwt_token_lifetime
  access_token_lifetime = var.access_token_lifetime

  # Preserve tenant config values
  enabled_locales                        = var.enabled_locales
  session_lifetime                       = var.session_lifetime
  idle_session_lifetime                  = var.session_lifetime
  oidc_logout_prompt_enabled             = var.oidc_logout_prompt_enabled
  enable_custom_domain_in_emails         = var.enable_custom_domain_in_emails
  enable_public_signup_user_exists_error = var.enable_public_signup_user_exists_error

  password_policy           = var.password_policy
  disable_signup            = var.disable_signup
  attack_protection_profile = var.attack_protection_profile

  db_connection_configuration = {
    domain       = var.akamai_domain
    type         = var.akamai_marketing_program_type
    api_key      = var.akamai_api_key
    flow         = var.akamai_flow
    locale       = var.akamai_locale
    client_id    = var.akamai_client_id
    flow_version = var.akamai_flow_version
    redirect_uri = var.akamai_redirect_uri
  }

  # Network ACLs
  ip_blocking_active      = var.ip_blocking_active
  blocked_ipv4            = var.blocked_ipv4
  blocked_ipv6            = var.blocked_ipv6
  country_blocking_active = var.country_blocking_active
  blocked_countries       = var.blocked_countries

  # Suspicious-IP allowlist
  suspicious_ip_allowlist = var.suspicious_ip_allowlist

  # Tenant-specific DB-enabled clients (excluding 5 core M2M clients)
  additional_db_clients = [
    auth0_client.client_lead_ads.id,
    auth0_client.client_segmanta.id,
    auth0_client.client_spa_joltx_enviedeplus_com.id,
    auth0_client.client_survey_builder.id,
    auth0_client.client_reg_haircare_boutique_enviedeplus_com.id,
    auth0_client.client_m2m_digital_incentives.id,
    auth0_client.client_m2m_di.id,
    auth0_client.client_retention_service.id,
    auth0_client.client_native_android.id,
    auth0_client.client_native_ios.id,
  ]
}

# ************** 1. TENANT & CUSTOM DOMAIN & AUTHENTICATION PROFILE **************
resource "auth0_custom_domain" "custom_domain_1_dev" {
  domain = "login.example.com"
  type   = "auth0_managed_certs"
}

resource "auth0_guardian" "my_guardian" {
  policy = "never"

  phone {
    enabled       = true
    provider      = "phone-message-hook"
    message_types = ["sms"]

    options {
      enrollment_message   = "{{code}} is your verification code for {{tenant.friendly_name}}. Please enter this code to verify your enrollment."
      verification_message = "{{code}} is your verification code for {{tenant.friendly_name}}."
    }
  }
}

# ********* 3.0 WEB / NATIVE APPS **********
resource "auth0_client" "client_spa_joltx_enviedeplus_com" {
  name               = "Sample Web Application"
  description        = "Sample application"
  app_type           = "spa"
  cross_origin_auth  = false
  oidc_conformant    = true
  initiate_login_uri = ""

  callbacks           = []
  allowed_logout_urls = []
  web_origins         = []

  mobile {
    android {
      app_package_name = "com.example.app"
    }
  }

  grant_types = [
    "authorization_code",
    "password",
    "refresh_token",
  ]

  jwt_configuration {
    alg                 = "RS256"
    lifetime_in_seconds = var.jwt_token_lifetime
  }

  client_metadata = {
    mp_type                = "SAMPLE_REGION"
    SAMPLE_REGION_mpid     = "0"
    SAMPLE_REGION_sourceId = "0"
    region                 = "${var.client_region}"
  }

  # Session duration settings are documented in the project runbook.
  refresh_token {
    token_lifetime      = var.jwt_token_lifetime + 1 // 30 days
    idle_token_lifetime = var.jwt_token_lifetime     // 30 days
    rotation_type       = "rotating"
    leeway              = 5
    expiration_type     = "expiring"
  }
  session_transfer {
    can_create_session_transfer_token = true
    allow_refresh_token               = true
    enforce_device_binding            = "none"
    enforce_cascade_revocation        = false
    enforce_online_refresh_tokens     = false
  }
}

resource "auth0_client" "client_reg_haircare_boutique_enviedeplus_com" {
  name              = "Sample Registration Application"
  description       = "Simple touchpoint"
  app_type          = "regular_web"
  cross_origin_auth = false

  initiate_login_uri = ""

  callbacks           = []
  allowed_logout_urls = []

  grant_types = [
    "authorization_code",
    "password",
  ]

  jwt_configuration {
    alg                 = "RS256"
    lifetime_in_seconds = var.jwt_token_lifetime
  }

  client_metadata = {
    mp_type                = "SAMPLE_REGION"
    SAMPLE_REGION_mpid     = "0"
    SAMPLE_REGION_sourceId = "0"
    region                 = "${var.client_region}"
  }
}

resource "auth0_client" "client_segmanta" {
  name              = "Sample Survey Application"
  description       = "touchpoint number 2"
  app_type          = "spa"
  cross_origin_auth = false

  initiate_login_uri = ""

  callbacks           = []
  allowed_logout_urls = []
  web_origins         = []

  grant_types = [
    "authorization_code",
    "password",
  ]

  jwt_configuration {
    alg                 = "RS256"
    lifetime_in_seconds = var.jwt_token_lifetime
  }

  client_metadata = {
    mp_type                = "SAMPLE_REGION"
    SAMPLE_REGION_mpid     = "0"
    SAMPLE_REGION_sourceId = "0"
    region                 = "${var.client_region}"
  }
}

resource "auth0_client" "client_survey_builder" {
  name              = "Sample Survey Builder"
  description       = "touchpoint number 4"
  app_type          = "spa"
  cross_origin_auth = false

  initiate_login_uri = ""

  callbacks           = []
  allowed_logout_urls = []
  web_origins         = []

  grant_types = [
    "authorization_code",
    "password"
  ]

  jwt_configuration {
    alg                 = "RS256"
    lifetime_in_seconds = var.jwt_token_lifetime
  }

  client_metadata = {
    mp_type                = "SAMPLE_REGION"
    SAMPLE_REGION_mpid     = "0"
    SAMPLE_REGION_sourceId = "0"
    region                 = "${var.client_region}"
  }
  session_transfer {
    can_create_session_transfer_token = true
    allow_refresh_token               = true
    enforce_device_binding            = "none"
    enforce_cascade_revocation        = false
    enforce_online_refresh_tokens     = false
  }
}

resource "auth0_client" "client_native_ios" {
  name               = "Sample Native iOS Application"
  description        = "touchpoint number 5"
  app_type           = "native"
  cross_origin_auth  = false
  sso_disabled       = true
  oidc_conformant    = false
  initiate_login_uri = ""

  callbacks           = []
  allowed_logout_urls = []
  web_origins         = []

  grant_types = [
    "authorization_code",
    "password",
  ]

  jwt_configuration {
    alg                 = "RS256"
    lifetime_in_seconds = var.jwt_token_lifetime
  }

  client_metadata = {
    mp_type                = "SAMPLE_REGION"
    SAMPLE_REGION_mpid     = "0"
    SAMPLE_REGION_sourceId = "0"
    region                 = "${var.client_region}"
  }
}

resource "auth0_client" "client_native_android" {
  name               = "Sample Native Android Application"
  description        = "touchpoint number 6"
  app_type           = "native"
  cross_origin_auth  = false
  sso_disabled       = true
  oidc_conformant    = false
  initiate_login_uri = ""

  callbacks           = []
  allowed_logout_urls = []
  web_origins         = []

  grant_types = [
    "authorization_code",
    "password",
  ]

  jwt_configuration {
    alg                 = "RS256"
    lifetime_in_seconds = var.jwt_token_lifetime
  }

  client_metadata = {
    mp_type                = "SAMPLE_REGION"
    SAMPLE_REGION_mpid     = "0"
    SAMPLE_REGION_sourceId = "0"
    region                 = "${var.client_region}"
  }
}

# *************** 3.1 CLIENT CREDENTIALS **************
resource "auth0_client_credentials" "client_credentials_survey_builder" {
  client_id             = auth0_client.client_survey_builder.id
  authentication_method = "none"
}

resource "auth0_client_credentials" "client_credentials_spa_joltx" {
  client_id             = auth0_client.client_spa_joltx_enviedeplus_com.id
  authentication_method = "none"
}

resource "auth0_client_credentials" "client_reg_haircare_boutique_enviedeplus_com" {
  client_id             = auth0_client.client_reg_haircare_boutique_enviedeplus_com.id
  authentication_method = "none"
}

resource "auth0_client_credentials" "client_credentials_segmanta" {
  client_id             = auth0_client.client_segmanta.id
  authentication_method = "none"
}

resource "auth0_client_credentials" "client_native_ios_credentials" {
  client_id             = auth0_client.client_native_ios.id
  authentication_method = "none"
}

resource "auth0_client_credentials" "client_native_android_credentials" {
  client_id             = auth0_client.client_native_android.id
  authentication_method = "none"
}

# *************** 3.2 M2M CLIENTS **************

resource "auth0_client" "client_lead_ads" {
  name              = "Sample Lead Ads Client"
  description       = "Sample application"
  app_type          = "non_interactive"
  cross_origin_auth = false

  jwt_configuration {
    alg                 = "RS256"
    lifetime_in_seconds = var.jwt_token_lifetime
  }

  client_metadata = {
    mp_type                = "SAMPLE_REGION"
    SAMPLE_REGION_mpid     = "0"
    SAMPLE_REGION_sourceId = "0"
    region                 = "${var.client_region}"
  }
}
# ! IMPORTANT: Do not move to prod!
resource "auth0_client" "client_m2m_digital_incentives" {
  name              = "DI Testing"
  description       = "DI Testing\nPassword grant enabled\nDo not move to production."
  app_type          = "non_interactive"
  cross_origin_auth = false
  grant_types       = ["client_credentials", "password"]

  jwt_configuration {
    lifetime_in_seconds = var.jwt_token_lifetime
    alg                 = "RS256"
  }

  client_metadata = {
    region = "${var.client_region}"
  }
}

resource "auth0_client" "client_m2m_di" {
  name              = "Sample Machine Client"
  app_type          = "non_interactive"
  cross_origin_auth = false
  grant_types       = ["client_credentials", "password"]

  jwt_configuration {
    alg                 = "RS256"
    lifetime_in_seconds = var.id_token_lifetime # 30 days
  }
}
resource "auth0_client" "client_retention_service" {
  name              = "Sample Retention Client"
  description       = "CIAM Modern Services"
  app_type          = "non_interactive"
  cross_origin_auth = false
  grant_types       = ["client_credentials"]

  jwt_configuration {
    lifetime_in_seconds = var.jwt_token_lifetime
    alg                 = "RS256"
  }
}

# *************** 3.3 M2M CLIENTS GRANTS **************

resource "auth0_client_grant" "client_grant_lead_ads" {
  client_id = auth0_client.client_lead_ads.id
  audience  = "https://${var.domain}/api/v2/"
  scopes = [
    "create:users",
    "create:users_app_metadata",
    "update:users",
    "update:users_app_metadata",
    "read:users",
    "read:users_app_metadata"
  ]
}
# ! IMPORTANT: Do not move to prod!
resource "auth0_client_grant" "client_m2m_digital_incentives" {
  client_id = auth0_client.client_m2m_digital_incentives.id
  audience  = "https://${var.domain}/api/v2/"
  scopes = [
    "delete:users",
    "create:users",
    "read:users",
    "update:users",
    "create:client_credentials",
  ]
}

resource "auth0_client_grant" "client_m2m_di_grant_management_api" {
  client_id = auth0_client.client_m2m_di.id
  audience  = "https://${var.domain}/api/v2/"
  scopes = [
    "read:client_grants",
    "create:client_grants",
    "update:client_grants",
    "create:users_app_metadata",
    "read:users_app_metadata",
    "update:users_app_metadata",
  ]
}

resource "auth0_client_grant" "client_grant_retention_service" {
  client_id = auth0_client.client_retention_service.id
  audience  = "https://${var.domain}/api/v2/"
  scopes = [
    "read:users",
    "read:users_app_metadata",
    "delete:users",
  ]
}

# *************** 5. RULES **************

# *************** 6. EMAIL PROVIDERS & TEMPLATES **************
resource "auth0_email_template" "email_template_verify_email" {
  depends_on = [module.core]

  template                = "verify_email"
  body                    = ""
  from                    = ""
  result_url              = ""
  subject                 = ""
  syntax                  = "liquid"
  url_lifetime_in_seconds = var.verification_email_url_lifetime_in_seconds
  enabled                 = false
}

# *************** 7. ACTIONS **************
# *************** Pre-registration Actions **************
resource "auth0_action" "action_pre_reg_blocked_domain_filter" {
  name    = "Blocked Domain Filter"
  runtime = var.node_runtime_version
  deploy  = true
  code = replace(
    file("${path.module}/scripts/actions/pre-registration/BlockedDomainFilter.js"),
    "\"__BLOCKED_DOMAINS__\"",
    jsonencode(jsondecode(file("${path.module}/scripts/actions/pre-registration/blocked_domains.json")))
  )

  supported_triggers {
    id      = "pre-user-registration"
    version = "v2"
  }

  dynamic "dependencies" {
    for_each = local.otel_dependencies
    content {
      name    = dependencies.value.name
      version = dependencies.value.version
    }
  }
  secrets {
    name  = "OTLP_EXPORTER_url"
    value = var.otel_exporter_url
  }
}

resource "auth0_action" "action_pre_reg_validate_req_fields" {
  name    = "Validate Data"
  runtime = var.node_runtime_version
  deploy  = true
  code    = file("${path.module}/scripts/actions/pre-registration/ValidateRegistrationFields.js")

  supported_triggers {
    id      = "pre-user-registration"
    version = "v2"
  }
  dynamic "dependencies" {
    for_each = local.otel_dependencies
    content {
      name    = dependencies.value.name
      version = dependencies.value.version
    }
  }
  dependencies {
    name    = "zod"
    version = var.dep_zod_version #3.24.3
  }
  secrets {
    name  = "OTLP_EXPORTER_url"
    value = var.otel_exporter_url
  }
  secrets {
    name  = "AGE_CHECK"
    value = var.age_check
  }
  secrets {
    name  = "REQUIRED_FIELDS_CHECK"
    value = var.required_fields_check
  }
  secrets {
    name  = "M2M_CLIENT_ID_1"
    value = auth0_client.client_lead_ads.id
  }
  secrets {
    name  = "DI_M2M_CLIENT_1"
    value = auth0_client.client_m2m_di.id
  }
  secrets {
    name  = "DI_M2M_CLIENT_2"
    value = auth0_client.client_m2m_digital_incentives.id
  }
}

resource "auth0_action" "action_pre_reg_add_app_metadata" {
  name    = "Add App Metadata"
  runtime = var.node_runtime_version
  deploy  = true
  code    = file("${path.module}/scripts/actions/pre-registration/AddAppMetadata.js")

  supported_triggers {
    id      = "pre-user-registration"
    version = "v2"
  }

  dependencies {
    name    = "uuid"
    version = var.dep_uuid_version
  }
  dynamic "dependencies" {
    for_each = local.otel_dependencies
    content {
      name    = dependencies.value.name
      version = dependencies.value.version
    }
  }
  secrets {
    name  = "OTLP_EXPORTER_url"
    value = var.otel_exporter_url
  }
}
resource "auth0_action" "action_pre_reg_cdp_registration" {
  name    = "CDP Registration"
  runtime = var.node_runtime_version
  deploy  = true
  code    = file("${path.module}/scripts/actions/pre-registration/CDPRegistration.js")

  supported_triggers {
    id      = "pre-user-registration"
    version = "v2"
  }

  dependencies {
    name    = "axios"
    version = var.dep_axios_version
  }
  dynamic "dependencies" {
    for_each = local.otel_dependencies
    content {
      name    = dependencies.value.name
      version = dependencies.value.version
    }
  }

  secrets {
    name  = "API_KEY"
    value = var.cgw_api_key
  }
  secrets {
    name  = "OTLP_EXPORTER_url"
    value = var.otel_exporter_url
  }

  secrets {
    name  = "COUNTRY_CODE"
    value = var.market_country_code
  }

  secrets {
    name  = "CGW_REGISTRATION_API_URL"
    value = var.cgw_registration_endpoint
  }
  secrets {
    name  = "LEAD_ADS_CLIENT_1"
    value = auth0_client.client_lead_ads.id
  }
}

# Pre-registration Flow
resource "auth0_trigger_actions" "actions_flow_pre_user_registration" {
  trigger = "pre-user-registration"

  actions {
    id           = auth0_action.action_pre_reg_blocked_domain_filter.id
    display_name = auth0_action.action_pre_reg_blocked_domain_filter.name
  }

  actions {
    id           = auth0_action.action_pre_reg_validate_req_fields.id
    display_name = auth0_action.action_pre_reg_validate_req_fields.name
  }

  actions {
    id           = auth0_action.action_pre_reg_add_app_metadata.id
    display_name = auth0_action.action_pre_reg_add_app_metadata.name
  }

  actions {
    id           = auth0_action.action_pre_reg_cdp_registration.id
    display_name = auth0_action.action_pre_reg_cdp_registration.name
  }
}

# *************** Post-login Actions **************
resource "auth0_action" "action_post_login_send_okta_user_id" {
  name    = "SendOktaUserId"
  runtime = var.node_runtime_version
  deploy  = true
  code    = file("${path.module}/scripts/actions/post-login/SendOktaUserId.js")

  supported_triggers {
    id      = "post-login"
    version = "v3"
  }
  dependencies {
    name    = "axios"
    version = var.dep_axios_version
  }
  dynamic "dependencies" {
    for_each = local.otel_dependencies
    content {
      name    = dependencies.value.name
      version = dependencies.value.version
    }
  }

  secrets {
    name  = "API_KEY"
    value = var.cgw_api_key
  }
  secrets {
    name  = "OTLP_EXPORTER_url"
    value = var.otel_exporter_url
  }
  secrets {
    name  = "CGW_USERID_API_URL"
    value = var.cgw_okta_user_id_endpoint
  }
}

resource "auth0_action" "action_post_login_add_custom_claims" {
  name    = "Add Custom Claims"
  runtime = var.node_runtime_version
  deploy  = true
  code    = file("${path.module}/scripts/actions/post-login/AddCustomClaims.js")

  supported_triggers {
    id      = "post-login"
    version = "v3"
  }
  dynamic "dependencies" {
    for_each = local.otel_dependencies
    content {
      name    = dependencies.value.name
      version = dependencies.value.version
    }
  }
  secrets {
    name  = "OTLP_EXPORTER_url"
    value = var.otel_exporter_url
  }
}

resource "auth0_action" "action_post_login_mfa_handler" {
  name    = "MFA-Handler"
  runtime = var.node_runtime_version
  deploy  = true
  code    = file("${path.module}/scripts/actions/post-login/MFAHandler.js")

  supported_triggers {
    id      = "post-login"
    version = "v3"
  }
  dynamic "dependencies" {
    for_each = local.otel_dependencies
    content {
      name    = dependencies.value.name
      version = dependencies.value.version
    }
  }
  secrets {
    name  = "OTLP_EXPORTER_url"
    value = var.otel_exporter_url
  }
  secrets {
    name  = "MFA_URL"
    value = var.mfa_url
  }
  secrets {
    name  = "CLIENT_WITH_MFA_1"
    value = auth0_client.client_spa_joltx_enviedeplus_com.id
  }
}

# Post-login Flow
resource "auth0_trigger_actions" "actions_flow_post_login" {
  trigger = "post-login"

  actions {
    id           = auth0_action.action_post_login_send_okta_user_id.id
    display_name = auth0_action.action_post_login_send_okta_user_id.name
  }

  actions {
    id           = auth0_action.action_post_login_add_custom_claims.id
    display_name = auth0_action.action_post_login_add_custom_claims.name
  }

  actions {
    id           = auth0_action.action_post_login_mfa_handler.id
    display_name = auth0_action.action_post_login_mfa_handler.name
  }
}

resource "auth0_action" "action_send_phone_message_twilio_verify" {
  name    = "Twilio-Verify"
  runtime = var.node_runtime_version
  deploy  = true
  code    = file("${path.module}/scripts/actions/send-phone-message/TwilioVerify.js")

  supported_triggers {
    id      = "send-phone-message"
    version = "v2"
  }

  dependencies {
    name    = "twilio"
    version = var.dep_twilio_version
  }
  dynamic "dependencies" {
    for_each = local.otel_dependencies
    content {
      name    = dependencies.value.name
      version = dependencies.value.version
    }
  }
  secrets {
    name  = "OTLP_EXPORTER_url"
    value = var.otel_exporter_url
  }
  secrets {
    name  = "TWILIO_ACCOUNT_SID"
    value = var.twilio_account_sid
  }
  secrets {
    name  = "TWILIO_AUTH_TOKEN"
    value = var.twilio_auth_token
  }
  secrets {
    name  = "TWILIO_VERIFY_SERVICE_SID"
    value = var.twilio_verify_service_sid
  }
}

resource "auth0_action" "action_phone_number_verify" {
  name    = "Phone-Number-Verify"
  runtime = var.node_runtime_version
  deploy  = true
  code    = file("${path.module}/scripts/actions/send-phone-message/PhoneNumberVerify.js")

  supported_triggers {
    id      = "send-phone-message"
    version = "v2"
  }

  dependencies {
    name    = "axios"
    version = var.dep_axios_version
  }

  dependencies {
    name    = "twilio"
    version = var.dep_twilio_version
  }

  dynamic "dependencies" {
    for_each = local.otel_dependencies
    content {
      name    = dependencies.value.name
      version = dependencies.value.version
    }
  }

  secrets {
    name  = "CIAM_CONNECTOR_URL"
    value = var.ciam_connector_url
  }

  secrets {
    name  = "ACCESS_TOKEN"
    value = var.ciam_connector_access_token
  }

  secrets {
    name  = "AUTH0_DOMAIN"
    value = var.domain
  }

  secrets {
    name  = "OTLP_EXPORTER_url"
    value = var.otel_exporter_url
  }

  secrets {
    name  = "VERIFY_SID"
    value = var.verify_sid
  }

  secrets {
    name  = "ACCOUNT_SID"
    value = var.account_sid
  }

  secrets {
    name  = "AUTH_TOKEN"
    value = var.auth_token
  }

  secrets {
    name  = "PHONE_UNIQUENESS_WHITELIST"
    value = var.phone_uniqueness_whitelist
  }
  secrets {
    name  = "COUNTRY_CODE"
    value = var.market_country_code
  }
  secrets {
    name  = "DOMAIN"
    value = var.phone_verify_domain
  }
  secrets {
    name  = "REGION"
    value = var.client_region
  }

  secrets {
    name  = "ALLOW_ALL_PREFIXES"
    value = var.allow_all_prefixes
  }

  secrets {
    name  = "ALLOWED_PREFIXES"
    value = var.allowed_prefixes
  }

  secrets {
    name  = "BLOCK_VOIP_NUMBERS"
    value = var.block_voip_numbers
  }

  secrets {
    name  = "BLOCK_SMS_PUMPING_ATTACKS"
    value = var.block_sms_pumping_attacks
  }

  secrets {
    name  = "SMS_PUMPING_RISK_THRESHOLD"
    value = var.sms_pumping_risk_threshold
  }

  secrets {
    name  = "PHONE_UNIQUENESS_CHECK_ENABLED"
    value = var.phone_uniqueness_check_enabled
  }
}

resource "auth0_trigger_actions" "actions_flow_send_phone_message" {
  trigger = "send-phone-message"

  actions {
    id           = auth0_action.action_phone_number_verify.id
    display_name = auth0_action.action_phone_number_verify.name
  }

  actions {
    id           = auth0_action.action_send_phone_message_twilio_verify.id
    display_name = auth0_action.action_send_phone_message_twilio_verify.name
  }
}

# *************** BRANDING **************
resource "auth0_branding" "branding_1_dev_page_template" {
  logo_url = "https://example.com/assets/logo.png"

  colors {
    primary         = "#d129a1"
    page_background = "#ffffff"
  }

  #NOTE: custom prompts need this (page templates) to be enabled
  universal_login {
    body = file("${path.module}/templates/index.html")
  }
}

resource "auth0_prompt_screen_partials" "custom_prompt_signup" {
  prompt_type = "signup"

  screen_partials {
    screen_name = "signup"
    insertion_points {
      form_content_start = file("${path.module}/custom-prompts/signup/form-content-start.html")
      form_content_end   = file("${path.module}/custom-prompts/signup/form-content-end.html")
    }
  }
}

resource "auth0_branding_theme" "theme" {
  borders {
    button_border_weight = 2
  }

  colors {
    base_focus_color          = "#4e7591"
    base_hover_color          = "#ffffff"
    body_text                 = "#3e3d40"
    error                     = "#e20714"
    header                    = "#3e3d40"
    icons                     = "#527a98"
    input_border              = "#c5c5c5"
    input_filled_text         = "#3e3d40"
    input_labels_placeholders = "#6b6b6b"
    links_focused_components  = "#527a98"
    primary_button            = "#d129a1"
    primary_button_label      = "#ffffff"
    secondary_button_border   = "#0579d1"
    secondary_button_label    = "#0579d1"
    success                   = "#008a00"
  }

  fonts {
    links_style         = "underlined"
    reference_text_size = 16

    body_text {
      bold = false
      size = 87.5
    }

    buttons_text {
      bold = true
      size = 100
    }

    input_labels {
      bold = false
      size = 100
    }

    links {
      bold = true
      size = 87.5
    }

    title {
      bold = true
      size = 150
    }

    subtitle {
      bold = false
      size = 87.5
    }
  }

  page_background {
    background_color = "#ffffff"
    page_layout      = "center"
  }

  widget {
    header_text_alignment = "center"
    logo_position         = "center"
    logo_url              = "https://example.com/assets/logo.png"
  }
}

resource "auth0_prompt_custom_text" "reset-password_custom_text" {
  prompt   = "reset-password"
  language = "fr-FR"
  body = jsonencode(
    {
      "reset-password-success" : {
        "buttonText" : "Connexion"
      },
      "reset-password-request" : {
        "buttonText" : "Recevoir le lien par e-mail​",
        "backToLoginLinkText" : "Retour",
        "title" : "Réinitialiser votre mot de passe​",
        "descriptionEmail" : "Saisissez votre adresse e-mail​ afin de recevoir un lien pour changer votre mot de passe.​"
      },
      "reset-password-error" : {
        "pageTitle" : "Erreur de réinitialisation du mot de passe",
        "backToLoginLinkText" : "Retour"
      },
      "reset-password" : {
        "title" : "Saisissez un nouveau mot de passe​",
        "description" : " ",
        "reEnterpasswordPlaceholder" : "Confirmez ce mot de passe​"
      },
      "reset-password-email" : {
        "title" : "Consultez votre boîte mail​​",
        "emailDescription" : "Nous avons envoyé un lien de réinitialisation à l'adresse e-mail indiquée. Cliquez sur le lien contenu dans l'e-mail pour modifier votre mot de passe."
      }
    }
  )
}

resource "auth0_prompt_custom_text" "login_custom_text" {
  prompt   = "login"
  language = "fr-FR"
  body = jsonencode(
    {
      "login" : {
        "title" : "Bienvenue !",
        "pageTitle" : "Se connecter",
        "description" : "Connectez-vous ou inscrivez-vous afin d'accéder à l'ensemble des offres Envie de Plus",
        "buttonText" : "Se connecter",
        "signupActionLinkText" : "S'inscrire gratuitement",
        "wrong-email-credentials" : "L'adresse e-mail ou le mot de passe est incorrect. Veuillez réessayer.",
        "no-password" : "Veuillez saisir un mot de passe​"
      }
    }
  )
}

resource "auth0_prompt_custom_text" "signup_custom_text" {
  prompt   = "signup"
  language = "fr-FR"
  body = jsonencode(
    {
      "signup" : {
        "pageTitle" : "Inscription",
        "title" : "Bienvenue !",
        "description" : "Inscrivez-vous gratuitement sur Envie de Plus pour profiter de nos offres",
        "email-in-use" : "Ces informations sont déjà associées à un compte"
      }
    }
  )
}

# *************** 2FA DISCLAIMER **************

resource "auth0_prompt_custom_text" "mfa_sms_custom_text" {
  prompt   = "mfa-sms"
  language = "fr-FR"
  body = jsonencode({
    "mfa-sms-enrollment" = {
      "pageTitle"               = "Entrez votre numéro de téléphone pour vous connecter à l'aide d'un SMS. | $${clientName}",
      "title"                   = "Sécurisez votre compte",
      "description"             = "L'authentification à deux facteurs renforce votre sécurité. Elle permet d'envoyer des codes de vérification sur votre numéro de mobile afin de protéger votre compte, vos informations personnelles et vos données contre tout accès non autorisé. Nous nous engageons à utiliser vos informations à des fins de sécurité et pour améliorer votre expérience. Pour plus de détails, veuillez consulter notre politique de confidentialité et nos conditions de participations.",
      "buttonText"              = "Continuer",
      "pickAuthenticatorText"   = "Essayer une autre méthode",
      "placeholder"             = "Entrez votre numéro de téléphone",
      "logoAltText"             = "$${companyName}",
      "send-sms-failed"         = "Il y a eu un problème lors de l'envoi du SMS",
      "sms-authenticator-error" = "Le SMS n'a pas pu être envoyé ou le numéro de téléphone saisi est déjà utilisé. Veuillez réessayer plus tard ou utiliser un autre numéro.",
      "invalid-phone-format"    = "Le numéro de téléphone ne peut contenir que des chiffres.",
      "invalid-phone"           = "Il semble que votre numéro de téléphone ne soit pas valide. Vérifiez et réessayez.",
      "too-many-sms"            = "Nombre maximum de SMS par heure dépassé. Attendez quelques minutes et réessayez.",
      "transaction-not-found"   = "Votre transaction d'enregistrement a expiré. Vous devez recommencer.",
      "no-phone"                = "Entrez votre numéro de téléphone",
      "phone-is-too-short"      = "Numéro de téléphone trop court.",
      "phone-is-too-long"       = "Numéro de téléphone trop long."
    }
  })
}

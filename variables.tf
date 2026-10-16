variable "domain" {
  type        = string
  description = "Domain name"
}

variable "client_id" {
  type        = string
  description = "Application id for connection between tenant and terraform"
}

variable "client_secret" {
  type        = string
  sensitive   = true
  description = "Application secret for connection between tenant and terraform"
}

variable "akamai_api_key" {
  type        = string
  sensitive   = true
  description = "Akamai Basic Access Token"
}

variable "akamai_marketing_program_type" {
  type        = string
  description = "Akamai Marketing Program Type"
}

variable "akamai_domain" {
  type        = string
  description = "Akamai Domain either US or EU"
}

variable "akamai_flow_version" {
  type = string
}

variable "akamai_client_id" {
  type      = string
  sensitive = true
}

variable "akamai_locale" {
  type = string
}

variable "akamai_flow" {
  type = string
}

variable "akamai_redirect_uri" {
  type = string
}

variable "client_region" {
  type        = string
  description = "Region for each client (application)"
}

variable "aws_ses_custom_email_address" {
  type = string
}

variable "cgw_api_key" {
  type        = string
  sensitive   = true
  description = "API key for CDP Registration"
}

variable "aws_ses_custom_email_provider_id" {
  type = string
}

variable "aws_ses_custom_email_provider_secret" {
  type      = string
  sensitive = true
}

variable "aws_ses_custom_email_provider_region" {
  type = string
}

variable "azure_log_stream_region" {
  type        = string
  description = "Region for each Azure Log Analytics"
}

variable "azure_log_stream_resource_group" {
  type        = string
  description = "Resource group Azure Log Analytics"
}

variable "azure_log_stream_subscription_id" {
  type        = string
  description = "Subscription ID for Azure Log Analytics"
}

variable "dep_uuid_version" {
  type        = string
  description = "version of uuid library needed in actions"
}

variable "dep_axios_version" {
  type        = string
  description = "version of axios library needed in actions"
}


variable "mapp_authorization_basic_token" {
  type      = string
  sensitive = true
}

variable "mapp_get_user_api_url" {
  type = string
}

variable "mapp_create_user_api_url" {
  type = string
}

variable "mapp_send_email_api_url" {
  type = string
}

variable "mapp_message_id_web" {
  type = string
}

variable "mapp_message_id_lead_gen" {
  type = string
}

variable "dep_otel_otlp_proto_version" {
  type = string
}

variable "dep_otel_sdk_trace_node_version" {
  type = string
}

variable "dep_otel_resources_version" {
  type = string
}

variable "dep_otel_sdk_trace_base_version" {
  type = string
}

variable "dep_otel_semantic_conventions_version" {
  type = string
}

variable "dep_otel_api_version" {
  type = string
}

variable "otel_exporter_url" {
  type = string
}

variable "rtdf_authorization_api_key" {
  type        = string
  sensitive   = true
  description = "rtdf dev api key"
}

# Global
variable "rtdf_http_endpoint" {
  type        = string
  description = "rtdf dev http endpoint"
}
variable "cgw_okta_user_id_endpoint" {
  type        = string
  description = "cgw oktauserid endpoint"
}

variable "jwt_token_lifetime" {
  type        = number
  description = "token lifetime"
}
variable "session_lifetime" {
  type        = number
  description = "session lifetime"
}

variable "id_token_lifetime" {
  type        = number
  description = "id token lifetime"
}

variable "access_token_lifetime" {
  type        = number
  description = "access token lifetime"
}


#specific
variable "password_reset_email_url_lifetime_in_seconds" {
  type        = number
  description = "lifetime of password reset email url in seconds"
}

# specific
variable "verification_email_url_lifetime_in_seconds" {
  type        = number
  description = "lifetime of verification email url in seconds"
}

variable "node_runtime_version" { #node22
  type = string
}
variable "age_check" {
  type        = string
  sensitive   = false
  description = "Boolean which enables age check function in ValidateData action"
}
# Specific
variable "required_fields_check" {
  type        = string
  sensitive   = false
  description = "Boolean which enables validateRequiredData function in ValidateData action"
}
variable "dep_zod_version" {
  type = string
}
variable "market_country_code" {
  type = string
}

variable "cgw_registration_endpoint" {
  type        = string
  description = "cgw registeration endpoint"
}

variable "mfa_url" {
  type        = string
  description = "url for mfa handler"
}


variable "ciam_connector_url" {
  description = "CIAM connector URL"
  type        = string
}

variable "ciam_connector_access_token" {
  description = "CIAM connector access token"
  sensitive   = true
  type        = string
}

variable "verify_sid" {
  sensitive = true
  type      = string
}

variable "account_sid" {
  sensitive = true
  type      = string
}

variable "auth_token" {
  sensitive = true
  type      = string
}

variable "phone_uniqueness_whitelist" {
  sensitive = true
  type      = string
}

variable "phone_verify_domain" {
  type        = string
  sensitive   = false
  description = "Domain for PhoneVerify action"
}

variable "dep_twilio_version" {
  type        = string
  description = "version of twilio library needed in actions"
}

variable "twilio_account_sid" {
  type        = string
  sensitive   = true
  description = "Twilio Account SID"
}

variable "twilio_auth_token" {
  type        = string
  sensitive   = true
  description = "Twilio Auth Token"
}

variable "twilio_verify_service_sid" {
  type        = string
  description = "Twilio Verify Service SID"
}

variable "allow_all_prefixes" {
  type    = string
  default = "false"
}

variable "allowed_prefixes" {
  description = "allowed country codes for SMS OTP"
  type        = string
}

variable "block_voip_numbers" {
  type    = string
  default = "false"
}

variable "block_sms_pumping_attacks" {
  type    = string
  default = "false"
}

variable "phone_uniqueness_check_enabled" {
  type = string
}

variable "sms_pumping_risk_threshold" {
  type        = string
  description = "Threshold for blocking SMS pumping attacks (e.g., mild, moderate, high)"
  default     = "mild"
}

variable "ip_blocking_active" {
  type        = bool
  description = "Activate the IP block list"
  default     = false
}

variable "country_blocking_active" {
  type        = bool
  description = "Activate the country block list"
  default     = false
}

variable "blocked_ipv4" {
  type        = list(string)
  description = "IPv4 CIDRs to block. Use [\"\"] as dummy."
  default     = [""]
}

variable "blocked_ipv6" {
  type        = list(string)
  description = "IPv6 CIDRs to block. Use [""] as dummy."
  default     = [""]
}

variable "blocked_countries" {
  type        = list(string)
  description = "ISO country codes to block. Use [\"ZZ\"] as dummy."
  default     = ["ZZ"]
}

variable "suspicious_ip_allowlist" {
  type        = list(string)
  description = "IPs exempted from the suspicious_ip_throttling attack-protection shield"
  default     = []
}

variable "enable_custom_domain_in_emails" {
  type        = bool
  description = "Use custom domain in email links"
}

variable "enable_public_signup_user_exists_error" {
  type        = bool
  description = "Show error when user already exists during signup"
}

variable "attack_protection_profile" {
  type        = string
  description = "Suspicious IP throttling profile: strict, moderate, or relaxed"
}

variable "reset_email_result_url" {
  type        = string
  description = "URL to redirect users after password reset"
}

variable "reset_email_subject" {
  type        = string
  description = "Subject line for the password reset email"
}

variable "disable_signup" {
  type        = bool
  description = "Disable public signups on the DB connection"
}

variable "oidc_logout_prompt_enabled" {
  type        = bool
  description = "Whether to prompt the user on OIDC logout"
}

variable "import_mode" {
  type        = bool
  description = "Enable import mode on the DB connection (lazy migration)"
}

variable "password_policy" {
  type        = string
  description = "Password policy strength: none, low, fair, good, or excellent"
}

variable "enabled_locales" {
  type        = list(string)
  description = "Enabled locales for the tenant"
}

variable "welcome_email_active" {
  type        = bool
  description = "Enable welcome email"
}

variable "welcome_email_subject" {
  type        = string
  description = "Subject line for the welcome email"
}

variable "reset_email_active" {
  type        = bool
  description = "Enable password reset email"
}

variable "enabled_database_customization" {
  type        = bool
  description = "Enable database customization scripts on the DB connection"
}

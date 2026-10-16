# --- Tenant ---
moved {
  from = auth0_tenant.tenant_ghh_fra_1_dev
  to   = module.core.auth0_tenant.this
}

moved {
  from = auth0_prompt.Authentication_Profile
  to   = module.core.auth0_prompt.this
}

# --- Attack Protection ---
moved {
  from = auth0_attack_protection.attack_protection
  to   = module.core.auth0_attack_protection.this
}

# --- DB Connection ---
moved {
  from = auth0_connection.connection_username_password_authentication
  to   = module.core.auth0_connection.db
}

moved {
  from = auth0_connection_clients.connection_clients_assoc
  to   = module.core.auth0_connection_clients.db
}

# --- M2M Clients ---
moved {
  from = auth0_client.client_m2m_cpc_dsr
  to   = module.core.auth0_client.m2m_cpc_dsr
}

moved {
  from = auth0_client.client_m2m_gcr_service
  to   = module.core.auth0_client.m2m_gcr_service
}

moved {
  from = auth0_client.spyglass_monitoring
  to   = module.core.auth0_client.m2m_spyglass
}

moved {
  from = auth0_client.client_falconeshield
  to   = module.core.auth0_client.m2m_falcone_shield
}

moved {
  from = auth0_client.client_maintenance_service
  to   = module.core.auth0_client.m2m_maintenance_service
}

# --- M2M Client Grants ---
moved {
  from = auth0_client_grant.client_grant_cpc_dsr
  to   = module.core.auth0_client_grant.m2m_cpc_dsr
}

moved {
  from = auth0_client_grant.client_grant_gcr_service
  to   = module.core.auth0_client_grant.m2m_gcr_service
}

moved {
  from = auth0_client_grant.spyglass_monitoring_grant_management_api
  to   = module.core.auth0_client_grant.m2m_spyglass
}

moved {
  from = auth0_client_grant.client_falconeshield
  to   = module.core.auth0_client_grant.m2m_falcone_shield
}

moved {
  from = auth0_client_grant.client_grant_maintenance_service
  to   = module.core.auth0_client_grant.m2m_maintenance_service
}

# --- CGW API ---
moved {
  from = auth0_resource_server.api_cgw
  to   = module.core.auth0_resource_server.cgw
}

# --- Email Provider & Templates ---
moved {
  from = auth0_email_provider.email_provider_ses
  to   = module.core.auth0_email_provider.this
}

moved {
  from = auth0_email_template.email_template_password_reset
  to   = module.core.auth0_email_template.reset_email
}

moved {
  from = auth0_email_template.email_template_welcome_email
  to   = module.core.auth0_email_template.welcome_email
}

# --- Log Streams ---
moved {
  from = auth0_log_stream.azure_log_analytics_stream
  to   = module.core.auth0_log_stream.azure
}

moved {
  from = auth0_log_stream.rtdf-webhook
  to   = module.core.auth0_log_stream.rtdf
}

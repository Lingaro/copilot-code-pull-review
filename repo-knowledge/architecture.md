# Architecture

## Overview

This repository configures an Auth0 tenant using Terraform and supplies the source code and presentation assets used by that tenant. The root Terraform configuration is in [`main.tf`](../main.tf), with tenant inputs declared in [`variables.tf`](../variables.tf).

## Main areas

- **Tenant and applications:** `main.tf` configures the core Terraform module, custom domain, Guardian phone provider, web/native/M2M clients, grants, branding, and prompt customization.
- **Auth0 Actions:** [`scripts/actions/`](../scripts/actions) contains CommonJS handlers for Auth0's `pre-user-registration`, `post-login`, and `send-phone-message` triggers. Terraform deploys each handler as an `auth0_action` and connects Actions into trigger flows.
- **Signup interface:** [`custom-prompts/signup/`](../custom-prompts/signup) adds fields and consent markup to signup. [`templates/index.html`](../templates/index.html) is the Universal Login page template.
- **Email templates:** [`templates/passwordReset.html`](../templates/passwordReset.html) and [`templates/welcomeEmail.html`](../templates/welcomeEmail.html) are passed to the core module as email bodies.
- **Tests and mocks:** Action specs and Auth0/dependency mocks are under `scripts/actions/`; there are specs for registration validation, app metadata, CDP registration, custom claims, and Okta ID dispatch.

## Runtime shape

Actions receive Auth0 `event` and `api` objects, use secrets provisioned by Terraform, and generally create OpenTelemetry spans. Several handlers call external APIs using `axios` or the Twilio SDK. Signup Actions may deny access; post-login handlers set claims, enable MFA, or attempt a best-effort external dispatch.

## Deployment and configuration

The root configuration requires Terraform `>= 1.13.0`, Auth0 provider `1.38.0`, and a Terraform Cloud backend. Action runtime and dependency versions are supplied by variables. Deployments therefore depend on Terraform inputs, provider/module availability, Auth0 secrets, and the managed Terraform Cloud workspace.

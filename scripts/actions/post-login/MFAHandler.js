const { SpanStatusCode } = require("@opentelemetry/api");
const { BatchSpanProcessor } = require("@opentelemetry/sdk-trace-base");
const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
const opentelemetry = require("@opentelemetry/api");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-proto");
const { Resource } = require("@opentelemetry/resources");
const {
  SemanticResourceAttributes,
} = require("@opentelemetry/semantic-conventions");

/**
 * Initializes the OpenTelemetry SDK with the OTLP exporter.
 *
 * @param {string} otlpExporterUrl - The URL of the OTLP exporter.
 *
 * @version 1.0
 * @last_update 19.11.2024
 */
function initOtel(otlpExporterUrl) {
  try {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "de-auth0",
      [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0",
    });

    // Instrumentation
    const provider = new NodeTracerProvider({
      resource: resource,
    });

    const otlpExporter = new OTLPTraceExporter({
      url: otlpExporterUrl,
      timeoutMillis: 1500,
    });

    provider.addSpanProcessor(
      new BatchSpanProcessor(otlpExporter, {
        maxQueueSize: 200,
        maxExportBatchSize: 100,
        scheduledDelayMillis: 100,
        exportTimeoutMillis: 1500,
      }),
    );

    provider.register();

    // Creation of spans
    const tracer = opentelemetry.trace.getTracer("auth0-post-login-MFAHandler");

    return { tracer, provider };
  } catch (err) {
    log(
      "error",
      `OTel initialization failed: ${err && err.message}. Continuing without tracing.`,
    );
    return { tracer: opentelemetry.trace.getTracer("noop"), provider: null };
  }
}

/**
 * Logs a message with a timestamp and a predefined prefix.
 *
 * @param {string} level - The log level indicating the severity of the log message. Accepts 'error' for error messages;
 *                         any other value defaults to a general log message.
 * @param {string} message - The message to be logged. This is the main content of the log entry.
 *
 * @version 3.0
 * @last_update 19.11.2024
 */
function log(level, message) {
  const logPrefix = "[MFA Handler - Action]:";
  console[`${level}`](`${logPrefix} ${message}`);
}

/**
 * post-login action to trigger MFA based on acr parameter in authorization request
 * @version 1.1
 * @last_update 02.06.2026
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
 */
/**
 * Flushes any queued spans with a hard time cap.
 *
 * Races provider.forceFlush() against a timer so that a slow or unreachable OTLP
 * endpoint can never block the action beyond `maxWaitMs`. Any in-flight export is
 * abandoned when the action returns. Never throws.
 *
 * @param {NodeTracerProvider|null} provider - The provider to flush, or null when OTel init failed.
 * @param {number} [maxWaitMs=500] - Maximum time to wait for the flush to complete.
 */
async function flushOtel(provider, maxWaitMs = 500) {
  if (!provider) {
    return;
  }
  try {
    await Promise.race([
      provider.forceFlush().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, maxWaitMs)),
    ]);
  } catch (err) {
    log("error", `OTel flush failed: ${err && err.message}.`);
  }
}
exports.onExecutePostLogin = async (event, api) => {
  const { tracer, provider } = initOtel(event.secrets.OTLP_EXPORTER_url);
  return tracer.startActiveSpan("MFAHandler", async (parentSpan) => {
    log("info", "Start.");
    if (!parentSpan) {
      log("error", "Failed to retrieve the current span");
    } else {
      log("info", `Trace ID: ${parentSpan.spanContext().traceId}`);
    }

    // Pass tenant name to Grafana endpoint
    parentSpan.setAttribute("tenantName", event.tenant.id);
    parentSpan.setAttribute("consumerId", event.user.app_metadata.consumerId);
    parentSpan.setAttribute("userId", event.user.user_id);

    const mfa_url = event.secrets.MFA_URL;
    const MFAPolicy =
      event?.transaction?.acr_values &&
      event.transaction.acr_values.includes(mfa_url);

    const useMFA = event.request.query.useMFA === "true"; // Param that is sent by app for wallet withdrawals flows

    try {
      const CLIENTS_WITH_MFA = [event.secrets.CLIENT_WITH_MFA_1];

      // Validate required parameters
      if (!event.client?.client_id) {
        const errorMessage = "Error: Missing client information.";
        parentSpan.recordException(new Error(errorMessage));
        parentSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: errorMessage,
        });
        log("error", errorMessage);
        return;
      }
      const enrolledMFACount = event.user?.multifactor?.length || 0;
      const isNewUser = event.user.app_metadata?.newUser || false;

      // Log decision context for debugging
      log(
        "info",
        `MFA decision context: client=${event.client.client_id}, MFAPolicy=${MFAPolicy}, useMFA=${useMFA}, enrolledMFACount=${enrolledMFACount}, isNewUser=${isNewUser}`,
      );
      parentSpan.addEvent("mfa_decision_context", {
        client_id: event.client.client_id,
        MFAPolicy: MFAPolicy,
        useMFA: useMFA,
        enrolledMFACount: enrolledMFACount,
        isNewUser: isNewUser,
      });

      // Run only for the specified clients
      if (CLIENTS_WITH_MFA.includes(event.client.client_id)) {
        // Require MFA when MFA policy is enabled and if user didn't do it or if the tenant forces it (useMFA)
        if (MFAPolicy && (useMFA || enrolledMFACount === 0)) {
          const mfaType = isNewUser ? "guardian" : "any";
          if (isNewUser) {
            log("info", "triggering MFA for new user");
            api.multifactor.enable("guardian");
          } else {
            api.multifactor.enable("any", { allowRememberBrowser: false });
          }
          log(
            "info",
            `MFA enabled (type: ${mfaType}) for client: ${event.client.client_id}`,
          );
          parentSpan.addEvent("mfa_enabled", {
            operation: "Enable MFA",
            mfaType: mfaType,
            reason: "MFAPolicy passed and conditions met",
            description: `MFA enabled (type: ${mfaType}) for client: ${event.client.client_id}`,
          });
          parentSpan.setStatus({
            code: SpanStatusCode.OK,
            message: `MFA enabled (type: ${mfaType})`,
          });
        } else if (!MFAPolicy) {
          // MFA enabled for client but acr_values missing MFA policy URL
          log(
            "info",
            `MFA skipped: acr_values missing MFA policy URL for client: ${event.client.client_id}`,
          );
          parentSpan.addEvent("mfa_skipped", {
            operation: "Check MFA policy",
            reason: "acr_values missing MFA policy URL",
            description: `MFA skipped: acr_values missing MFA policy URL for client: ${event.client.client_id}`,
          });
          parentSpan.setStatus({
            code: SpanStatusCode.OK,
            message: "MFA skipped: acr_values missing MFA policy URL",
          });
        } else {
          // MFAPolicy is true but useMFA=false and user already has MFA enrolled
          log(
            "info",
            `MFA skipped: user already has ${enrolledMFACount} MFA factor(s) enrolled for client: ${event.client.client_id}`,
          );
          parentSpan.addEvent("mfa_skipped", {
            operation: "Check MFA enrollment",
            reason: "user already enrolled",
            enrolledMFACount: enrolledMFACount,
            description: `MFA skipped: user already has ${enrolledMFACount} MFA factor(s) enrolled for client: ${event.client.client_id}`,
          });
          parentSpan.setStatus({
            code: SpanStatusCode.OK,
            message: "MFA skipped: user already enrolled",
          });
        }
      } else {
        log(
          "info",
          `MFA skipped: client ${event.client.client_id} not in MFA-enabled clients list`,
        );
        parentSpan.addEvent("mfa_skipped", {
          operation: "Check client allowlist",
          reason: "client not in MFA-enabled clients list",
          description: `MFA skipped: client ${event.client.client_id} not in MFA-enabled clients list`,
        });
        parentSpan.setStatus({
          code: SpanStatusCode.OK,
          message: "MFA skipped: client not in allowlist",
        });
      }
    } catch (error) {
      parentSpan.recordException(error);
      parentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: "Failed to process MFA",
      });
      log("error", error.message);
    } finally {
      await flushOtel(provider);
      parentSpan.end();
      log("info", "End.");
    }
  });
};

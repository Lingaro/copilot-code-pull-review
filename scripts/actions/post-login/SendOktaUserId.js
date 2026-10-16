const axios = require("axios");
const { SpanStatusCode } = require("@opentelemetry/api");
const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-proto");
const { BatchSpanProcessor } = require("@opentelemetry/sdk-trace-base");
const { Resource } = require("@opentelemetry/resources");
const {
  SemanticResourceAttributes,
} = require("@opentelemetry/semantic-conventions");
const opentelemetry = require("@opentelemetry/api");

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

    const provider = new NodeTracerProvider({ resource: resource });
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

    const tracer = opentelemetry.trace.getTracer(
      "auth0-post-login-SendOktaUserId",
    );
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
  const logPrefix = "[SendOktaUserId]:";
  console[`${level}`](`${logPrefix} ${message}`);
}

/**
 * Send Okta User ID to CDP - extracted from sendOktaUserId function
 * This action sends Auth0 user IDs to CDP for tracking purposes
 * and sets the oktauseridInCDP flag when successful.
 *
 * @param {Event} event - Contains information about the login event and user details.
 * @param {PostLoginAPI} api - Provides methods to modify the access token and add custom claims.
 *
 * @version 2.0
 * @last_update 20.08.2025
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

  // Prepare attributes for the span
  const spanAttributes = {
    tenantName: event.tenant.id,
    user_id: event.user.user_id,
    consumerId: event.user.app_metadata?.consumerId || "N/A",
    sourceId: event.user.app_metadata?.sourceId || "N/A",
    mpid: event.user.app_metadata?.mpid || "N/A",
  };

  return tracer.startActiveSpan(
    "SendOktaUserId",
    { attributes: spanAttributes },
    async (span) => {
      log("info", "Start.");
      log("info", `Trace ID: ${span.spanContext().traceId}`);

      try {
        // This action should only run if the orchestrator has determined it's needed.
        if (
          (event.user.app_metadata.flow &&
            !event.user.app_metadata?.flow?.tasks?.needs_okta_id_dispatch) ||
          event.user.app_metadata.oktauseridInCDP
        ) {
          log(
            "info",
            "Skipping: Orchestrator did not flag this user for Okta ID dispatch or this user's oktaUserId was already dispatched",
          );
          span.addEvent("skipped_by_orchestrator_task_flag");
          span.setStatus({
            code: SpanStatusCode.OK,
            message: "Task not required by orchestrator.",
          });
          return;
        }

        const { user, secrets, client } = event;
        const { consumerId, mpid, sourceId } = user.app_metadata;
        const region = client.metadata?.region;

        const options = {
          method: "PUT",
          url: secrets.CGW_USERID_API_URL,
          headers: {
            "X-Api-Key": secrets.API_KEY,
            "Content-Type": "application/json",
            consumerid: consumerId,
            sourceId: sourceId,
            mpn: mpid,
            region: region,
            oktauserid: user.user_id,
          },
          data: {},
        };

        log(
          "info",
          `Sending data to CGW ${JSON.stringify({
            ...options,
            headers: {
              ...options.headers,
              "X-Api-Key": "****",
            },
          })}`,
        );

        try {
          const response = await axios(options);

          api.user.setAppMetadata("oktauseridInCDP", true);
          log(
            "info",
            `Successfully sent Okta User ID. Status: ${response.status}`,
          );
          span.addEvent("dispatch_succeeded", {
            response_status: response.status,
          });
          span.setStatus({
            code: SpanStatusCode.OK,
            message: "Okta User ID sent successfully.",
          });
        } catch (error) {
          // Graceful degradation: Do not block login on failure. add logs and traces
          const errorMessage =
            error?.response?.data?.errorMessage || "Unknown error";
          const errorDetails = error?.response?.data?.errorDetails || "";
          log(
            "error",
            `Failed to send Okta User ID to CGW: ${errorMessage}: ${errorDetails}`,
          );
          span.recordException(error?.response?.data?.errorDetails || error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `${errorMessage}: ${errorDetails}`,
          });
        }
      } catch (error) {
        const errorMessage = `Unhandled error in SendOktaUserId action: ${error.message}`;
        log("error", errorMessage);
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: errorMessage,
        });
        // Do not block login.
      } finally {
        await flushOtel(provider);
        span.end();
        log("info", "End.");
      }
    },
  );
};

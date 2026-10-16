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
 * This function sets up OpenTelemetry tracing by creating a resource with service attributes,
 * initializing a NodeTracerProvider with the resource, and configuring an OTLPTraceExporter
 * with the provided URL. The provider is then registered to start tracing.
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
    const tracer = opentelemetry.trace.getTracer(
      "auth0-post-login-AddCustomClaims",
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
 * @last_update 19.11.2024 @by asser
 */
function log(level, message) {
  const logPrefix = "[Add Custom Claims - Action]:";
  console[`${level}`](`${logPrefix} ${message}`);
}

/**
 * Adds custom claims to the access token during the PostLogin flow.
 *
 * This action is executed after a successful login. It extracts specific metadata (mpid, sourceId, consumerId,
 * and region) from the user's app_metadata and adds them as custom claims to the access token.
 *
 * @param {Event} event - Contains information about the login event and user details.
 * @param {PostLoginAPI} api - Provides methods to modify the access token and add custom claims.
 *
 * @version 2.1
 * @last_update 19.11.2024 @by asser
 * */
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
  return tracer.startActiveSpan("AddCustomClaims", async (parentSpan) => {
    log("info", "Start.");
    if (!parentSpan) {
      log("error", "Failed to retrieve the current span");
    } else {
      log("info", `Trace ID: ${parentSpan.spanContext().traceId}`);
    }

    parentSpan.setAttribute("tenantName", event.tenant.id);
    parentSpan.setAttribute("consumerId", event.user.app_metadata.consumerId);
    parentSpan.setAttribute("userId", event.user.user_id);

    const appMetadata = event.user.app_metadata;
    const { mpid, sourceId, consumerId } = appMetadata;
    const clientRegion = event.client.metadata.region;
    const akamaiId = appMetadata.akamaiLegacyId;

    // Note : this is not to be changed unless for DTC markets
    try {
      api.accessToken.setCustomClaim(`mpid`, mpid);
      api.accessToken.setCustomClaim(`sourceId`, sourceId);
      api.accessToken.setCustomClaim(`consumerId`, consumerId);
      api.accessToken.setCustomClaim(`region`, clientRegion);
      if (akamaiId) {
        api.accessToken.setCustomClaim("akamaiId", akamaiId);
      }
      api.idToken.setCustomClaim(`login_count`, event.stats.logins_count);
      api.idToken.setCustomClaim(
        `enrolled`,
        Boolean(event.user.multifactor?.length),
      );

      const userEmail = event.user.email;
      log("info", `Successfully set custom claims for user ${userEmail}.`);

      parentSpan.addEvent("success", {
        operation: "set custom claims",
        mpid: mpid,
        sourceId: sourceId,
        consumerId: consumerId,
        region: clientRegion,
        akamaiId: akamaiId,
      });
      parentSpan.setStatus({
        code: SpanStatusCode.OK,
        message: "Successfully set custom claims",
      });
    } catch (error) {
      log("error", `Error setting custom claims: ${JSON.stringify(error)}`);
      parentSpan.recordException(error);
      parentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: "Failed to set custom claims",
      });
    } finally {
      await flushOtel(provider);
      parentSpan.end();
      log("info", "End.");
    }
  });
};

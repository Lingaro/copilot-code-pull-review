const { v4: uuidv4 } = require("uuid");
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
 * Initializes the OpenTelemetry SDK with a given OTLP exporter URL.
 *
 * @param {string} otlpExporterUrl - The URL of the OTLP exporter to which the traces should be
 *                                 sent.
 * @returns {Tracer} - The initialized tracer instance.
 *
 * @version 1.0
 * @last_update 21.11.2024
 *
 * */
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

    // Creation of spans --> visible in Library name
    const tracer = opentelemetry.trace.getTracer(
      "auth0-pre-reg-AddAppMetadata",
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
 * @last_update 18.11.2024
 */
function log(level, message) {
  const logPrefix = "[Add App Metadata - Action]:";
  console[`${level}`](`${logPrefix} ${message}`);
}

/**
 * Handles the pre-user registration process by setting application-specific metadata for a user.
 *
 * This function is triggered before a user's registration is completed. It generates a unique consumer ID,
 * retrieves metadata from the event's client object, and sets this metadata along with the consumer ID as
 * application metadata for the user. It logs the start and end of the process, as well as any errors encountered.
 *
 * @param {Object} event - The event object containing user and client information.
 * @param {Object} api - The API object used to interact with user metadata.
 * @version 2.1
 * @last_update 18.11.2024
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
exports.onExecutePreUserRegistration = async (event, api) => {
  const { tracer, provider } = initOtel(event.secrets.OTLP_EXPORTER_url);
  return tracer.startActiveSpan("AddAppMetadata", async (parentSpan) => {
    log("info", "Start.");
    if (!parentSpan) {
      log("info", "No parent span.");
    } else {
      log("info", `Trace ID: ${parentSpan.spanContext().traceId}`);
    }

    try {
      const consumerId = `okta_${uuidv4()}`;

      parentSpan.setAttribute("tenantName", event.tenant.id);
      parentSpan.setAttribute("consumerId", consumerId);

      const metaData = event.client.metadata;

      const mp_type = metaData["mp_type"];
      const mpid = metaData[`${mp_type}_mpid`];
      const sourceId = metaData[`${mp_type}_sourceId`];

      api.user.setAppMetadata("mpid", mpid);
      api.user.setAppMetadata("sourceId", sourceId);
      api.user.setAppMetadata("consumerId", consumerId);

      log(
        "info",
        `Successfully set app metadata for user ${event.user.email}.`,
      );

      parentSpan.addEvent("success", {
        operation: "setting app_metadata",
        sourceId: sourceId,
        mpid: mpid,
        consumerId: consumerId,
      });
      parentSpan.setStatus({
        code: SpanStatusCode.OK,
        message: "successfully set Metadata",
      });
    } catch (error) {
      parentSpan.recordException(error);
      parentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: "Error setting app metadata.",
      });
      log("error", `Error setting app metadata: ${JSON.stringify(error)}.`);
    } finally {
      await flushOtel(provider);
      parentSpan.end();
      log("info", "End.");
    }
  });
};

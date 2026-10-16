const { trace, context, SpanStatusCode } = require("@opentelemetry/api");
const {
  ConsoleSpanExporter, //used in case endpoint fails and you want to direct traces to console to check if the problem is indeed with the endpoint
  BatchSpanProcessor,
} = require("@opentelemetry/sdk-trace-base");
const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
const opentelemetry = require("@opentelemetry/api");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-proto");
const { Resource } = require("@opentelemetry/resources");
const {
  SemanticResourceAttributes,
} = require("@opentelemetry/semantic-conventions");

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
      "auth0-pre-registration-BlockedDomainFilter",
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
 * @version 1.0
 * @last_update 12.07.2024
 */
function log(level, message) {
  const logPrefix = "[Blocked Domain Filter - Action]:";
  console[`${level}`](`${logPrefix} ${message}`);
}

/**
 * PRE-REGISTRATION ACTION that checks if the user email domain should be allowed to register.
 * If the e-mail domain exist on excludedDomains list the registration is denied.
 * The list of blocked domains is injected at deploy time from blocked_domains.json.
 *
 * @param {Event} event - Details about the context and user that is attempting to register.
 * @param {PreUserRegistrationAPI} api - Interface whose methods can be used to change the behavior of the signup.
 *
 * @version 2.0
 * @last_update 12.03.2026
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
exports.onExecutePreUserRegistration = async (event, api) => {
  const { tracer, provider } = initOtel(event.secrets.OTLP_EXPORTER_url);
  return tracer.startActiveSpan("BlockedDomainFilter", async (parentSpan) => {
    try {
      log("info", "Start.");

      if (!parentSpan) {
        log("error", "Failed to retrieve the current span");
      } else {
        log("info", `Trace ID: ${parentSpan.spanContext().traceId}`);
      }

      parentSpan.setAttribute("tenantName", event.tenant.id);
      parentSpan.setAttribute("consumerId", event.user.app_metadata.consumerId);
      parentSpan.setAttribute("userId", event.user.user_id);

      const excludedDomains = new Set("__BLOCKED_DOMAINS__");

      const isEmailGood = (email) => {
        const [local, domain] = email.split("@");
        if (!local || !domain) return false;

        const localParts = local.split(".");
        return (
          !local.includes("+") &&
          localParts.length <= 3 &&
          !excludedDomains.has(domain)
        );
      };

      if (event.user.email && !isEmailGood(event.user.email)) {
        const errorMessage =
          "User e-mail domain exists on blocked list. Denying access.";
        log("info", errorMessage);
        log("info", `Trace ID: ${parentSpan.spanContext().traceId}`);
        log("info", "End.");
        parentSpan.recordException(new Error(errorMessage));
        parentSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: errorMessage,
        });
        api.access.deny(
          "Invalid Email",
          "Veuillez entrer une adresse e-mail valide.",
        );
      } else {
        log("info", "User e-mail domain is valid. Allowing access.");
        log("info", `Trace ID: ${parentSpan.spanContext().traceId}`);
        log("info", "End.");
      }
    } catch (error) {
      parentSpan.recordException(error);
      parentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      throw error;
    } finally {
      await flushOtel(provider);
      parentSpan.end();
    }
  });
};

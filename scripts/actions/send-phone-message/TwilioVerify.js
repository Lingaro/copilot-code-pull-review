const twilio = require("twilio");
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
 * Initializes OpenTelemetry tracing with the given OTLP exporter URL.
 *
 * @param {string} otlpExporterUrl - The URL of the OTLP exporter to which traces will be sent.
 * @returns {Tracer} - The initialized Tracer instance for creating spans.
 *
 * This function sets up OpenTelemetry tracing by creating a resource with service attributes,
 * initializing a NodeTracerProvider with the resource, and configuring an OTLPTraceExporter
 * with the provided URL. The provider is then registered to start tracing.
 *
 * @version 2.0
 * @last_update 02.03.2026
 */
function initOtel(otlpExporterUrl) {
  try {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "de-auth0",
      [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0",
    });

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

    const tracer = opentelemetry.trace.getTracer(
      "auth0-send-phone-message-TwilioVerify",
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
 * @last_update 05.11.2024
 */
function log(level, message) {
  const logPrefix = "[Twilio Verify - Action]:";
  console[`${level}`](`${logPrefix} ${message}`);
}

/**
 * Logs technical error details and throws a user-friendly error message.
 * Optionally records the error in OpenTelemetry span for observability.
 *
 * @param {string} technicalMessage - The detailed technical error message for logging and tracing.
 * @param {string} userMessage - The sanitized, user-friendly error message to throw.
 * @param {Span} [span=null] - Optional OpenTelemetry span to record the error for distributed tracing.
 * @throws {Error} Always throws an Error with the userMessage.
 *
 * @version 1.0
 * @last_update 02.03.2026
 */
function throwError({
  devMessage,
  userMessage = "An error occurred. Please try again.",
  span = null,
}) {
  log("error", devMessage);
  if (span) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: devMessage,
    });
    span.recordException(new Error(devMessage));
  }
  throw new Error(userMessage);
}

// Masks a phone number to last 4 digits for safe logging.
function obfuscatePhoneNumber(phoneNumber) {
  if (!phoneNumber || phoneNumber.length < 4) {
    return "****";
  }
  const visibleDigits = phoneNumber.slice(-4);
  return "****" + visibleDigits;
}

// Removes raw phoneNumber from lookup payload before logs/spans.
function obfuscatePhoneNumberInResponse(response) {
  const { phoneNumber, ...filteredResponse } = response;
  return filteredResponse;
}
/**
 * Handler that will be called during the execution of a SendPhoneMessage flow.
 * Sends phone verification messages directly through Twilio Verify API using custom OTP codes.
 * @version 2.0
 * @last_update 02.03.2026
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {SendPhoneMessageAPI} api - Methods and utilities to help change the behavior of sending a phone message.
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
exports.onExecuteSendPhoneMessage = async (event, api) => {
  const {
    OTLP_EXPORTER_url,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_VERIFY_SERVICE_SID,
  } = event.secrets;

  if (
    !OTLP_EXPORTER_url ||
    !TWILIO_ACCOUNT_SID ||
    !TWILIO_AUTH_TOKEN ||
    !TWILIO_VERIFY_SERVICE_SID
  ) {
    throwError({
      devMessage:
        "Missing required secrets (OTLP_EXPORTER_url, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_VERIFY_SERVICE_SID)",
    });
  }

  const { tracer, provider } = initOtel(OTLP_EXPORTER_url);
  return tracer.startActiveSpan("TwilioVerify", async (parentSpan) => {
    const formattedPhoneNumber = event.message_options.recipient.split(" ");
    const phoneNumberData = {
      prefix: formattedPhoneNumber[0],
      phoneNumber: formattedPhoneNumber[1],
    };

    const fullPhoneNumber =
      phoneNumberData.prefix + phoneNumberData.phoneNumber;

    try {
      log("info", "Start.");
      log(
        "info",
        parentSpan
          ? `Trace ID: ${parentSpan.spanContext().traceId}`
          : "Failed to retrieve the current span",
      );
      parentSpan?.setAttribute("tenantName", event.tenant.id);
      parentSpan?.setAttribute(
        "consumerId",
        event.user.app_metadata.consumerId,
      );

      const messageBody = event.message_options.text;
      const otpCode = messageBody?.match(/^(\d{6})/)?.[1];

      if (!messageBody) throw new Error("Message body is undefined");
      if (!otpCode)
        throw new Error("Could not extract OTP code from message body");

      const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      const cacheKey = `twilio_lookup_${fullPhoneNumber}`;
      const cachedData = (await api.cache.get(cacheKey))?.value;
      const cachedLookupResult = cachedData ? JSON.parse(cachedData) : null;
      let normalisedPhoneNumber;
      if (cachedLookupResult) {
        log(
          "info",
          `Using cached Twilio lookup result for ${obfuscatePhoneNumber(fullPhoneNumber)}, cached data ${JSON.stringify(obfuscatePhoneNumberInResponse(cachedLookupResult.lookupResult))}`,
        );
        parentSpan?.addEvent("twilio_lookup_cache_hit", {
          prefix: phoneNumberData.prefix,
          phoneNumber: obfuscatePhoneNumber(phoneNumberData.phoneNumber),
          source: "cache",
          validationSkipped: cachedLookupResult.validationSkipped,
          status: cachedLookupResult.status,
        });
        normalisedPhoneNumber = cachedLookupResult?.lookupResult?.phoneNumber;
      }
      const verification = await twilioClient.verify.v2
        .services(TWILIO_VERIFY_SERVICE_SID)
        .verifications.create({
          to: normalisedPhoneNumber || event.message_options.recipient,
          channel: "sms",
          customCode: otpCode,
        });

      log(
        "info",
        `Verification sent successfully. SID: ${verification.sid}, Status: ${verification.status}`,
      );
      parentSpan?.setStatus({ code: SpanStatusCode.OK });
      parentSpan?.addEvent("success", {
        operation: "send-phone-message",
        description: `Successfully sent phone message to user.`,
        verificationSid: verification.sid,
        verificationStatus: verification.status,
      });
    } catch (error) {
      const devMessage = `${error.message}${error.code ? ` Error code: ${error.code}.` : ""}`;
      const userMessage =
        error.code === 60203
          ? "Too many SMS attempts. Please wait before requesting a new code."
          : error.code === 21408
            ? "SMS verification is not available for your country. Please use a phone number from a supported country."
            : "We could not send the verification SMS. Please try again later.";
      throwError({ devMessage, userMessage, span: parentSpan });
    } finally {
      await flushOtel(provider);
      parentSpan?.end();
    }
  });
};

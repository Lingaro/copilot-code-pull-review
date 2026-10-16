const axios = require("axios");

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
 * This function sets up OpenTelemetry tracing by creating a resource with service attributes,
 * initializing a NodeTracerProvider with the resource, and configuring an OTLPTraceExporter
 * with the provided URL. The provider is then registered to start tracing.
 *
 * @param {string} otlpExporterUrl - The URL of the OTLP exporter to which traces will be sent.
 * @returns {NodeTracerProvider} - The initialized NodeTracerProvider instance.
 *
 * @version 1.0
 * @last_update 10.11.2024 @by asser
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
      "auth0-pre-reg-CDPRegistration",
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
 * @last_update 20.11.2024
 */
function log(level, message) {
  const logPrefix = "[CDP Registration - Action]:";
  console[`${level}`](`${logPrefix} ${message}`);
}

/**
 * This function is triggered during the PreUserRegistration flow in an authentication/authorization process.
 * It prepares and logs user data by extracting it from the registration event and request body.
 * Then sends the data to CGW via REST API. It denies access if the API call fails.
 *
 * @param {Event} event - Contains context and user information for the registration attempt.
 * @param {PreUserRegistrationAPI} api - Provides methods to alter the signup process behavior.
 *
 * @version 3.2
 * @last_update 09.11.2024 
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
  return tracer.startActiveSpan("CDPRegistration", async (parentSpan) => {
    log("info", "Start.");
    if (!parentSpan) {
      log("error", "Failed to retrieve the current span");
    } else {
      log("info", `Current active span: ${parentSpan?.spanContext().traceId}`);
    }

    parentSpan.setAttribute("tenantName", event.tenant.id);
    parentSpan.setAttribute("consumerId", event.user.app_metadata.consumerId);

    try {
      const now = new Date().toISOString();
      let userFields;
      let optDetails;
      let traitsToSend = [
        // the traits that are always sent to CGW (base payload)
        {
          traitName: "registrationDate",
          collectedDate: now,
          values: now,
        },
        {
          traitName: "lastActivityDate",
          collectedDate: now,
          values: now,
        },
        {
          traitName: "email",
          collectedDate: now,
          values: event.user.email,
        },
      ];

      const leadAdsM2MClients = [event.secrets.LEAD_ADS_CLIENT_1];

      if (leadAdsM2MClients.includes(event.client.client_id)) {
        log(
          "info",
          `Registration through LeadAds application: ${event.client.name}`,
        );

        // check for any other data than the required fields
        const fieldsToKeep = ["mpid", "sourceId", "consumerId"];
        const allFields = Object.keys(event.user.app_metadata || {});
        log("info", `allFields data: ${JSON.stringify(allFields)}`);
        allFields.forEach((field) => {
          if (!fieldsToKeep.includes(field)) {
            api.user.setAppMetadata(field, undefined); //deleting any other data (should not happen if LeadAds team send correct payload)
          }
        });
      } else {
        userFields = {
          email: event.user.email,
          firstName: event.request.body["ulp-first-name"] || "",
          lastName: event.request.body["ulp-last-name"] || "",
          gender: event.request.body["ulp-gender"] || "",
          birthDate: event.request.body["ulp-birth-date"] || "",
        };

        log("info", `userFields data: ${JSON.stringify(userFields)}`);

        optDetails = [
          {
            optId: "291_01",
            optStatus: false,
            optChoiceDate: now,
          },
          {
            optId: "291_05",
            optStatus: false,
            optChoiceDate: now,
          },
        ];

        if (event.request.body["ulp-terms-of-service-1"] === "on") {
          optDetails[0].optStatus = true;
          optDetails[1].optStatus = true;
        }

        const standardTraitsToSend = [
          {
            traitName: "firstName",
            collectedDate: now,
            values: userFields.firstName,
          },
          {
            traitName: "lastName",
            collectedDate: now,
            values: userFields.lastName,
          },
          {
            traitName: "gender",
            collectedDate: now,
            values: userFields.gender,
          },
          {
            traitName: "birthDate",
            collectedDate: now,
            values: userFields.birthDate,
          },
        ];

        traitsToSend.push(...standardTraitsToSend);
      }

      const { consumerId, sourceId, mpid } = event.user.app_metadata;

      const options = {
        method: "POST",
        url: event.secrets.CGW_REGISTRATION_API_URL,
        headers: {
          "X-Api-Key": event.secrets.API_KEY,
          "Content-Type": "application/json",
          consumerid: consumerId,
          sourceId: sourceId,
          mpn: mpid,
          region: event.client.metadata.region,
        },
        data: JSON.stringify({
          eventName: "RegistrationComplete",
          transmitterSourceId: sourceId,
          ids: {
            countryCode: event.secrets.COUNTRY_CODE,
            email: event.user.email,
          },
          opts: optDetails ? Object.values(optDetails) : [],
          traits: traitsToSend,
          dependents: [],
        }),
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
        if (response.status !== 200) {
          throw new Error("CDP failed");
        }
        log(
          "info",
          `Success sending data to CGW - CGW Response : ${JSON.stringify(response.data.message)}`,
        );

        parentSpan.addEvent("success", {
          operation: "sending data to CGW",
          "CGW Response": JSON.stringify(response.data.message),
          "CGW Response Code": String(response.status),
        });
        parentSpan.setAttribute("CGW Trace ID", response.data.traceId);
        parentSpan.setStatus({
          code: SpanStatusCode.OK,
          message: response.data.message,
        });
      } catch (error) {
        const {
          errorMessage = "",
          errorDetails = "",
          traceId = "N/A",
        } = error.response?.data || {};
        log("error", `Registration failed: ${errorMessage}: ${errorDetails}`);
        parentSpan.setAttribute("CGW Trace ID", traceId);
        parentSpan.recordException(errorDetails || error);
        parentSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: `${errorMessage}: ${errorDetails}`,
        });
        return api.access.deny(
          `Registering failed at the CGW level, details: ${errorMessage}: ${errorDetails}`,
          "Une erreur s'est produite, veuillez réessayer plus tard",
        );
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.errorMessage || "An error has occurred";
      const errorDetails = error?.response?.data?.errorDetails || "";
      parentSpan.recordException(error?.response?.data?.errorDetails || error);
      parentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: `${errorMessage}: ${errorDetails}`,
      });
      log("error", `unexpected error: ${errorMessage}: ${errorDetails}`);
      return api.access.deny(
        `Registration failed, details: ${errorMessage}: ${errorDetails}`,
        "Une erreur s'est produite, veuillez réessayer plus tard",
      );
    } finally {
      await flushOtel(provider);
      parentSpan.end();
      log("info", "End.");
    }
  });
};

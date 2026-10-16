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
const { z } = require("zod/v4");

/**
 * Initializes the OpenTelemetry SDK with the OTLP exporter.
 *
 * @param {string} otlpExporterUrl - The URL of the OTLP exporter.
 *
 * @version 1.0
 * @last_update 19.11.2024
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

    // Creation of spans --> visible in library name
    const tracer = opentelemetry.trace.getTracer("auth0-pre-reg-ValidateData");

    return { tracer, provider };
  } catch (err) {
    log(
      "error",
      `OTel initialization failed: ${err && err.message}. Continuing without tracing.`,
    );
    return { tracer: opentelemetry.trace.getTracer("noop"), provider: null };
  }
}

// Security check patterns
const htmlInjectionPattern = /<[^>]+>/;
const urlPattern = /(https?:\/\/|www\.)[^\s]+/i;

// Basic string validation
const securityRefinements = (schema) =>
  schema
    .refine((val) => !htmlInjectionPattern.test(val), {
      message: "Potential HTML injection detected",
    })
    .refine((val) => !urlPattern.test(val), {
      message: "Potential URL detected",
    });

const requiredSafeString = securityRefinements(
  z
    .string()
    .trim()
    .min(1, "Field cannot be empty")
    .max(100, "Field is too long"),
);

// Validator for OPTIONAL fields that CAN BE EMPTY if provided
const optionalPermittingEmptySafeString = securityRefinements(
  z.string().trim().max(100, "Field is too long"), // No .min(1)
);

// Specific validator just for email format
const emailFormatValidator = z
  .email("Invalid email address")
  .max(254, "Email address is too long");

const secureEmailValidator = requiredSafeString.pipe(emailFormatValidator);
/**
 * Builds a Zod schema for validating user input.
 *
 * @param {Array.<string>} requiredFields - An array of field names that are required.
 * @param {Array.<string>} allFields - An array of all field names present in the request.
 *
 * @version 1.1
 * @last_update 02.06.2025
 * */
const buildSchema = (requiredFields, allFields) => {
  const allRelevantFields = new Set([...requiredFields, ...allFields]);
  const schemaShape = {};

  // Convert requiredFields to a Set for efficient lookups
  const requiredSet = new Set(requiredFields);

  for (const field of allRelevantFields) {
    if (requiredSet.has(field)) {
      schemaShape[field] = requiredSafeString; // Use validator that enforces non-empty
    } else {
      schemaShape[field] = optionalPermittingEmptySafeString.optional();
    }
  }

  return z.object(schemaShape);
};

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
  const logPrefix = "[Validate Data - Action]:";
  console[`${level}`](`${logPrefix} ${message}`);
}

/**
 * Handler that will be called during the execution of a PreUserRegistration flow.
 *
 * @param {Event} event - Details about the context and user that is attempting to register.
 * @param {PreUserRegistrationAPI} api - Interface whose methods can be used to change the behavior of the signup.
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
  return tracer.startActiveSpan("ValidateData", async (parentSpan) => {
    log("info", "Start.");
    if (!parentSpan) {
      log("error", "Failed to retrieve the OTel span");
    } else {
      log("info", `Trace ID: ${parentSpan.spanContext().traceId}`);
    }

    //Pass tenant name to Grafana endpoint
    parentSpan.setAttribute("tenantName", event.tenant.id);
    parentSpan.setAttribute("consumerId", event.user.app_metadata.consumerId);

    const ageCheck =
      event.secrets.AGE_CHECK && event.secrets.AGE_CHECK === "true";
    const requiredFieldsCheck =
      event.secrets.REQUIRED_FIELDS_CHECK &&
      event.secrets.REQUIRED_FIELDS_CHECK === "true";

    // Collect all fields from the request body
    const allFields = Object.keys(event.request.body);

    const m2mClients = [
      event.secrets.M2M_CLIENT_ID_1,
      event.secrets.DI_M2M_CLIENT_1,
      event.secrets.DI_M2M_CLIENT_2,
    ];

    const requiredFields = ["ulp-first-name", "ulp-last-name", "ulp-gender"];

    if (m2mClients.includes(event.client.client_id)) {
      log("info", "Client is M2M. Skipping ValidateREgistrationFields action.");
      parentSpan.addEvent("info", {
        description:
          "Client is M2M. Skipping ValidateREgistrationFields action.",
        clientId: event.client.client_id,
      });
      parentSpan.setStatus({
        code: SpanStatusCode.OK,
        message: "Client is M2M. Skipping ValidateREgistrationFields action.",
      });
      await flushOtel(provider);
      parentSpan.end();
      log("info", "End.");
      return;
    }

    // validate email

    const email = event.user.email;
    const emailValidationResult = secureEmailValidator.safeParse(email);
    if (!emailValidationResult.success) {
      const issues = emailValidationResult.error.issues
        .map((i) => i.message)
        .join("; ");
      const errorMessage = `Invalid or unsafe email detected: ${issues}`;
      log("error", errorMessage);
      parentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });
      parentSpan.addEvent("error", {
        operation: "email validation",
        description: errorMessage,
      });
      await flushOtel(provider);
      parentSpan.end();
      return api.access.deny(
        "Invalid email provided.",
        "Please provide a valid and secure email address.",
      );
    }
    log("info", "Email is valid and safe.");

    // Check for required fields
    if (requiredFieldsCheck) {
      parentSpan.addEvent("info", {
        operation: "required fields check",
        description: `Checking required fields.`,
      });

      // Build schema
      const schema = buildSchema(requiredFields, allFields);
      // Validate
      const parseResult = schema.safeParse(event.request.body);

      if (!parseResult.success) {
        // Only log field names and error messages, not values
        const issues = parseResult.error.issues.map(
          (i) => `${i.path[0]}: ${i.message}`,
        );
        log("error", `Validation failed: ${issues.join("; ")}`);
        parentSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: `Registration failed due to invalid or unsafe input. Fields: ${issues.join("; ")}`,
        });
        await flushOtel(provider);
        parentSpan.end();
        return api.access.deny(
          "Registration failed due to invalid or unsafe input.",
          "Une erreur s'est produite, veuillez réessayer plus tard",
        );
      }

      log("info", "All required fields are present and safe.");
      parentSpan.addEvent("info", {
        operation: "required fields check",
        message: `All required fields are present.`,
      });
    }
    // UnderAge Guard
    if (ageCheck) {
      // Validate birth date
      const birthDate = new Date(event.request.body["ulp-birth-date"]);
      if (isNaN(birthDate.getTime())) {
        log("info", "Invalid birth date. Denying access.");
        parentSpan.recordException("Invalid birth date");
        parentSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: "Invalid birth date",
        });
        await flushOtel(provider);
        parentSpan.end();

        return api.access.deny(
          "invalid or NaN birthday entered",
          "The date of birth is invalid.",
        );
      }

      // Calculate age
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      // Check age
      if (age < 18) {
        log("info", "User is underage. Denying access.");
        parentSpan.addEvent("info", {
          operation: "underage check",
          description: `User is underage. Denying access. age: ${age}`,
        });
        parentSpan.setStatus({
          code: SpanStatusCode.OK,
          message: `User is underage. Denying access. age: ${age}`,
        });
        await flushOtel(provider);
        parentSpan.end();
        return api.access.deny(
          `User is underage. Denying access. age: ${age}`,
          "You must be over 18 years old.",
        );
      } else {
        log("info", "User is of age. Allowing access.");
        parentSpan.addEvent("info", {
          operation: "underage check",
          description: `User is of age. Allowing access. age: ${age}`,
        });
        parentSpan.setStatus({
          code: SpanStatusCode.OK,
          message: `User is of age. Allowing access. age: ${age}`,
        });
      }
    }

    await flushOtel(provider);
    parentSpan.end();
    log("info", "End.");
  });
};

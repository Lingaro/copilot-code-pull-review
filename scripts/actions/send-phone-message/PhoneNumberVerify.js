const axios = require("axios");
const twilio = require("twilio");
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
 * Writes structured logs with a shared action prefix.
 *
 * @param {"info"|"warn"|"error"|"debug"} level - Console log level.
 * @param {string} message - Message to log.
 */

function log(level, message) {
  const logPrefix = "[PhoneNumberVerify - Action]:";
  console[`${level}`](`${logPrefix} ${message}`);
}

/**
 * Initializes OpenTelemetry tracing and returns a tracer instance.
 *
 * @param {string} otlpExporterUrl - OTLP exporter endpoint.
 * @returns {import("@opentelemetry/api").Tracer} Configured tracer.
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
      "auth0-send-phone-message-PhoneNumberVerify",
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
 * Builds the Twilio Lookup fields query from enabled validation flags.
 *
 * @param {Object} validationParams - Runtime validation configuration.
 * @returns {string} Comma-separated Twilio lookup fields. [e.g., "line_type_intelligence,sms_pumping_risk"]
 */
function createLookupQuery(validationParams) {
  const twilioLookupQueryMapping = {
    blockVoIPNumbers: "line_type_intelligence",
    blockSMSPumpingAttacks: "sms_pumping_risk",
  };

  const fields = Object.entries(validationParams)
    .filter(([key, value]) => twilioLookupQueryMapping[key] && value)
    .map(([key]) => twilioLookupQueryMapping[key])
    .join(",");

  return fields;
}

/**
 * Obfuscates a phone number for logs by keeping only the last 4 digits.
 *
 * @param {string} phoneNumber - Raw phone number.
 * @returns {string} Obfuscated phone representation.
 */
function obfuscatePhoneNumber(phoneNumber) {
  if (!phoneNumber || phoneNumber.length < 4) {
    return "****";
  }
  const visibleDigits = phoneNumber.slice(-4);
  return "****" + visibleDigits;
}

/**
 * Evaluates whether Twilio's SMS pumping risk score exceeds the configured threshold.
 *
 * @param {Object} riskScore - Twilio risk object that contains sms_pumping_risk_score.
 * @param {"low"|"mild"|"moderate"|"high"} threshold - Business threshold level.
 * @returns {boolean} True if score is equal or above the threshold.
 */
function isPumpingRiskDetected(riskScore, threshold) {
  const riskLevel = {
    low: [0, 59],
    mild: [60, 75],
    moderate: [76, 90],
    high: [91, 100],
  };

  if (!riskScore || typeof riskScore.sms_pumping_risk_score !== "number") {
    log(
      "warn",
      "SMS pumping risk score is missing or invalid in Twilio response",
    );
    throw new Error("SMS pumping risk score is missing or invalid");
  }

  if (!threshold || !riskLevel[threshold]) {
    throw new Error(`Invalid SMS pumping risk threshold: ${threshold}`);
  }

  const numericThreshold = riskLevel[threshold]?.[0] || 61;
  return riskScore.sms_pumping_risk_score >= numericThreshold;
}

/**
 * Applies phone validation rules (prefix allowlist, VoIP filtering, SMS pumping risk check)
 * using Twilio Lookup.
 *
 * @param {{prefix: string, phoneNumber: string}} phoneNumberData - Parsed phone data.
 * @param {{account_sid: string, auth_token: string}} TwilioCreds - Twilio credentials.
 * @param {Object} validationParams - Validation feature flags and thresholds.
 * @returns {Promise<{validationSkipped: boolean, status: string, lookupResult: Object|string}>}
 * Validation result payload for tracing/logging.
 */
async function filterInvalidPhoneNumbers(
  phoneNumberData,
  TwilioCreds,
  validationParams = {
    allowAllPrefixes: true,
    allowedPrefixes: [],
    blockVoIPNumbers: false,
    blockSMSPumpingAttacks: false,
    sms_pumping_risk_threshold: "high",
  },
) {
  const client = twilio(TwilioCreds.account_sid, TwilioCreds.auth_token);

  if (!phoneNumberData?.prefix || !phoneNumberData?.phoneNumber) {
    log("error", "Phone number is missing for validation");
    throw new Error("Phone number is required for validation");
  }

  const phonePrefix = phoneNumberData.prefix;
  const fullPhoneNumber = phoneNumberData.prefix + phoneNumberData.phoneNumber;

  const isPhoneNumberPrefixAllowed = validationParams?.allowedPrefixes.some(
    (prefix) => phonePrefix === prefix,
  );
  if (!validationParams.allowAllPrefixes && !isPhoneNumberPrefixAllowed) {
    log("info", `Phone number rejected: does not start with an allowed prefix`);
    throw new Error("Phone number prefix not allowed");
  }

  if (
    !validationParams.blockVoIPNumbers &&
    !validationParams.blockSMSPumpingAttacks
  ) {
    log(
      "info",
      "Skipping Twilio lookup as both VoIP and SMS pumping attack checks are disabled",
    );
    return {
      validationSkipped: true,
      status: "Both VoIP and SMS pumping attack checks are disabled",
      lookupResult: "N/A",
    };
  }

  let lookupResponse = await client.lookups.v2
    .phoneNumbers(fullPhoneNumber)
    .fetch({ fields: createLookupQuery(validationParams) });

  const {
    nationalFormat: _nf,
    _version,
    _solution,
    url,
    ...filteredResponse
  } = Object.fromEntries(Object.entries(lookupResponse));

  log(
    "info",
    `Filtered lookup response for logging: ${JSON.stringify(obfuscatePhoneNumberInResponse(filteredResponse))}`,
  );

  if (
    validationParams.blockVoIPNumbers &&
    lookupResponse?.lineTypeIntelligence?.type !== "mobile"
  ) {
    log("info", "Phone number rejected: not a mobile number");
    throw new Error("VoIP or landline number");
  }

  if (
    validationParams.blockSMSPumpingAttacks &&
    isPumpingRiskDetected(
      lookupResponse?.smsPumpingRisk,
      validationParams.sms_pumping_risk_threshold,
    )
  ) {
    log("info", "Phone number rejected: high risk of SMS pumping attack");
    throw new Error("High risk of SMS pumping attack");
  }

  return {
    validationSkipped: false,
    lookupResult: filteredResponse,
    status: "Phone number passed all validation checks",
  };
}

/**
 * Calls the CIAM connector to verify whether the phone number is already in use.
 *
 * @param {{prefix: string, phoneNumber: string}} phoneNumberData - Parsed phone details.
 * @param {Object} user - Auth0 user profile.
 * @param {Object} secrets - Action secrets used for connector authentication.
 * @returns {Promise<{phoneExists: boolean, responseData: Object}>} Connector uniqueness result.
 */
async function checkIfPhoneNumberExists(phoneNumberData, user, secrets) {
  const options = {
    method: "POST",
    url: secrets.CIAM_CONNECTOR_URL,
    headers: {
      access_token: secrets.ACCESS_TOKEN,
      "Content-Type": "application/json",
    },
    data: JSON.stringify({
      mpn: user.app_metadata.mpid,
      sourceId: user.app_metadata.sourceId,
      countryCode: secrets.COUNTRY_CODE,
      consumerId: user.app_metadata.consumerId,
      phoneNumberPrefix: phoneNumberData.prefix,
      phoneNumber: phoneNumberData.phoneNumber,
      domain: secrets.DOMAIN,
      userId: user.user_id,
      region: secrets.REGION,
    }),
  };

  try {
    const response = await axios(options);
    if (response.status !== 200) {
      log(
        "error",
        `CIAM connector call return: ${JSON.stringify(response.data)}`,
      );
      throw new Error(
        `uniqueness check failed with error: ${JSON.stringify(response.data) || "Unknown error"}`,
      );
    }
    return {
      phoneExists: response.data.isExists,
      responseData: response.data,
    };
  } catch (error) {
    log("error", `Error during phone uniqueness check: ${error.message}`);
    throw new Error(`Phone uniqueness check failed: ${error.message}`);
  }
}

// Removes raw phoneNumber from lookup payload before logs/spans.
function obfuscatePhoneNumberInResponse(response) {
  if (!response || typeof response !== "object") {
    return response;
  }

  const { phoneNumber, ...filteredResponse } = response;
  return filteredResponse;
}

/**
 * Auth0 Action entrypoint for Send Phone Message flow.
 *
 * Runs fraud checks against the target phone number and optionally enforces
 * cross-user phone uniqueness via the CIAM connector.
 *
 * @param {Event} event - Auth0 action event payload.
 * @param {SendPhoneMessageAPI} api - Auth0 action API object.
 * @returns {Promise<void>}
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
  const { tracer, provider } = initOtel(event.secrets?.OTLP_EXPORTER_url);

  const fraudValidationParams = {
    allowAllPrefixes: event.secrets.ALLOW_ALL_PREFIXES === "true",
    allowedPrefixes: JSON.parse(event.secrets.ALLOWED_PREFIXES),
    blockVoIPNumbers: event.secrets.BLOCK_VOIP_NUMBERS === "true",
    blockSMSPumpingAttacks: event.secrets.BLOCK_SMS_PUMPING_ATTACKS === "true",
    sms_pumping_risk_threshold: event.secrets.SMS_PUMPING_RISK_THRESHOLD,
  };

  const TwilioCreds = {
    account_sid: event.secrets.ACCOUNT_SID,
    auth_token: event.secrets.AUTH_TOKEN,
  };

  const formattedPhoneNumber = event.message_options.recipient.split(" ");
  const phoneNumberData = {
    prefix: formattedPhoneNumber[0],
    phoneNumber: formattedPhoneNumber[1],
  };
  const phoneNumber = phoneNumberData.phoneNumber;
  const fullPhoneNumber = phoneNumberData.prefix + phoneNumberData.phoneNumber;

  const TEN_MINUTES = 60 * 10 * 1000;
  const cacheKey = `twilio_lookup_${fullPhoneNumber}`;

  const phoneUniquenessCheckEnabled =
    event.secrets.PHONE_UNIQUENESS_CHECK_ENABLED === "true";
  const whitelist = JSON.parse(
    event.secrets.PHONE_UNIQUENESS_WHITELIST || "[]",
  );

  const spanAttributes = {
    tenantName: event.tenant.id,
    user_id: event.user.user_id,
    consumerId: event.user.app_metadata?.consumerId || "N/A",
    sourceId: event.user.app_metadata?.sourceId || "N/A",
    mpid: event.user.app_metadata?.mpid || "N/A",
    block_voip_numbers: fraudValidationParams.blockVoIPNumbers,
    block_sms_pumping_attacks: fraudValidationParams.blockSMSPumpingAttacks,
    allow_all_prefixes: fraudValidationParams.allowAllPrefixes,
    allowed_prefixes: JSON.stringify(fraudValidationParams.allowedPrefixes),
    sms_pumping_risk_threshold:
      fraudValidationParams.sms_pumping_risk_threshold,
  };

  return tracer.startActiveSpan(
    "PhoneNumberVerify",
    { attributes: spanAttributes },
    async (parentSpan) => {
      try {
        log("info", "Start.");
        log(
          "info",
          parentSpan
            ? `Trace ID: ${parentSpan.spanContext().traceId}`
            : "Failed to retrieve the current span",
        );
        if (
          event.user?.multifactor &&
          event.user?.multifactor?.includes("guardian")
        ) {
          log(
            "info",
            "User already enrolled in multifactor authentication. Skipping phone uniqueness check.",
          );
          parentSpan.addEvent("skipped_uniqueness_check");
          parentSpan.setStatus({
            code: SpanStatusCode.OK,
            message:
              "Skipped phone verification check for guardian-enrolled user",
          });

          let cachedData = (await api.cache.get(cacheKey))?.value;
          let filterResult;
          if (!cachedData) {
            log(
              "info",
              `No cache found. Performing Twilio lookup for phone number ending in ${obfuscatePhoneNumber(phoneNumber)}`,
            );

            filterResult = await filterInvalidPhoneNumbers(
              phoneNumberData,
              TwilioCreds,
              fraudValidationParams,
            );
            await api.cache.set(cacheKey, JSON.stringify(filterResult), {
              ttl: TEN_MINUTES,
            });
            parentSpan.addEvent("twilio_lookup_cache_miss", {
              prefix: phoneNumberData.prefix,
              phoneNumber: obfuscatePhoneNumber(phoneNumber),
              source: "api_call_initiated",
              lookupResult: JSON.stringify(
                obfuscatePhoneNumberInResponse(filterResult.lookupResult),
              ),
            });
            return;
          }

          filterResult = JSON.parse(cachedData);
          log(
            "info",
            `Using cached Twilio lookup result for phone number ending in ${obfuscatePhoneNumber(phoneNumber)}, cached data ${JSON.stringify(obfuscatePhoneNumberInResponse(filterResult.lookupResult))}`,
          );
          parentSpan.addEvent("twilio_lookup_cache_hit", {
            prefix: phoneNumberData.prefix,
            phoneNumber: obfuscatePhoneNumber(phoneNumber),
            source: "cache",
            lookupResult: JSON.stringify(
              obfuscatePhoneNumberInResponse(filterResult.lookupResult),
            ),
          });
          return;
        }

        let cachedData = (await api.cache.get(cacheKey))?.value;
        let filterResult = cachedData ? JSON.parse(cachedData) : null;
        let cacheHit = false;

        if (filterResult) {
          log(
            "info",
            `Using cached Twilio lookup result for phone number ending in ${obfuscatePhoneNumber(phoneNumber)}`,
          );
          cacheHit = true;
          parentSpan.addEvent("twilio_lookup_cache_hit", {
            prefix: phoneNumberData.prefix,
            phoneNumber: obfuscatePhoneNumber(phoneNumber),
            source: "cache",
            validationSkipped: filterResult.validationSkipped,
            status: filterResult.status,
          });
        } else {
          log(
            "info",
            `No cache found. Performing Twilio lookup for phone number ending in ${obfuscatePhoneNumber(phoneNumber)}`,
          );
          parentSpan.addEvent("twilio_lookup_cache_miss", {
            prefix: phoneNumberData.prefix,
            phoneNumber: obfuscatePhoneNumber(phoneNumber),
            source: "api_call_initiated",
          });

          filterResult = await filterInvalidPhoneNumbers(
            phoneNumberData,
            TwilioCreds,
            fraudValidationParams,
          );

          await api.cache.set(cacheKey, JSON.stringify(filterResult), {
            ttl: TEN_MINUTES,
          });
          log(
            "info",
            `Twilio lookup result cached for phone number ending in ${obfuscatePhoneNumber(phoneNumber)}`,
          );

          parentSpan.addEvent("twilio_lookup_completed", {
            prefix: phoneNumberData.prefix,
            phoneNumber: obfuscatePhoneNumber(phoneNumber),
            source: "twilio_api",
            validationSkipped: filterResult.validationSkipped,
            status: filterResult.status,
            lookupResult: JSON.stringify(
              obfuscatePhoneNumberInResponse(filterResult.lookupResult),
            ),
            cached: true,
          });
        }

        parentSpan.addEvent("phone_number_validation_result", {
          prefix: phoneNumberData.prefix,
          phoneNumber: obfuscatePhoneNumber(phoneNumber),
          validationSkipped: filterResult.validationSkipped,
          status: filterResult.status,
          cacheHit: cacheHit,
        });

        if (!phoneUniquenessCheckEnabled) {
          log("info", "Phone uniqueness check is disabled. Skipping check.");
          parentSpan.addEvent("phone_uniqueness_check_disabled", {
            prefix: phoneNumberData.prefix,
            phoneNumber: obfuscatePhoneNumber(phoneNumber),
            uniquenessCheckFlag: event.secrets.PHONE_UNIQUENESS_CHECK_ENABLED,
          });
        } else {
          if (
            Array.isArray(whitelist) &&
            whitelist.some((phoneNumber) => phoneNumber === fullPhoneNumber)
          ) {
            log(
              "info",
              "Skipping uniqueness check for the phone number because it is whitelisted",
            );
            parentSpan.addEvent("uniqueness_check_skipped_whitelisted");
            parentSpan.setStatus({
              code: SpanStatusCode.OK,
              message: "Uniqueness check skipped for whitelisted number",
            });
            return;
          }

          const { phoneExists, responseData } = await checkIfPhoneNumberExists(
            phoneNumberData,
            event.user,
            event.secrets,
          );
          parentSpan.addEvent("uniqueness_checked", {
            phoneExists,
            responseData: JSON.stringify(responseData),
          });

          if (phoneExists) {
            log(
              "info",
              "Phone number already exists in CIAM system. Rejecting authentication attempt.",
            );
            throw new Error("Phone number already in use");
          }
        }
      } catch (error) {
        log(
          "error",
          `Phone Number Verification Error: ${error.message || error}`,
        );
        parentSpan.recordException(error);
        parentSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: `Phone Number Verification Error: ${error.message || error}`,
        });
        throw error;
      } finally {
        await flushOtel(provider);
        parentSpan.end();
      }
    },
  );
};

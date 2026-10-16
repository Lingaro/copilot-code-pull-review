const { onExecutePostLogin } = require("./SendOktaUserId");
const axios = require("axios");

// Mock dependencies
jest.mock("axios", () => jest.fn());

jest.mock("@opentelemetry/api", () => ({
  ...jest.requireActual("@opentelemetry/api"),
  trace: {
    getTracer: jest.fn(() => ({
      startActiveSpan: jest.fn((name, options, fn) => {
        if (typeof options === "function") {
          return options(mockSpan);
        }
        return fn(mockSpan);
      }),
    })),
  },
  SpanStatusCode: {
    OK: 1,
    ERROR: 2,
  },
}));

const mockSpan = {
  setAttribute: jest.fn(),
  addEvent: jest.fn(),
  setStatus: jest.fn(),
  recordException: jest.fn(),
  end: jest.fn(),
  spanContext: jest.fn(() => ({ traceId: "mock-trace-id" })),
};

const mockApi = {
  access: {
    deny: jest.fn(),
  },
  user: {
    setAppMetadata: jest.fn(),
  },
};

describe("SendOktaUserId Action", () => {
  beforeEach(() => {
    // Clear mock call history
    jest.clearAllMocks();
    axios.mockResolvedValue({ status: 200, data: { success: true } });
  });

  // Test Case 1: Skip when orchestrator doesn't flag for Okta ID dispatch
  it("should skip execution when orchestrator doesn't flag for Okta ID dispatch", async () => {
    const event = {
      user: {
        user_id: "google-oauth2|123456",
        app_metadata: {
          consumerId: "okta_123",
          mpid: "MP123",
          sourceId: "SRC123",
          flow: {
            tasks: {
              needs_okta_id_dispatch: false, // Not flagged
            },
          },
        },
      },
      client: {
        metadata: {
          region: "US",
        },
      },
      secrets: {
        OTLP_EXPORTER_url: "http://otel.example.com",
        CGW_USERID_API_URL: "https://cgw.example.com/userid",
        API_KEY: "api-key-123",
      },
      tenant: { id: "test-tenant" },
    };

    await onExecutePostLogin(event, mockApi);

    expect(mockSpan.addEvent).toHaveBeenCalledWith(
      "skipped_by_orchestrator_task_flag",
    );
    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: 1, // SpanStatusCode.OK
      message: "Task not required by orchestrator.",
    });
    expect(axios).not.toHaveBeenCalled();
    expect(mockApi.user.setAppMetadata).not.toHaveBeenCalled();
  });

  // Test Case 2: Skip when flow metadata is missing
  it("should skip execution when flow metadata is completely missing", async () => {
    const event = {
      user: {
        user_id: "google-oauth2|123456",
        app_metadata: {
          consumerId: "okta_123",
          mpid: "MP123",
          sourceId: "SRC123",
          oktauseridInCDP: "true",
          // No flow metadata
        },
      },
      client: {
        metadata: {
          region: "US",
        },
      },
      secrets: {
        OTLP_EXPORTER_url: "http://otel.example.com",
        CGW_USERID_API_URL: "https://cgw.example.com/userid",
        API_KEY: "api-key-123",
      },
      tenant: { id: "test-tenant" },
    };

    await onExecutePostLogin(event, mockApi);

    expect(mockSpan.addEvent).toHaveBeenCalledWith(
      "skipped_by_orchestrator_task_flag",
    );
    expect(axios).not.toHaveBeenCalled();
  });

  // Test Case 3: Successfully send Okta User ID to CGW
  it("should successfully send Okta User ID to CGW", async () => {
    const event = {
      user: {
        user_id: "google-oauth2|success123",
        app_metadata: {
          consumerId: "okta_success-123",
          mpid: "MP123456",
          sourceId: "SRC789",
          flow: {
            tasks: {
              needs_okta_id_dispatch: true,
            },
          },
        },
      },
      client: {
        metadata: {
          region: "US",
        },
      },
      secrets: {
        OTLP_EXPORTER_url: "http://otel.example.com",
        CGW_USERID_API_URL: "https://cgw.example.com/userid",
        API_KEY: "api-key-123",
      },
      tenant: { id: "test-tenant" },
    };

    axios.mockResolvedValueOnce({ status: 200, data: { success: true } });

    await onExecutePostLogin(event, mockApi);

    expect(axios).toHaveBeenCalledWith({
      method: "PUT",
      url: "https://cgw.example.com/userid",
      headers: {
        "X-Api-Key": "api-key-123",
        "Content-Type": "application/json",
        consumerid: "okta_success-123",
        sourceId: "SRC789",
        mpn: "MP123456",
        region: "US",
        oktauserid: "google-oauth2|success123",
      },
      data: {},
    });

    expect(mockApi.user.setAppMetadata).toHaveBeenCalledWith(
      "oktauseridInCDP",
      true,
    );
    expect(mockSpan.addEvent).toHaveBeenCalledWith("dispatch_succeeded", {
      response_status: 200,
    });
    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: 1, // SpanStatusCode.OK
      message: "Okta User ID sent successfully.",
    });
  });

  // Test Case 4: Handle API failure with graceful degradation
  it("should handle API failure with graceful degradation", async () => {
    const event = {
      user: {
        user_id: "apple|failure555",
        app_metadata: {
          consumerId: "okta_failure-555",
          mpid: "MP777777",
          sourceId: "SRC777",
          flow: {
            tasks: {
              needs_okta_id_dispatch: true,
            },
          },
        },
      },
      client: {
        metadata: {
          region: "CA",
        },
      },
      secrets: {
        OTLP_EXPORTER_url: "http://otel.example.com",
        CGW_USERID_API_URL: "https://cgw.example.com/userid",
        API_KEY: "api-key-777",
      },
      tenant: { id: "test-tenant" },
    };

    // Mock API failure
    const apiError = new Error("CGW API unavailable");
    apiError.response = {
      status: 500,
      data: {
        errorCode: "500",
        errorMessage: "Internal Server Error",
        errorDetails: "Service temporarily unavailable",
      },
    };
    axios.mockRejectedValueOnce(apiError);

    await onExecutePostLogin(event, mockApi);

    expect(axios).toHaveBeenCalled();
    expect(mockApi.user.setAppMetadata).not.toHaveBeenCalledWith(
      "oktauseridInCDP",
      true,
    );
    expect(mockSpan.recordException).toHaveBeenCalled();
    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: 2, // SpanStatusCode.ERROR
      message: "Internal Server Error: Service temporarily unavailable",
    });
  });

  // Test Case 6: Handle partial metadata gracefully
  it("should handle partial metadata gracefully", async () => {
    const event = {
      user: {
        user_id: "google-oauth2|partial123",
        app_metadata: {
          consumerId: "okta_partial-123",
          // mpid and sourceId missing
          flow: {
            tasks: {
              needs_okta_id_dispatch: true,
            },
          },
        },
      },
      client: {
        metadata: {
          // region missing
        },
      },
      secrets: {
        OTLP_EXPORTER_url: "http://otel.example.com",
        CGW_USERID_API_URL: "https://cgw.example.com/userid",
        API_KEY: "api-key-partial",
      },
      tenant: { id: "test-tenant" },
    };

    await onExecutePostLogin(event, mockApi);

    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          consumerid: "okta_partial-123",
          sourceId: undefined,
          mpn: undefined,
          region: undefined,
          oktauserid: "google-oauth2|partial123",
        }),
      }),
    );

    expect(mockApi.user.setAppMetadata).toHaveBeenCalledWith(
      "oktauseridInCDP",
      true,
    );
  });

  // Test Case 7: Handle missing client metadata completely
  it("should handle completely missing client metadata", async () => {
    const event = {
      user: {
        user_id: "google-oauth2|noclient123",
        app_metadata: {
          consumerId: "okta_noclient-123",
          mpid: "MP111111",
          sourceId: "SRC111",
          flow: {
            tasks: {
              needs_okta_id_dispatch: true,
            },
          },
        },
      },
      client: {
        // metadata property missing completely
      },
      secrets: {
        OTLP_EXPORTER_url: "http://otel.example.com",
        CGW_USERID_API_URL: "https://cgw.example.com/userid",
        API_KEY: "api-key-noclient",
      },
      tenant: { id: "test-tenant" },
    };

    await onExecutePostLogin(event, mockApi);

    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          region: undefined,
        }),
      }),
    );

    expect(mockApi.user.setAppMetadata).toHaveBeenCalledWith(
      "oktauseridInCDP",
      true,
    );
  });

  // Test Case 8: Verify span attributes and lifecycle
  it("should set span attributes correctly and end span", async () => {
    const event = {
      user: {
        user_id: "google-oauth2|span-test",
        app_metadata: {
          consumerId: "okta_span-123",
          mpid: "MP999",
          sourceId: "SRC999",
          flow: {
            tasks: {
              needs_okta_id_dispatch: true,
            },
          },
        },
      },
      client: {
        metadata: {
          region: "AU",
        },
      },
      secrets: {
        OTLP_EXPORTER_url: "http://otel.example.com",
        CGW_USERID_API_URL: "https://cgw.example.com/userid",
        API_KEY: "api-key-span",
      },
      tenant: { id: "span-tenant" },
    };

    await onExecutePostLogin(event, mockApi);

    expect(mockSpan.end).toHaveBeenCalled();
  });
});

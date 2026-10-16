const { onExecutePreUserRegistration } = require("./AddAppMetadata");
const { v4: uuidv4 } = require("uuid");
const { api, event } = require("auth0");

jest.mock("@opentelemetry/api", () => ({
  ...jest.requireActual("@opentelemetry/api"),
}));

describe("onExecutePreUserRegistration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    event.secrets = {
      OTLP_EXPORTER_url: "testOtlpUrl",
    };
  });

  it("sets app metadata correctly", async () => {
    uuidv4.mockReturnValueOnce("test-uuid");

    await onExecutePreUserRegistration(event, api);

    expect(api.user.setAppMetadata).toHaveBeenCalledWith("mpid", "testMpid");
    expect(api.user.setAppMetadata).toHaveBeenCalledWith(
      "sourceId",
      "testSourceId",
    );
    expect(api.user.setAppMetadata).toHaveBeenCalledWith(
      "consumerId",
      "okta_test-uuid",
    );
  });
});

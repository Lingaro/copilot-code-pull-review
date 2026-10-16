const { onExecutePostLogin } = require("./AddCustomClaims");
const { api, event } = require("auth0");

jest.mock("@opentelemetry/api", () => ({
  ...jest.requireActual("@opentelemetry/api"),
}));

describe("AddCustomClaims", () => {
  beforeEach(() => {
    event.user = {
      app_metadata: {
        mpid: "12345",
        sourceId: "source-1",
        consumerId: "consumer-1",
        akamaiLegacyId: "akamai-123",
      },
    };
    event.client = {
      metadata: {
        region: "us-west-1",
      },
    };
  });
  it("should add custom claims to the access token", () => {
    onExecutePostLogin(event, api);

    expect(api.accessToken.setCustomClaim).toHaveBeenCalledWith(
      "mpid",
      "12345",
    );
    expect(api.accessToken.setCustomClaim).toHaveBeenCalledWith(
      "sourceId",
      "source-1",
    );
    expect(api.accessToken.setCustomClaim).toHaveBeenCalledWith(
      "consumerId",
      "consumer-1",
    );
  });
});

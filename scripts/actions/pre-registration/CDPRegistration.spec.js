const axios = require("axios");
const { onExecutePreUserRegistration } = require("./CDPRegistration");
const { api, event } = require("auth0");

jest.mock("axios", () => jest.fn());
jest.mock("@opentelemetry/api", () => ({
  ...jest.requireActual("@opentelemetry/api"),
}));

describe("CDPRegistration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    event.user = {
      app_metadata: {
        cdpRegistrationSocial: false,
        sourceId: "testSourceId",
        consumerId: "testConsumerId",
        mpid: "testMpid",
      },
      email: "example@example.com",
    };
    event.secrets = {
      LEAD_ADS_CLIENT_1: "testLeadAdsClientId",
    };
  });
  describe("should call CGW", () => {
    it("with correct data", async () => {
      axios.mockResolvedValueOnce({ status: 200, data: {} });
      await onExecutePreUserRegistration(event, api);
      expect(axios).toHaveBeenCalledTimes(1);
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: event.secrets.CGW_REGISTRATION_API_URL, //TODO: adjust link for production
          headers: {
            "X-Api-Key": event.secrets.API_KEY,
            "Content-Type": "application/json",
            consumerid: event.user.app_metadata.consumerId,
            sourceId: event.user.app_metadata.sourceId,
            mpn: event.user.app_metadata.mpid,
            region: event.client.metadata.region,
          },
        }),
      );
    });
  });
  describe("when call to CGW fails", () => {
    it("should deny registration", async () => {
      axios.mockRejectedValueOnce({
        response: { status: 400, data: { message: "error" } },
      });
      await onExecutePreUserRegistration(event, api);
      expect(api.access.deny).toHaveBeenCalledTimes(1);
    });
    it("should throw error when status is not 200", async () => {
      axios.mockRejectedValueOnce({
        response: { status: 400, data: { message: "error" } },
      });
      await onExecutePreUserRegistration(event, api);
      expect(api.access.deny).toHaveBeenCalledTimes(1);
    });
  });
});

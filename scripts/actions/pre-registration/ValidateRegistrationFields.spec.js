const {
  onExecutePreUserRegistration,
} = require("./ValidateRegistrationFields");

const { api, event } = require("auth0");

jest.mock("@opentelemetry/api", () => ({
  ...jest.requireActual("@opentelemetry/api"),
}));

describe("onExecutePreUserRegistration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    event.user.app_metadata = {
      consumerId: "testConsumerId",
    };
    event.secrets = {
      AGE_CHECK: "true",
      REQUIRED_FIELDS_CHECK: "true",
      M2M_CLIENT_ID_1: "testM2mClientId",
    };
    event.client = {
      client_id: "testClientId",
    };
  });

  it("denies registration if user is under 18", async () => {
    event.request.body = {
      "ulp-first-name": "John",
      "ulp-last-name": "Doe",
      "ulp-gender": "M",
      "ulp-birth-date": new Date().toISOString().split("T")[0],
    };

    await onExecutePreUserRegistration(event, api);
    expect(api.access.deny).toHaveBeenCalled();
  });

  it("allows registration if user is 18 or older", async () => {
    event.request.body = {
      "ulp-first-name": "John",
      "ulp-last-name": "Doe",
      "ulp-gender": "M",
      "ulp-birth-date": "2000-01-01",
    };
    await onExecutePreUserRegistration(event, api);
    expect(api.access.deny).toHaveBeenCalledTimes(0);
  });

  it("allows registration if no required fields are missing", async () => {
    event.request.body = {
      "ulp-first-name": "John",
      "ulp-last-name": "Doe",
      "ulp-gender": "M",
      "ulp-birth-date": "2000-01-01",
    };
    await onExecutePreUserRegistration(event, api);
    expect(api.access.deny).toHaveBeenCalledTimes(0);
  });

  it("denies registration if required fields are missing", async () => {
    event.request.body = {
      "ulp-first-name": "John",
    };
    await onExecutePreUserRegistration(event, api);
    expect(api.access.deny).toHaveBeenCalled();
  });
});

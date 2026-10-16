const api = {
  user: {
    setAppMetadata: jest.fn(),
  },
  accessToken: {
    setCustomClaim: jest.fn(),
  },
  access: {
    deny: jest.fn(),
  },
  redirect: {
    sendUserTo: jest.fn(),
  },
};
const event = {
  stats: {
    logins_count: 1,
  },
  tenant: {
    id: 123,
  },
  client: {
    metadata: {
      mp_type: "testType",
      testType_mpid: "testMpid",
      testType_sourceId: "testSourceId",
      region: "testRegion",
    },
  },
  request: {
    body: {},
    query: {},
  },
  secrets: {
    API_KEY: "testApiKey",
    MAPP_GET_USER_API_URL: "https://api.example.com/getUser",
    MAPP_CREATE_USER_API_URL: "https://api.example.com/createUser",
    MAPP_SEND_EMAIL_API_URL: "testSendEmailApiUrl",
    MAPP_API_KEY: "testMappApiKey",
  },
  transaction: {
    requested_scopes: ["openid", "email"],
  },
  user: {
    email: "test@test.test",
    app_metadata: {
      mpid: "testMpid",
      sourceId: "testSourceId",
      consumerId: "testConsumerId",
    },
  },
  connection: {
    name: "con_test",
    strategy: "auth0",
  },
};

module.exports = { api, event };

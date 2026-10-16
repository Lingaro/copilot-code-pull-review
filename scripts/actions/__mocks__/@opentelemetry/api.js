module.exports = {
  SpanStatusCode: {
    OK: "OK",
    ERROR: "ERROR",
  },
};

module.exports = opentelemetry = {
  // trace: {
  //   getTracer: jest.fn(() => ({
  //     startActiveSpan: jest.fn(() => ({
  //       setAttribute: jest.fn(),
  //       end: jest.fn(),
  //     })),
  //   })),
  // },
  startActiveSpan: jest.fn(),
};

const startSpanMock = jest.fn();
const addSpanProcessorMock = jest.fn();

const mockSpan = {
  end: jest.fn(),
  setAttribute: jest.fn(),
};

module.exports = {
  NodeTracerProvider: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    startSpan: startSpanMock,
    addSpanProcessor: addSpanProcessorMock,
    getTracer: jest.fn().mockReturnValue({
      startSpan: jest.fn().mockReturnValue(mockSpan),
    }),
  })),
  BatchSpanProcessor: jest.fn(),
};

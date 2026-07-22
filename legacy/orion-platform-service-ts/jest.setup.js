// Set required environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';

// Use simulated K8s mode for tests (no real K8s cluster needed)
process.env.K8S_SIMULATE = 'true';

// Mock @kubernetes/client-node for tests
jest.mock('@kubernetes/client-node', () => {
  const mockKubeConfig = jest.fn().mockImplementation(() => ({
    loadFromCluster: jest.fn(),
    loadFromFile: jest.fn(),
    loadFromDefault: jest.fn(),
    makeApiClient: jest.fn().mockReturnValue({}),
  }));

  return {
    KubeConfig: mockKubeConfig,
    AppsV1Api: jest.fn(),
    CoreV1Api: jest.fn(),
    AutoscalingV2Api: jest.fn(),
  };
});

// Provide a global pino for modules that use it without importing
// (migration in progress: createLogger is the target, but many files still use bare pino())
if (typeof globalThis.pino === 'undefined') {
  const mockPinoFn = jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  }));
  globalThis.pino = mockPinoFn;
}

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

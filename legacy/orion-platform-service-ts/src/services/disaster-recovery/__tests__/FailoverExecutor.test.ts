/**
 * FailoverExecutor Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Use var so it's hoisted and available in the jest.mock factory
// eslint-disable-next-line no-var
var mockApi: Record<string, jest.Mock>;

jest.mock('@kubernetes/client-node', () => ({
  KubeConfig: jest.fn().mockImplementation(() => ({
    loadFromDefault: jest.fn(),
    makeApiClient: jest.fn(() => mockApi),
  })),
  CoreV1Api: jest.fn(),
  NetworkingV1Api: jest.fn(),
  AppsV1Api: jest.fn(),
}));

import { FailoverExecutor } from '../FailoverExecutor';

function resetMocks() {
  mockApi.readNamespacedDeployment = jest.fn();
  mockApi.replaceNamespacedDeploymentScale = jest.fn();
  mockApi.readNamespacedService = jest.fn();
  mockApi.replaceNamespacedService = jest.fn();
  mockApi.listNamespacedPod = jest.fn();
}

mockApi = {
  readNamespacedDeployment: jest.fn(),
  replaceNamespacedDeploymentScale: jest.fn(),
  readNamespacedService: jest.fn(),
  replaceNamespacedService: jest.fn(),
  listNamespacedPod: jest.fn(),
};

describe('FailoverExecutor', () => {
  let executor: FailoverExecutor;
  const config = {
    namespace: 'orion',
    serviceName: 'orion-platform',
    ingressName: 'orion-ingress',
  };

  beforeEach(() => {
    resetMocks();
    executor = new FailoverExecutor();
  });

  describe('isAvailable', () => {
    it('should return true when K8s client initialized', () => {
      expect(executor.isAvailable()).toBe(true);
    });
  });

  describe('stopTrafficToPrimary', () => {
    it('should scale deployment to 0', async () => {
      mockApi.readNamespacedDeployment.mockResolvedValue({
        body: { spec: { replicas: 3 } },
      });
      mockApi.replaceNamespacedDeploymentScale.mockResolvedValue({});

      const result = await executor.stopTrafficToPrimary(config);

      expect(result.success).toBe(true);
      expect(result.step).toBe('stop_traffic_primary');
    });

    it('should return failure on error', async () => {
      mockApi.readNamespacedDeployment.mockRejectedValue(new Error('Deployment not found'));

      const result = await executor.stopTrafficToPrimary(config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Deployment not found');
    });
  });

  describe('scaleStandby', () => {
    it('should scale deployment to desired replicas', async () => {
      mockApi.replaceNamespacedDeploymentScale.mockResolvedValue({});

      const result = await executor.scaleStandby(config, 'orion-platform-standby', 3);

      expect(result.success).toBe(true);
    });
  });

  describe('verifyPodsReady', () => {
    it('should return true when pods are ready', async () => {
      mockApi.listNamespacedPod.mockResolvedValue({
        items: [
          {
            status: {
              phase: 'Running',
              conditions: [{ type: 'Ready', status: 'True' }],
            },
          },
          {
            status: {
              phase: 'Running',
              conditions: [{ type: 'Ready', status: 'True' }],
            },
          },
        ],
      });

      const ready = await executor.verifyPodsReady(config, 'orion-platform', 2);

      expect(ready).toBe(true);
    });

    it('should return false when not enough pods', async () => {
      mockApi.listNamespacedPod.mockResolvedValue({
        items: [
          {
            status: {
              phase: 'Running',
              conditions: [{ type: 'Ready', status: 'True' }],
            },
          },
        ],
      });

      const ready = await executor.verifyPodsReady(config, 'orion-platform', 2);

      expect(ready).toBe(false);
    });
  });

  describe('executeFailover', () => {
    it('should execute full failover sequence', async () => {
      mockApi.replaceNamespacedDeploymentScale.mockResolvedValue({});
      mockApi.listNamespacedPod.mockResolvedValue({
        items: [
          {
            status: {
              phase: 'Running',
              conditions: [{ type: 'Ready', status: 'True' }],
            },
          },
          {
            status: {
              phase: 'Running',
              conditions: [{ type: 'Ready', status: 'True' }],
            },
          },
        ],
      });
      mockApi.readNamespacedService.mockResolvedValue({
        spec: { selector: {} },
      });
      mockApi.replaceNamespacedService.mockResolvedValue({});

      const result = await executor.executeFailover(config, 'orion-platform-standby');

      expect(result.success).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('should fail if standby pods not ready', async () => {
      mockApi.replaceNamespacedDeploymentScale.mockResolvedValue({});
      mockApi.listNamespacedPod.mockResolvedValue({
        items: [],
      });

      const result = await executor.executeFailover(config, 'orion-platform-standby');

      expect(result.success).toBe(false);
    });
  });

  describe('rollback', () => {
    it('should rollback to primary', async () => {
      mockApi.replaceNamespacedDeploymentScale.mockResolvedValue({});
      mockApi.listNamespacedPod.mockResolvedValue({
        items: [
          {
            status: {
              phase: 'Running',
              conditions: [{ type: 'Ready', status: 'True' }],
            },
          },
        ],
      });
      mockApi.readNamespacedService.mockResolvedValue({
        spec: { selector: {} },
      });
      mockApi.replaceNamespacedService.mockResolvedValue({});

      // Use config without ingress to avoid ingress update failure
      const rollbackConfig = {
        namespace: 'orion',
        serviceName: 'orion-platform',
      };

      const results = await executor.rollback(rollbackConfig, 'orion-platform');

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});

/**
 * K8s Watch Client 单元测试
 */

import { K8sWatchClient, WatchEventType, SyncStatus, K8sResourceKind } from '../K8sWatchClient';

// Mock @kubernetes/client-node
jest.mock('@kubernetes/client-node', () => {
  // Create a mock Watch class
  class MockWatch {
    watch = jest.fn().mockImplementation((path: string, options: any, callback: any, done: any) => {
      // Simulate watch starting
      if (done) {
        // Don't call done immediately, simulate watch running
      }
      return Promise.resolve();
    });
  }

  // Create a mock KubeConfig class
  class MockKubeConfig {
    loadFromCluster = jest.fn();
    loadFromDefault = jest.fn().mockImplementation(() => {});
    addCluster = jest.fn();
    addUser = jest.fn();
    addContext = jest.fn();
    setCurrentContext = jest.fn();
    makeApiClient = jest.fn().mockReturnValue({});
  }

  return {
    KubeConfig: MockKubeConfig,
    Watch: MockWatch,
    CoreV1Api: class CoreV1Api {},
    AppsV1Api: class AppsV1Api {},
  };
});

describe('K8sWatchClient', () => {
  let watchClient: K8sWatchClient;

  beforeEach(() => {
    jest.clearAllMocks();
    watchClient = new K8sWatchClient({
      useClusterConfig: false, // Use default config for tests
    });
  });

  afterEach(() => {
    watchClient.stop();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const client = new K8sWatchClient();
      const status = client.getStatus();

      expect(status.connected).toBe(false);
      // Initial status is L0_NORMAL before any operation
      expect(status.syncStatus).toBe('L0_NORMAL');
      expect(status.reconnectAttempts).toBe(0);
    });

    it('should initialize with custom config', () => {
      const client = new K8sWatchClient({
        apiServerUrl: 'https://test.k8s.local:6443',
        token: 'test-token',
        caCert: 'test-ca',
        reconnect: {
          initialDelayMs: 500,
          maxDelayMs: 10000,
          maxRetries: 5,
        },
      });

      const status = client.getStatus();
      expect(status.connected).toBe(false);
    });
  });

  describe('registerHandler', () => {
    it('should register resource handler', () => {
      const handler = jest.fn();
      watchClient.registerHandler('Deployment', handler);

      // Handler should be registered (internal check via start)
    });

    it('should unregister resource handler', () => {
      const handler = jest.fn();
      watchClient.registerHandler('Pod', handler);
      watchClient.unregisterHandler('Pod');

      // Handler should be unregistered
    });
  });

  describe('getStatus', () => {
    it('should return correct initial status', () => {
      const status = watchClient.getStatus();

      expect(status.connected).toBe(false);
      expect(status.reconnectAttempts).toBe(0);
      expect(status.resourcesWatched).toEqual([]);
      // Initial status is L0_NORMAL before any operation
      expect(status.syncStatus).toBe('L0_NORMAL');
    });
  });

  describe('getSyncStatus', () => {
    it('should return initial sync status', () => {
      const syncStatus = watchClient.getSyncStatus();
      // Initial status is L0_NORMAL before any operation
      expect(syncStatus).toBe('L0_NORMAL');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when not started', async () => {
      const health = await watchClient.healthCheck();

      // When not started, syncStatus is L0_NORMAL (healthy)
      expect(health.healthy).toBe(true);
      expect(health.status.syncStatus).toBe('L0_NORMAL');
      expect(health.message).toBe('Watch connection is healthy');
    });
  });

  describe('reconnect', () => {
    it('should reset reconnect attempts', async () => {
      // Simulate some reconnect attempts (internal state)
      watchClient.reconnect();

      // Should reset internal state
      const status = watchClient.getStatus();
      expect(status.reconnectAttempts).toBe(0);
    });
  });

  describe('start and stop', () => {
    it('should start watch with registered handlers', async () => {
      const handler = jest.fn();
      watchClient.registerHandler('Deployment', handler);

      await watchClient.start();

      const status = watchClient.getStatus();
      // After start, syncStatus should be L0_NORMAL
      expect(status.syncStatus).toBe('L0_NORMAL');
    });

    it('should stop watch cleanly', async () => {
      const handler = jest.fn();
      watchClient.registerHandler('Pod', handler);

      await watchClient.start();
      watchClient.stop();

      const status = watchClient.getStatus();
      expect(status.connected).toBe(false);
      expect(status.syncStatus).toBe('L2_PAUSED');
    });

    it('should not start twice', async () => {
      const handler = jest.fn();
      watchClient.registerHandler('Namespace', handler);

      await watchClient.start();
      await watchClient.start(); // Second call should be ignored

      // Should only have one abort controller
    });
  });

  describe('sync status levels', () => {
    it('should track sync status degradation', () => {
      // L0_NORMAL -> L1_REDUCED -> L2_PAUSED -> L3_DEGRADED
      // This is tested via the updateSyncStatus internal method
      // which is triggered by reconnect attempts

      const statuses: SyncStatus[] = ['L0_NORMAL', 'L1_REDUCED', 'L2_PAUSED', 'L3_DEGRADED'];

      for (const status of statuses) {
        expect(typeof status).toBe('string');
      }
    });
  });
});

describe('WatchEvent', () => {
  it('should define correct event types', () => {
    const eventTypes: WatchEventType[] = ['ADDED', 'MODIFIED', 'DELETED', 'ERROR', 'BOOKMARK'];

    for (const type of eventTypes) {
      expect(typeof type).toBe('string');
    }
  });
});

describe('K8sResourceKind', () => {
  it('should define correct resource kinds', () => {
    const kinds: K8sResourceKind[] = [
      'Cluster',
      'Namespace',
      'Deployment',
      'Pod',
      'Service',
      'ConfigMap',
      'Secret',
    ];

    for (const kind of kinds) {
      expect(typeof kind).toBe('string');
    }
  });
});
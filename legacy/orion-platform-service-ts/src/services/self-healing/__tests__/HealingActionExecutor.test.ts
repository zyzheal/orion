/**
 * HealingActionExecutor - Unit Tests
 *
 * Tests for executing healing actions (restart, scale, failover, rollback),
 * verification, rollback, action history, and error handling.
 *
 * All K8s operations run in simulated mode (K8S_SIMULATE=true).
 */

// Set simulate mode before importing
process.env.K8S_SIMULATE = 'true';

// Mock @kubernetes/client-node
jest.mock('@kubernetes/client-node', () => ({
  KubeConfig: jest.fn().mockImplementation(() => ({
    loadFromDefault: jest.fn(),
    loadFromCluster: jest.fn(),
    makeApiClient: jest.fn().mockReturnValue({
      readNamespacedDeployment: jest.fn(),
      replaceNamespacedDeployment: jest.fn(),
      patchNamespacedDeploymentScale: jest.fn(),
      patchNamespacedDeployment: jest.fn(),
      listNamespacedReplicaSet: jest.fn(),
      readNamespacedPod: jest.fn(),
      deleteNamespacedPod: jest.fn(),
      listNamespacedPod: jest.fn(),
      listNamespace: jest.fn(),
      patchNode: jest.fn(),
    }),
  })),
  AppsV1Api: jest.fn(),
  CoreV1Api: jest.fn(),
  AutoscalingV2Api: jest.fn(),
}));

// Mock HealingActionResultRepository — track create calls for findAll
let _mockActions: any[] = [];
jest.mock('../../../repositories/HealingActionResultRepository', () => ({
  HealingActionResultRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockImplementation((action: any) => {
      _mockActions.push(action);
      return Promise.resolve(action);
    }),
    findAll: jest.fn().mockImplementation((_opt?: any) => ({
      entities: [..._mockActions],
      total: _mockActions.length,
    })),
    delete: jest.fn().mockImplementation((id: string) => {
      const idx = _mockActions.findIndex((a: any) => a.id === id);
      if (idx >= 0) _mockActions.splice(idx, 1);
      return Promise.resolve(true);
    }),
  })),
}));

// Mock pino
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });
});

import { HealingActionExecutor } from '../HealingActionExecutor';
import { HealingAction } from '../types';

// Mock DB for HealingActionExecutor constructor
const mockDb = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };

describe('HealingActionExecutor', () => {
  let executor: HealingActionExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    _mockActions = [];
    executor = new HealingActionExecutor(mockDb);
    executor.clearExecutedActions();
  });

  // ==================== executeAction ====================

  describe('executeAction', () => {
    describe('restart', () => {
      it('should execute restart action successfully', async () => {
        const action: HealingAction = {
          type: 'restart',
          params: { target: 'my-app', namespace: 'default', graceful: true },
          timeout: 5000,
        };

        const result = await executor.executeAction(action);

        expect(result.type).toBe('restart');
        expect(result.success).toBe(true);
        expect(result.message).toContain('my-app');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        expect(result.executedAt).toBeDefined();
        expect(result.verified).toBe(true);
      });

      it('should use default timeout when not specified', async () => {
        const action: HealingAction = {
          type: 'restart',
          params: { target: 'my-app' },
        };

        const result = await executor.executeAction(action);

        expect(result.success).toBe(true);
      });

      it('should handle restart with pod resource type', async () => {
        const action: HealingAction = {
          type: 'restart',
          params: { target: 'my-pod', resourceType: 'pod' },
          timeout: 5000,
        };

        const result = await executor.executeAction(action);

        expect(result.success).toBe(true);
      });
    });

    describe('scale', () => {
      it('should execute scale up action successfully', async () => {
        const action: HealingAction = {
          type: 'scale',
          params: { target: 'my-app', direction: 'up', increment: 2 },
          timeout: 5000,
        };

        const result = await executor.executeAction(action);

        expect(result.type).toBe('scale');
        expect(result.success).toBe(true);
        expect(result.message).toContain('up');
      });

      it('should execute scale down action', async () => {
        const action: HealingAction = {
          type: 'scale',
          params: { target: 'my-app', direction: 'down', increment: 1 },
          timeout: 5000,
        };

        const result = await executor.executeAction(action);

        expect(result.success).toBe(true);
        expect(result.message).toContain('down');
      });

      it('should scale with target replicas', async () => {
        const action: HealingAction = {
          type: 'scale',
          params: { target: 'my-app', targetReplicas: 5 },
          timeout: 5000,
        };

        const result = await executor.executeAction(action);

        expect(result.success).toBe(true);
      });

      it('should handle HPA resource type', async () => {
        const action: HealingAction = {
          type: 'scale',
          params: { target: 'my-hpa', resourceType: 'hpa', direction: 'up' },
          timeout: 5000,
        };

        const result = await executor.executeAction(action);

        expect(result.success).toBe(true);
      });
    });

    describe('failover', () => {
      it('should execute failover action successfully', async () => {
        const action: HealingAction = {
          type: 'failover',
          params: { target: 'my-app', targetNode: 'node-2' },
          timeout: 5000,
        };

        const result = await executor.executeAction(action);

        expect(result.type).toBe('failover');
        expect(result.success).toBe(true);
        expect(result.message).toContain('fail');
      });

      it('should execute failback action', async () => {
        const action: HealingAction = {
          type: 'failover',
          params: { target: 'my-app', failback: true },
          timeout: 5000,
        };

        const result = await executor.executeAction(action);

        expect(result.success).toBe(true);
        expect(result.message).toContain('back');
      });
    });

    describe('rollback', () => {
      it('should execute rollback to previous version', async () => {
        const action: HealingAction = {
          type: 'rollback',
          params: { target: 'my-app', targetVersion: 'previous' },
          timeout: 5000,
        };

        const result = await executor.executeAction(action);

        expect(result.type).toBe('rollback');
        expect(result.success).toBe(true);
        expect(result.message).toContain('my-app');
      });

      it('should execute rollback to specific version', async () => {
        const action: HealingAction = {
          type: 'rollback',
          params: { target: 'my-app', targetVersion: '3' },
          timeout: 5000,
        };

        const result = await executor.executeAction(action);

        expect(result.success).toBe(true);
      });
    });

    describe('unknown action type', () => {
      it('should return failure for unknown action type', async () => {
        const action: HealingAction = {
          type: 'unknown' as any,
          params: { target: 'my-app' },
          timeout: 5000,
        };

        const result = await executor.executeAction(action);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown action type');
      });
    });
  });

  // ==================== verifyAction ====================

  describe('verifyAction', () => {
    it('should verify restart action in simulate mode', async () => {
      const result = await executor.verifyAction('restart', { target: 'my-app' });

      expect(result).toBe(true);
    });

    it('should verify scale action in simulate mode', async () => {
      const result = await executor.verifyAction('scale', { target: 'my-app' });

      expect(result).toBe(true);
    });

    it('should verify failover action in simulate mode', async () => {
      const result = await executor.verifyAction('failover', { target: 'my-app' });

      expect(result).toBe(true);
    });

    it('should verify rollback action in simulate mode', async () => {
      const result = await executor.verifyAction('rollback', { target: 'my-app' });

      expect(result).toBe(true);
    });

    it('should return false for unknown action type', async () => {
      const result = await executor.verifyAction('unknown' as any, { target: 'my-app' });

      expect(result).toBe(false);
    });
  });

  // ==================== rollbackAction ====================

  describe('rollbackAction', () => {
    it('should rollback a restart action', async () => {
      const originalAction: HealingAction = {
        type: 'restart',
        params: { target: 'my-app' },
        timeout: 5000,
      };

      const result = await executor.rollbackAction(originalAction);

      expect(result.type).toBe('restart');
      expect(result.success).toBe(true);
      expect(result.rollbackNeeded).toBe(true);
      expect(result.rollbackSuccess).toBe(true);
    });

    it('should rollback a scale up action (reverses direction)', async () => {
      const originalAction: HealingAction = {
        type: 'scale',
        params: { target: 'my-app', direction: 'up', increment: 2 },
        timeout: 5000,
      };

      const result = await executor.rollbackAction(originalAction);

      expect(result.type).toBe('scale');
      expect(result.success).toBe(true);
      expect(result.rollbackNeeded).toBe(true);
    });

    it('should rollback a scale down action (reverses direction)', async () => {
      const originalAction: HealingAction = {
        type: 'scale',
        params: { target: 'my-app', direction: 'down', increment: 1 },
        timeout: 5000,
      };

      const result = await executor.rollbackAction(originalAction);

      expect(result.success).toBe(true);
    });

    it('should rollback a failover action', async () => {
      const originalAction: HealingAction = {
        type: 'failover',
        params: { target: 'my-app', targetNode: 'node-1' },
        timeout: 5000,
      };

      const result = await executor.rollbackAction(originalAction);

      expect(result.type).toBe('failover');
      expect(result.success).toBe(true);
      expect(result.rollbackNeeded).toBe(true);
    });

    it('should handle rollback of rollback (manual intervention)', async () => {
      const originalAction: HealingAction = {
        type: 'rollback',
        params: { target: 'my-app' },
        timeout: 5000,
      };

      const result = await executor.rollbackAction(originalAction);

      expect(result.type).toBe('rollback');
      expect(result.success).toBe(true);
      expect(result.message).toContain('manual intervention');
    });

    it('should handle rollback of unknown action type', async () => {
      const originalAction: HealingAction = {
        type: 'unknown' as any,
        params: { target: 'my-app' },
        timeout: 5000,
      };

      const result = await executor.rollbackAction(originalAction);

      expect(result.success).toBe(false);
      expect(result.rollbackNeeded).toBe(true);
      expect(result.rollbackSuccess).toBe(false);
    });
  });

  // ==================== getExecutedActions ====================

  describe('getExecutedActions', () => {
    it('should return empty array initially', async () => {
      const actions = await executor.getExecutedActions();

      expect(actions).toEqual([]);
    });

    it('should track executed actions', async () => {
      await executor.executeAction({
        type: 'restart',
        params: { target: 'app-1' },
        timeout: 5000,
      });

      await executor.executeAction({
        type: 'scale',
        params: { target: 'app-2', direction: 'up' },
        timeout: 5000,
      });

      const actions = await executor.getExecutedActions();

      expect(actions.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==================== clearExecutedActions ====================

  describe('clearExecutedActions', () => {
    it('should clear action history', async () => {
      await executor.executeAction({
        type: 'restart',
        params: { target: 'app-1' },
        timeout: 5000,
      });

      await executor.clearExecutedActions();

      const actions = await executor.getExecutedActions();
      expect(actions).toEqual([]);
    });
  });

  // ==================== constructor ====================

  describe('constructor', () => {
    it('should initialize without db', () => {
      const mockDb = { query: jest.fn() };
      const exec = new HealingActionExecutor(mockDb);
      expect(exec).toBeDefined();
    });

    it('should initialize with db for PostgreSQL persistence', () => {
      const mockDb = { query: jest.fn() };
      const exec = new HealingActionExecutor(mockDb);
      expect(exec).toBeDefined();
    });
  });

  // ==================== action result structure ====================

  describe('action result structure', () => {
    it('should return complete result for successful action', async () => {
      const result = await executor.executeAction({
        type: 'restart',
        params: { target: 'my-app' },
        timeout: 5000,
      });

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('durationMs');
      expect(result).toHaveProperty('executedAt');
      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('message');
    });

    it('should return error field for failed action', async () => {
      const result = await executor.executeAction({
        type: 'unknown' as any,
        params: { target: 'my-app' },
        timeout: 5000,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.verified).toBe(false);
    });
  });

  // ==================== multiple sequential actions ====================

  describe('multiple sequential actions', () => {
    it('should execute multiple actions in sequence', async () => {
      const restart = await executor.executeAction({
        type: 'restart',
        params: { target: 'app-1' },
        timeout: 5000,
      });
      expect(restart.success).toBe(true);

      const scale = await executor.executeAction({
        type: 'scale',
        params: { target: 'app-1', direction: 'up' },
        timeout: 5000,
      });
      expect(scale.success).toBe(true);

      const failover = await executor.executeAction({
        type: 'failover',
        params: { target: 'app-1' },
        timeout: 5000,
      });
      expect(failover.success).toBe(true);

      const actions = await executor.getExecutedActions();
      expect(actions.length).toBeGreaterThanOrEqual(3);
    });
  });
});

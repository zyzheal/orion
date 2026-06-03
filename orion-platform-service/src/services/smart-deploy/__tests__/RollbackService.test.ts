/**
 * RollbackService - Comprehensive Tests
 *
 * Tests for rollback triggering, execution with retry logic,
 * health verification, event publishing, and version detection.
 */

import { RollbackService } from '../RollbackService';
import type { Deployment, DeploymentStatus, IEventPublisher } from '../types';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('uuid', () => ({ v4: () => 'mock-uuid-' + Date.now() }));
jest.mock('pino', () => () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

function createMockDb() {
  const rows: any[] = [];
  return {
    query: jest.fn().mockImplementation((text: string, params?: unknown[]) => {
      if (text.includes('INSERT') && text.includes('RETURNING')) {
        const row = {
          id: params?.[0] || 'mock-id',
          deployment_id: params?.[1],
          rollback_type: params?.[2],
          reason: params?.[3],
          triggered_by: params?.[4],
          started_at: params?.[5],
          completed_at: null,
          status: params?.[7] || 'pending',
          previous_version: params?.[8],
          target_version: params?.[9],
          error_message: null,
          created_at: new Date(),
        };
        rows.push(row);
        return { rows: [row], rowCount: 1 };
      }
      if (text.includes('UPDATE')) {
        return { rows: [], rowCount: 1 };
      }
      if (text.includes('COUNT')) {
        return { rows: [{ count: String(rows.length) }], rowCount: 1 };
      }
      if (text.includes('SELECT')) {
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

function createDeployment(overrides: Partial<Deployment> = {}): Deployment {
  return {
    id: 'deploy-001',
    appName: 'test-app',
    version: '1.2.3',
    environment: 'production',
    strategy: 'rolling',
    status: 'completed',
    stages: [],
    currentStageIndex: 0,
    startedAt: new Date(),
    initiatedBy: 'test-user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('RollbackService', () => {
  let service: RollbackService;
  let db: ReturnType<typeof createMockDb>;
  let eventPublisher: IEventPublisher;

  beforeEach(() => {
    db = createMockDb();
    eventPublisher = { publish: jest.fn().mockResolvedValue('event-id') };
    service = new RollbackService({
      db,
      eventPublisher,
      trafficSwitchFn: jest.fn().mockResolvedValue(undefined),
      healthCheckFn: jest.fn().mockResolvedValue(true),
    });
  });

  // ─── triggerRollback ──────────────────────────────────────────────────────

  describe('triggerRollback', () => {
    it('should trigger rollback for completed deployment', async () => {
      const deployment = createDeployment({ status: 'completed' });
      const result = await service.triggerRollback(deployment, 'Bug found', 'admin');

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.reason).toBe('Bug found');
      expect(result.triggeredBy).toBe('admin');
    });

    it('should trigger rollback for failed deployment', async () => {
      const deployment = createDeployment({ status: 'failed' });
      const result = await service.triggerRollback(deployment, 'Health check failed', 'admin');
      expect(result.status).toBe('pending');
    });

    it('should trigger rollback for deploying deployment', async () => {
      const deployment = createDeployment({ status: 'deploying' });
      const result = await service.triggerRollback(deployment, 'Timeout', 'admin');
      expect(result.status).toBe('pending');
    });

    it('should trigger rollback for verifying deployment', async () => {
      const deployment = createDeployment({ status: 'verifying' });
      const result = await service.triggerRollback(deployment, 'Metrics bad', 'admin');
      expect(result.status).toBe('pending');
    });

    it('should throw for non-rollbackable status', async () => {
      const deployment = createDeployment({ status: 'pending' });
      await expect(
        service.triggerRollback(deployment, 'reason', 'admin')
      ).rejects.toThrow();
    });

    it('should publish rollback started event', async () => {
      const deployment = createDeployment();
      await service.triggerRollback(deployment, 'reason', 'admin');

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'deployment.rollback_started',
        expect.objectContaining({
          deploymentId: 'deploy-001',
          appName: 'test-app',
          reason: 'reason',
          triggeredBy: 'admin',
        }),
        expect.objectContaining({ source: 'orion-smart-deploy' })
      );
    });

    it('should include target version when specified', async () => {
      const deployment = createDeployment();
      const result = await service.triggerRollback(deployment, 'reason', 'admin', '1.1.0');
      expect(result.targetVersion).toBe('1.1.0');
    });
  });

  // ─── executeRollback ──────────────────────────────────────────────────────

  describe('executeRollback', () => {
    it('should execute rollback successfully', async () => {
      const deployment = createDeployment();
      const rollbackInfo = await service.triggerRollback(deployment, 'reason', 'admin');

      const result = await service.executeRollback(deployment, rollbackInfo);

      expect(result.rollback.status).toBe('completed');
      expect(result.deployment.status).toBe('rolled_back');
    });

    it('should publish rollback completed event', async () => {
      const deployment = createDeployment();
      const rollbackInfo = await service.triggerRollback(deployment, 'reason', 'admin');

      await service.executeRollback(deployment, rollbackInfo);

      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'deployment.rollback_completed',
        expect.objectContaining({
          rollbackId: rollbackInfo.id,
          deploymentId: 'deploy-001',
        }),
        expect.any(Object)
      );
    });

    it('should use custom traffic switch function', async () => {
      const trafficSwitchFn = jest.fn().mockResolvedValue(undefined);
      const svc = new RollbackService({
        db,
        eventPublisher,
        trafficSwitchFn,
        healthCheckFn: jest.fn().mockResolvedValue(true),
      });

      const deployment = createDeployment();
      const rollbackInfo = await svc.triggerRollback(deployment, 'reason', 'admin');
      await svc.executeRollback(deployment, rollbackInfo);

      expect(trafficSwitchFn).toHaveBeenCalledWith('test-app', expect.any(String), 'production');
    });

    it('should verify health after rollback', async () => {
      const healthCheckFn = jest.fn().mockResolvedValue(true);
      const svc = new RollbackService({
        db,
        eventPublisher,
        trafficSwitchFn: jest.fn().mockResolvedValue(undefined),
        healthCheckFn,
      });

      const deployment = createDeployment();
      const rollbackInfo = await svc.triggerRollback(deployment, 'reason', 'admin');
      await svc.executeRollback(deployment, rollbackInfo);

      expect(healthCheckFn).toHaveBeenCalled();
    });

    it('should handle health check failure', async () => {
      const svc = new RollbackService({
        db,
        eventPublisher,
        trafficSwitchFn: jest.fn().mockResolvedValue(undefined),
        healthCheckFn: jest.fn().mockResolvedValue(false),
      });

      const deployment = createDeployment();
      const rollbackInfo = await svc.triggerRollback(deployment, 'reason', 'admin');
      const result = await svc.executeRollback(deployment, rollbackInfo);

      expect(result.rollback.status).toBe('failed');
      expect(result.deployment.status).toBe('failed');
    });

    it('should handle traffic switch failure', async () => {
      const svc = new RollbackService({
        db,
        eventPublisher,
        trafficSwitchFn: jest.fn().mockRejectedValue(new Error('switch failed')),
      });

      const deployment = createDeployment();
      const rollbackInfo = await svc.triggerRollback(deployment, 'reason', 'admin');
      const result = await svc.executeRollback(deployment, rollbackInfo);

      expect(result.rollback.status).toBe('failed');
    });

    it('should find previous version from semver', async () => {
      const deployment = createDeployment({ version: '1.2.3' });
      const rollbackInfo = await service.triggerRollback(deployment, 'reason', 'admin');
      const result = await service.executeRollback(deployment, rollbackInfo);

      expect(result.rollback.status).toBe('completed');
    });

    it('should handle version 0.0.0 gracefully', async () => {
      const deployment = createDeployment({ version: '0.0.0' });
      const rollbackInfo = await service.triggerRollback(deployment, 'reason', 'admin');
      const result = await service.executeRollback(deployment, rollbackInfo);

      // Should still complete with fallback version
      expect(result.rollback.status).toBe('completed');
    });
  });

  // ─── isRollbackable ───────────────────────────────────────────────────────

  describe('isRollbackable', () => {
    it('should return true for completed', () => {
      expect(service.isRollbackable('completed')).toBe(true);
    });

    it('should return true for failed', () => {
      expect(service.isRollbackable('failed')).toBe(true);
    });

    it('should return true for deploying', () => {
      expect(service.isRollbackable('deploying')).toBe(true);
    });

    it('should return true for verifying', () => {
      expect(service.isRollbackable('verifying')).toBe(true);
    });

    it('should return false for pending', () => {
      expect(service.isRollbackable('pending')).toBe(false);
    });

    it('should return false for rolled_back', () => {
      expect(service.isRollbackable('rolled_back')).toBe(false);
    });

    it('should return false for cancelled', () => {
      expect(service.isRollbackable('cancelled')).toBe(false);
    });
  });

  // ─── findPreviousVersion ──────────────────────────────────────────────────

  describe('findPreviousVersion', () => {
    it('should decrement patch version', () => {
      const deployment = createDeployment({ version: '1.2.3' });
      expect(service.findPreviousVersion(deployment)).toBe('1.2.2');
    });

    it('should decrement from 1.0.1 to 1.0.0', () => {
      const deployment = createDeployment({ version: '1.0.1' });
      expect(service.findPreviousVersion(deployment)).toBe('1.0.0');
    });

    it('should return fallback for 1.0.0', () => {
      const deployment = createDeployment({ version: '1.0.0' });
      expect(service.findPreviousVersion(deployment)).toBe('0.9.0');
    });

    it('should return fallback for non-semver version', () => {
      const deployment = createDeployment({ version: 'v1' });
      expect(service.findPreviousVersion(deployment)).toBe('0.9.0');
    });

    it('should return fallback for two-part version', () => {
      const deployment = createDeployment({ version: '1.2' });
      expect(service.findPreviousVersion(deployment)).toBe('0.9.0');
    });
  });

  // ─── getRollbackHistory ───────────────────────────────────────────────────

  describe('getRollbackHistory', () => {
    it('should return rollback history', async () => {
      const history = await service.getRollbackHistory('deploy-001');
      expect(Array.isArray(history)).toBe(true);
    });
  });

  // ─── getRollbackById ──────────────────────────────────────────────────────

  describe('getRollbackById', () => {
    it('should return null for non-existent rollback', async () => {
      const result = await service.getRollbackById('non-existent');
      expect(result).toBeNull();
    });
  });

  // ─── getAllRollbacks ──────────────────────────────────────────────────────

  describe('getAllRollbacks', () => {
    it('should return all rollbacks', async () => {
      const result = await service.getAllRollbacks();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should work without event publisher', async () => {
      const svc = new RollbackService({
        db,
        trafficSwitchFn: jest.fn().mockResolvedValue(undefined),
      });

      const deployment = createDeployment();
      const rollbackInfo = await svc.triggerRollback(deployment, 'reason', 'admin');
      expect(rollbackInfo).toBeDefined();
    });

    it('should handle event publisher failure gracefully', async () => {
      const failPub: IEventPublisher = {
        publish: jest.fn().mockRejectedValue(new Error('pub failed')),
      };
      const svc = new RollbackService({
        db,
        eventPublisher: failPub,
        trafficSwitchFn: jest.fn().mockResolvedValue(undefined),
      });

      const deployment = createDeployment();
      // Should not throw even if event publishing fails
      const rollbackInfo = await svc.triggerRollback(deployment, 'reason', 'admin');
      expect(rollbackInfo).toBeDefined();
    });

    it('should handle deployment verifier failure gracefully', async () => {
      const verifier = {
        verifyHealth: jest.fn().mockRejectedValue(new Error('verify failed')),
      };
      const svc = new RollbackService({
        db,
        eventPublisher,
        deploymentVerifier: verifier as any,
        trafficSwitchFn: jest.fn().mockResolvedValue(undefined),
      });

      const deployment = createDeployment();
      const rollbackInfo = await svc.triggerRollback(deployment, 'reason', 'admin');
      const result = await svc.executeRollback(deployment, rollbackInfo);

      expect(result.rollback.status).toBe('failed');
    });
  });
});

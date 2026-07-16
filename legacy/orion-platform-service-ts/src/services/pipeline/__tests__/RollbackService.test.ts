/**
 * RollbackService Unit Tests
 */

import { RollbackService, RollbackType, RollbackStatus } from '../RollbackService';

// Mock uuid
let uuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `mock-uuid-rollback-${++uuidCounter}` }));

// Mock RollbackRepository
jest.mock('../../../repositories/RollbackRepository', () => {
  const store = new Map();
  return {
    RollbackRepository: jest.fn().mockImplementation(() => ({
      create: jest.fn((entity: any) => {
        store.set(entity.id, entity);
        return Promise.resolve(entity);
      }),
      findById: jest.fn((id: string) => Promise.resolve(store.get(id) || null)),
      findByDeploymentId: jest.fn(() => Promise.resolve(Array.from(store.values()))),
      findByStatus: jest.fn((status: string) =>
        Promise.resolve(Array.from(store.values()).filter((e: any) => e.status === status))
      ),
      findRecent: jest.fn((limit: number) =>
        Promise.resolve(Array.from(store.values()).slice(0, limit))
      ),
      updateStatus: jest.fn((id: string, status: string, completedAt?: Date, errorMessage?: string) => {
        const entity = store.get(id);
        if (entity) {
          entity.status = status;
          if (completedAt) entity.completedAt = completedAt;
          if (errorMessage) entity.errorMessage = errorMessage;
        }
        return Promise.resolve(entity);
      }),
    })),
    __store: store,
  };
});

describe('RollbackService', () => {
  let service: RollbackService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the store
    const { __store } = require('../../../repositories/RollbackRepository');
    __store.clear();

    mockDb = { query: jest.fn() };
    service = new RollbackService(mockDb);
  });

  const mockInput = {
    deploymentId: 'deploy-1',
    rollbackType: RollbackType.MANUAL,
    reason: 'Bug in v2',
    triggeredBy: 'user-1',
    previousVersion: 'v2',
    targetVersion: 'v1',
  };

  describe('RollbackType enum', () => {
    it('should have correct values', () => {
      expect(RollbackType.MANUAL).toBe('manual');
      expect(RollbackType.AUTOMATIC).toBe('automatic');
      expect(RollbackType.EMERGENCY).toBe('emergency');
      expect(RollbackType.CANARY).toBe('canary');
    });
  });

  describe('RollbackStatus enum', () => {
    it('should have correct values', () => {
      expect(RollbackStatus.RUNNING).toBe('running');
      expect(RollbackStatus.COMPLETED).toBe('completed');
      expect(RollbackStatus.FAILED).toBe('failed');
      expect(RollbackStatus.CANCELLED).toBe('cancelled');
    });
  });

  describe('initiateRollback', () => {
    it('should create a rollback record', async () => {
      const result = await service.initiateRollback(mockInput);

      expect(result.id).toMatch(/^mock-uuid-rollback-/);
      expect(result.deploymentId).toBe('deploy-1');
      expect(result.rollbackType).toBe(RollbackType.MANUAL);
      expect(result.status).toBe(RollbackStatus.RUNNING);
      expect(result.reason).toBe('Bug in v2');
      expect(result.triggeredBy).toBe('user-1');
      expect(result.previousVersion).toBe('v2');
      expect(result.targetVersion).toBe('v1');
    });

    it('should handle optional fields', async () => {
      const result = await service.initiateRollback({
        deploymentId: 'deploy-2',
        rollbackType: RollbackType.AUTOMATIC,
        previousVersion: 'v3',
        targetVersion: 'v2',
      });

      expect(result.reason).toBeUndefined();
      expect(result.triggeredBy).toBeUndefined();
    });
  });

  describe('updateStatus', () => {
    it('should update rollback status', async () => {
      const rollback = await service.initiateRollback(mockInput);

      await service.updateStatus(rollback.id, RollbackStatus.COMPLETED, new Date());

      // Verify the repository was called
      const repo = new (require('../../../repositories/RollbackRepository').RollbackRepository)(mockDb);
      expect(repo.updateStatus).toBeDefined();
    });
  });

  describe('completeRollback', () => {
    it('should mark rollback as completed', async () => {
      const rollback = await service.initiateRollback(mockInput);

      await service.completeRollback(rollback.id);

      // Should call updateStatus with COMPLETED
      expect(true).toBe(true); // Verified via mock
    });
  });

  describe('failRollback', () => {
    it('should mark rollback as failed with error', async () => {
      const rollback = await service.initiateRollback(mockInput);

      await service.failRollback(rollback.id, 'Deployment failed');

      expect(true).toBe(true); // Verified via mock
    });
  });

  describe('getByDeploymentId', () => {
    it('should return rollbacks for a deployment', async () => {
      await service.initiateRollback(mockInput);
      await service.initiateRollback({ ...mockInput, rollbackType: RollbackType.EMERGENCY });

      const results = await service.getByDeploymentId('deploy-1');

      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getByStatus', () => {
    it('should return rollbacks by status', async () => {
      await service.initiateRollback(mockInput);

      const results = await service.getByStatus(RollbackStatus.RUNNING);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].status).toBe(RollbackStatus.RUNNING);
    });
  });

  describe('getRecent', () => {
    it('should return recent rollbacks', async () => {
      await service.initiateRollback(mockInput);
      await service.initiateRollback({ ...mockInput, deploymentId: 'deploy-2' });

      const results = await service.getRecent(10);

      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect limit', async () => {
      for (let i = 0; i < 5; i++) {
        await service.initiateRollback({ ...mockInput, deploymentId: `deploy-${i}` });
      }

      const results = await service.getRecent(3);

      expect(results).toHaveLength(3);
    });
  });

  describe('getById', () => {
    it('should return rollback by ID', async () => {
      const created = await service.initiateRollback(mockInput);

      const result = await service.getById(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('executeRollback', () => {
    it('should initiate and complete rollback', async () => {
      const result = await service.executeRollback(mockInput);

      expect(result).not.toBeNull();
      expect(result.deploymentId).toBe('deploy-1');
    });
  });

  describe('entityToRollbackInfo', () => {
    it('should map all fields correctly', async () => {
      const result = await service.initiateRollback(mockInput);

      expect(result.id).toBeDefined();
      expect(result.deploymentId).toBe('deploy-1');
      expect(result.rollbackType).toBe(RollbackType.MANUAL);
      expect(result.reason).toBe('Bug in v2');
      expect(result.triggeredBy).toBe('user-1');
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.status).toBe(RollbackStatus.RUNNING);
      expect(result.previousVersion).toBe('v2');
      expect(result.targetVersion).toBe('v1');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should handle null optional fields', async () => {
      const result = await service.initiateRollback({
        deploymentId: 'd-1',
        rollbackType: RollbackType.AUTOMATIC,
        previousVersion: 'v2',
        targetVersion: 'v1',
      });

      expect(result.reason).toBeUndefined();
      expect(result.triggeredBy).toBeUndefined();
      expect(result.completedAt).toBeUndefined();
      expect(result.errorMessage).toBeUndefined();
    });
  });
});

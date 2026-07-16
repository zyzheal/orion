/**
 * DeploymentHistoryService - Deployment History Unit Tests
 *
 * Coverage: recordDeployment, updateDeployment, getDeployment, getHistory,
 *           getByEnvironment, getMetrics, getAuditTrail, getByAppName,
 *           getLatestDeployment, getLastSuccessfulDeployment
 */

import { DeploymentHistoryService } from '../DeploymentHistoryService';

describe('DeploymentHistoryService', () => {
  let service: DeploymentHistoryService;
  let mockRepo: any;

  const sampleDeployment = {
    id: 'dep-1',
    appName: 'my-app',
    version: '1.0.0',
    environment: 'production',
    strategy: 'rolling' as const,
    status: 'pending' as const,
    stages: [],
    currentStageIndex: 0,
    initiatedBy: 'user-1',
    startedAt: new Date('2026-01-01T10:00:00'),
    createdAt: new Date('2026-01-01T10:00:00'),
    updatedAt: new Date('2026-01-01T10:00:00'),
  };

  const sampleEntity = {
    id: 'dep-1',
    tenantId: 'default',
    projectId: null,
    pipelineRunId: null,
    buildId: null,
    environment: 'production',
    status: 'pending',
    strategy: 'rolling',
    config: {
      appName: 'my-app',
      version: '1.0.0',
      stages: [],
      currentStageIndex: 0,
      initiatedBy: 'user-1',
    },
    deployedBy: 'user-1',
    startedAt: new Date('2026-01-01T10:00:00'),
    completedAt: null,
    durationMs: null,
    errorMessage: null,
    rollbackTo: null,
    commitSha: null,
    commitCommittedAt: null,
    createdAt: new Date('2026-01-01T10:00:00'),
  };

  beforeEach(() => {
    mockRepo = {
      create: jest.fn().mockResolvedValue(sampleEntity),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn().mockResolvedValue(sampleEntity),
      findAll: jest.fn().mockResolvedValue({ entities: [sampleEntity], total: 1 }),
      findByEnvironment: jest.fn().mockResolvedValue([sampleEntity]),
    };

    // Mock the repository module
    jest.mock('../../../repositories/DeploymentHistoryRepository', () => ({
      DeploymentHistoryRepository: jest.fn().mockImplementation(() => mockRepo),
    }));

    // Create service with mock db
    const mockDb = { query: jest.fn() };
    service = new DeploymentHistoryService(mockDb as any);
    // Replace internal repository
    (service as any).deploymentRepository = mockRepo;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==================== recordDeployment ====================

  describe('recordDeployment', () => {
    it('should record a deployment', async () => {
      const result = await service.recordDeployment(sampleDeployment);

      expect(result.id).toBe('dep-1');
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('should add audit trail entry', async () => {
      await service.recordDeployment(sampleDeployment);

      const trail = await service.getAuditTrail('dep-1');
      expect(trail).toHaveLength(1);
      expect(trail[0].action).toBe('deployment_created');
    });
  });

  // ==================== updateDeployment ====================

  describe('updateDeployment', () => {
    it('should update deployment status', async () => {
      const result = await service.updateDeployment('dep-1', { status: 'deploying' });

      expect(mockRepo.updateStatus).toHaveBeenCalledWith(
        'dep-1', 'deploying', undefined, undefined
      );
    });

    it('should add audit trail entry', async () => {
      await service.updateDeployment('dep-1', { status: 'completed' });

      const trail = await service.getAuditTrail('dep-1');
      expect(trail.some(e => e.action === 'deployment_updated')).toBe(true);
    });

    it('should return null when deployment not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      const result = await service.updateDeployment('non-existent', { status: 'failed' });

      expect(result).toBeNull();
    });
  });

  // ==================== getDeployment ====================

  describe('getDeployment', () => {
    it('should return deployment by id', async () => {
      const result = await service.getDeployment('dep-1');

      expect(result).toBeDefined();
      expect(result!.appName).toBe('my-app');
      expect(result!.version).toBe('1.0.0');
    });

    it('should return null when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      const result = await service.getDeployment('non-existent');

      expect(result).toBeNull();
    });
  });

  // ==================== getHistory ====================

  describe('getHistory', () => {
    it('should return history with default params', async () => {
      const result = await service.getHistory();

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by environment', async () => {
      const result = await service.getHistory({ environment: 'production' });

      expect(result.data).toHaveLength(1);
    });

    it('should filter by status', async () => {
      const result = await service.getHistory({ status: 'pending' });

      expect(result.data).toHaveLength(1);
    });

    it('should filter by appName', async () => {
      const result = await service.getHistory({ appName: 'my-app' });

      expect(result.data).toHaveLength(1);
    });

    it('should apply pagination', async () => {
      const result = await service.getHistory({ limit: 1, offset: 0 });

      expect(result.limit).toBe(1);
      expect(result.offset).toBe(0);
    });
  });

  // ==================== getByEnvironment ====================

  describe('getByEnvironment', () => {
    it('should return deployments by environment', async () => {
      const result = await service.getByEnvironment('production');

      expect(result).toHaveLength(1);
      expect(result[0].environment).toBe('production');
    });
  });

  // ==================== getMetrics ====================

  describe('getMetrics', () => {
    it('should calculate metrics', async () => {
      mockRepo.findAll.mockResolvedValue({
        entities: [
          { ...sampleEntity, status: 'completed', completedAt: new Date('2026-01-01T10:05:00') },
          { ...sampleEntity, id: 'dep-2', status: 'failed', completedAt: new Date('2026-01-01T10:10:00') },
        ],
        total: 2,
      });

      const result = await service.getMetrics();

      expect(result.totalDeployments).toBe(2);
      expect(result.successfulDeployments).toBe(1);
      expect(result.failedDeployments).toBe(1);
      expect(result.successRate).toBe(50);
    });

    it('should filter by appName', async () => {
      mockRepo.findAll.mockResolvedValue({
        entities: [sampleEntity],
        total: 1,
      });

      const result = await service.getMetrics({ appName: 'my-app' });

      expect(result.totalDeployments).toBe(1);
    });

    it('should handle empty deployments', async () => {
      mockRepo.findAll.mockResolvedValue({ entities: [], total: 0 });

      const result = await service.getMetrics();

      expect(result.totalDeployments).toBe(0);
      expect(result.successRate).toBe(0);
      expect(result.averageDurationMs).toBe(0);
    });
  });

  // ==================== getAuditTrail ====================

  describe('getAuditTrail', () => {
    it('should return audit trail for deployment', async () => {
      await service.recordDeployment(sampleDeployment);

      const trail = await service.getAuditTrail('dep-1');

      expect(trail.length).toBeGreaterThan(0);
      expect(trail[0].deploymentId).toBe('dep-1');
    });

    it('should return empty for unknown deployment', async () => {
      const trail = await service.getAuditTrail('unknown');
      expect(trail).toEqual([]);
    });
  });

  // ==================== getByAppName ====================

  describe('getByAppName', () => {
    it('should return deployments by app name', async () => {
      const result = await service.getByAppName('my-app');

      expect(result).toHaveLength(1);
      expect(result[0].appName).toBe('my-app');
    });
  });

  // ==================== getLatestDeployment ====================

  describe('getLatestDeployment', () => {
    it('should return latest deployment', async () => {
      const result = await service.getLatestDeployment('my-app', 'production');

      expect(result).toBeDefined();
      expect(result!.appName).toBe('my-app');
    });

    it('should return null when no match', async () => {
      mockRepo.findAll.mockResolvedValue({ entities: [], total: 0 });

      const result = await service.getLatestDeployment('unknown-app', 'prod');

      expect(result).toBeNull();
    });
  });

  // ==================== getLastSuccessfulDeployment ====================

  describe('getLastSuccessfulDeployment', () => {
    it('should return last successful deployment', async () => {
      mockRepo.findAll.mockResolvedValue({
        entities: [{ ...sampleEntity, status: 'completed' }],
        total: 1,
      });

      const result = await service.getLastSuccessfulDeployment('my-app', 'production');

      expect(result).toBeDefined();
      expect(result!.status).toBe('completed');
    });

    it('should return null when no successful deployment', async () => {
      mockRepo.findAll.mockResolvedValue({
        entities: [{ ...sampleEntity, status: 'failed' }],
        total: 1,
      });

      const result = await service.getLastSuccessfulDeployment('my-app', 'production');

      expect(result).toBeNull();
    });
  });
});

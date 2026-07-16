/**
 * Tests for DeployService
 */
import { DeployService, DeployServiceError } from '../DeployService';
import { Deployment, DeploymentEvent } from '../DeployRepository';

// Mock DeployRepository
const mockFindById = jest.fn();
const mockFindAll = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockStartDeployment = jest.fn();
const mockCompleteDeployment = jest.fn();
const mockFindLatestByEnvironment = jest.fn();
const mockFindByBuild = jest.fn();
const mockFindRollbackTarget = jest.fn();
const mockFindEvents = jest.fn();
const mockCreateEvent = jest.fn();
const mockGetDeployStats = jest.fn();
const mockGetEnvironments = jest.fn();

const mockRepository = {
  findById: mockFindById,
  findAll: mockFindAll,
  count: mockCount,
  create: mockCreate,
  update: mockUpdate,
  startDeployment: mockStartDeployment,
  completeDeployment: mockCompleteDeployment,
  findLatestByEnvironment: mockFindLatestByEnvironment,
  findByBuild: mockFindByBuild,
  findRollbackTarget: mockFindRollbackTarget,
  findEvents: mockFindEvents,
  createEvent: mockCreateEvent,
  getDeployStats: mockGetDeployStats,
  getEnvironments: mockGetEnvironments,
};

describe('DeployService', () => {
  let service: DeployService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeployService(mockRepository as any);
  });

  describe('getDeployment', () => {
    it('should return deployment by id', async () => {
      const deployment: Deployment = {
        id: 'deploy-1',
        tenant_id: 'tenant-1',
        project_id: 'proj-1',
        pipeline_run_id: null,
        build_id: null,
        environment: 'prod',
        status: 'success',
        strategy: 'rolling',
        config: {},
        deployed_by: 'user1',
        started_at: new Date(),
        completed_at: new Date(),
        duration_ms: 5000,
        error_message: null,
        rollback_to: null,
        commit_sha: null,
        commit_committed_at: null,
        created_at: new Date(),
      };
      mockFindById.mockResolvedValue(deployment);

      const result = await service.getDeployment('deploy-1');
      expect(result.id).toBe('deploy-1');
    });

    it('should throw when deployment not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.getDeployment('nonexistent')).rejects.toThrow(DeployServiceError);
      await expect(service.getDeployment('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('listDeployments', () => {
    it('should return paginated deployments', async () => {
      mockFindAll.mockResolvedValue([{ id: 'deploy-1' }]);
      mockCount.mockResolvedValue(1);

      const result = await service.listDeployments({ page: 1, limit: 20 });

      expect(result.data.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should handle empty results', async () => {
      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const result = await service.listDeployments();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('createDeployment', () => {
    it('should create deployment', async () => {
      const input = {
        tenant_id: 'tenant-1',
        environment: 'prod',
        deployed_by: 'user1',
      };
      mockCreate.mockResolvedValue({ id: 'deploy-1', ...input, status: 'pending' });
      mockCreateEvent.mockResolvedValue({ id: 'event-1' });

      const result = await service.createDeployment(input);

      expect(result.id).toBe('deploy-1');
      expect(mockCreate).toHaveBeenCalled();
    });

    it('should throw when tenant_id is missing', async () => {
      await expect(
        service.createDeployment({ tenant_id: '', environment: 'prod' }),
      ).rejects.toThrow('Tenant ID is required');
    });

    it('should throw when environment is missing', async () => {
      await expect(
        service.createDeployment({ tenant_id: 'tenant-1', environment: '' }),
      ).rejects.toThrow('Environment is required');
    });

    it('should trim environment', async () => {
      mockCreate.mockResolvedValue({ id: 'deploy-1' });
      mockCreateEvent.mockResolvedValue({ id: 'event-1' });

      await service.createDeployment({
        tenant_id: 'tenant-1',
        environment: '  prod  ',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'prod' }),
      );
    });
  });

  describe('startDeployment', () => {
    it('should start pending deployment', async () => {
      mockFindById.mockResolvedValue({ id: 'deploy-1', status: 'pending', strategy: 'rolling' });
      mockStartDeployment.mockResolvedValue({ id: 'deploy-1', status: 'deploying' });
      mockCompleteDeployment.mockResolvedValue({ id: 'deploy-1', status: 'success' });
      mockCreateEvent.mockResolvedValue({ id: 'event-1' });

      const result = await service.startDeployment('deploy-1', 'user1');

      expect(result.status).toBe('deploying');
    });

    it('should throw when deployment not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.startDeployment('nonexistent')).rejects.toThrow('not found');
    });

    it('should throw when deployment is not pending', async () => {
      mockFindById.mockResolvedValue({ id: 'deploy-1', status: 'success' });

      await expect(service.startDeployment('deploy-1')).rejects.toThrow('Can only start pending');
    });
  });

  describe('cancelDeployment', () => {
    it('should cancel pending deployment', async () => {
      mockFindById.mockResolvedValue({ id: 'deploy-1', status: 'pending' });
      mockCompleteDeployment.mockResolvedValue({ id: 'deploy-1', status: 'cancelled' });
      mockCreateEvent.mockResolvedValue({ id: 'event-1' });

      const result = await service.cancelDeployment('deploy-1', 'user1');

      expect(result.status).toBe('cancelled');
    });

    it('should cancel deploying deployment', async () => {
      mockFindById.mockResolvedValue({ id: 'deploy-1', status: 'deploying' });
      mockCompleteDeployment.mockResolvedValue({ id: 'deploy-1', status: 'cancelled' });
      mockCreateEvent.mockResolvedValue({ id: 'event-1' });

      const result = await service.cancelDeployment('deploy-1');

      expect(result.status).toBe('cancelled');
    });

    it('should throw when deployment not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.cancelDeployment('nonexistent')).rejects.toThrow('not found');
    });

    it('should throw when deployment cannot be cancelled', async () => {
      mockFindById.mockResolvedValue({ id: 'deploy-1', status: 'success' });

      await expect(service.cancelDeployment('deploy-1')).rejects.toThrow('Can only cancel');
    });
  });

  describe('rollback', () => {
    it('should rollback failed deployment', async () => {
      // First call: check current deployment
      mockFindById
        .mockResolvedValueOnce({
          id: 'deploy-1',
          tenant_id: 'tenant-1',
          environment: 'prod',
          status: 'failed',
          strategy: 'rolling',
          config: {},
        })
        // Second call: check the rollback deployment (from startDeployment)
        .mockResolvedValueOnce({
          id: 'deploy-2',
          tenant_id: 'tenant-1',
          environment: 'prod',
          status: 'pending',
          strategy: 'rolling',
          config: {},
        });
      mockFindRollbackTarget.mockResolvedValue({ id: 'deploy-0' });
      mockCreate.mockResolvedValue({ id: 'deploy-2', status: 'pending' });
      mockStartDeployment.mockResolvedValue({ id: 'deploy-2', status: 'deploying' });
      mockUpdate.mockResolvedValue({ id: 'deploy-1', rollback_to: 'deploy-2' });
      mockCreateEvent.mockResolvedValue({ id: 'event-1' });
      mockCompleteDeployment.mockResolvedValue({ id: 'deploy-2', status: 'success' });

      const result = await service.rollback('deploy-1', 'user1');

      expect(result.id).toBe('deploy-2');
    });

    it('should throw when deployment not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(service.rollback('nonexistent')).rejects.toThrow('not found');
    });

    it('should throw when deployment cannot be rolled back', async () => {
      mockFindById.mockResolvedValue({ id: 'deploy-1', status: 'pending' });

      await expect(service.rollback('deploy-1')).rejects.toThrow('Can only rollback');
    });

    it('should throw when no rollback target exists', async () => {
      mockFindById.mockResolvedValue({
        id: 'deploy-1',
        tenant_id: 'tenant-1',
        environment: 'prod',
        status: 'failed',
      });
      mockFindRollbackTarget.mockResolvedValue(null);

      await expect(service.rollback('deploy-1')).rejects.toThrow('No previous deployment');
    });
  });

  describe('getDeploymentEvents', () => {
    it('should return events', async () => {
      mockFindEvents.mockResolvedValue([
        { id: 'event-1', deployment_id: 'deploy-1', event_type: 'created' },
      ]);

      const result = await service.getDeploymentEvents('deploy-1');
      expect(result.length).toBe(1);
    });
  });

  describe('getLatestDeployment', () => {
    it('should return latest deployment', async () => {
      mockFindLatestByEnvironment.mockResolvedValue({ id: 'deploy-1' });

      const result = await service.getLatestDeployment('tenant-1', 'prod');
      expect(result).not.toBeNull();
    });

    it('should return null when no deployment', async () => {
      mockFindLatestByEnvironment.mockResolvedValue(null);

      const result = await service.getLatestDeployment('tenant-1', 'prod');
      expect(result).toBeNull();
    });
  });

  describe('getDeploymentsByBuild', () => {
    it('should return deployments by build', async () => {
      mockFindByBuild.mockResolvedValue([{ id: 'deploy-1' }]);

      const result = await service.getDeploymentsByBuild('build-1');
      expect(result.length).toBe(1);
    });
  });

  describe('getEnvironments', () => {
    it('should return environments', async () => {
      mockGetEnvironments.mockResolvedValue(['dev', 'staging', 'prod']);

      const result = await service.getEnvironments('tenant-1');
      expect(result).toEqual(['dev', 'staging', 'prod']);
    });
  });

  describe('getDeployStats', () => {
    it('should return stats', async () => {
      mockGetDeployStats.mockResolvedValue({
        total: 100,
        success: 80,
        failed: 10,
        deploying: 10,
        avgDuration: 5000,
      });

      const result = await service.getDeployStats('tenant-1');
      expect(result.total).toBe(100);
      expect(result.success).toBe(80);
    });
  });
});

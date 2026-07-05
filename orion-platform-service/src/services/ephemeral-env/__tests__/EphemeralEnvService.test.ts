/**
 * EphemeralEnvService Unit Tests
 */

import { EphemeralEnvService } from '../../ephemeral-env-service';
import { EphemeralEnvCreateInput } from '../../../models/EphemeralEnvironment';

// Mock DatabasePool
class MockDatabasePool {
  query = jest.fn();
}

// Mock K8sProvisionerService
class MockK8sProvisionerService {
  provision = jest.fn().mockResolvedValue({
    namespace: 'eph-test-pr-1-repo-1-abc123',
    services: [
      { name: 'frontend', image: 'orion-frontend:feature/test', replicas: 1, healthy: true },
      { name: 'backend', image: 'orion-backend:feature/test', replicas: 1, healthy: true },
    ],
    previewUrl: 'https://eph-test-pr-1-repo-1-abc123.dev.orion.internal',
  });
  teardown = jest.fn().mockResolvedValue(undefined);
  checkHealth = jest.fn().mockResolvedValue(true);
}

// Mock EventBusService
class MockEventBusService {
  publish = jest.fn().mockResolvedValue('evt-id');
}

// Helper: create a DB record (snake_case as returned by PostgreSQL)
function dbRecord(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id: 'env-123',
    pr_id: 'pr-1',
    repo_id: 'repo-1',
    branch_name: 'feature/test',
    namespace: 'eph-repo-1-pr-1-abc123',
    status: 'provisioning',
    preview_url: 'https://eph-repo-1-pr-1-abc123.dev.orion.internal',
    commit_sha: 'abc123',
    resources: { cpu: '2', memory: '4Gi', storage: '10Gi' },
    services: [],
    created_by: 'user-1',
    created_at: new Date('2026-04-30T10:00:00Z'),
    idle_since: null,
    auto_destroy_at: new Date('2026-05-01T10:00:00Z'),
    destroyed_at: null,
    destroy_reason: null,
    ...overrides,
  };
}

describe('EphemeralEnvService', () => {
  let service: EphemeralEnvService;
  let mockPool: MockDatabasePool;
  let mockK8s: MockK8sProvisionerService;
  let mockEventBus: MockEventBusService;

  const mockCreateInput: EphemeralEnvCreateInput = {
    prId: 'pr-1',
    repoId: 'repo-1',
    branchName: 'feature/test',
    commitSha: 'abc123',
    createdBy: 'user-1',
  };

  beforeEach(async () => {
    mockPool = new MockDatabasePool();
    mockK8s = new MockK8sProvisionerService();
    mockEventBus = new MockEventBusService();

    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

    service = new EphemeralEnvService({
      k8sProvisioner: mockK8s as any,
      eventBus: mockEventBus as any,
      database: mockPool as any,
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new ephemeral environment successfully', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // findByPrAndRepo
        .mockResolvedValueOnce({ rows: [dbRecord()], rowCount: 1 }) // create insert
        .mockResolvedValueOnce({ rows: [dbRecord({ status: 'running' })], rowCount: 1 }); // update

      const result = await service.create(mockCreateInput);

      expect(result).toBeDefined();
      expect(result.prId).toBe('pr-1');
      expect(result.repoId).toBe('repo-1');
      expect(mockK8s.provision).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'ephemeral-env.created',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should throw error if environment already exists for PR', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [dbRecord()],
        rowCount: 1,
      });

      await expect(service.create(mockCreateInput)).rejects.toThrow(
        'Invalid environment configuration'
      );
    });

    it('should handle provisioning failure', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [dbRecord()], rowCount: 1 });

      mockK8s.provision.mockRejectedValueOnce(new Error('K8s provisioning failed'));

      await expect(service.create(mockCreateInput)).rejects.toThrow('K8s provisioning failed');
    });
  });

  describe('list', () => {
    it('should return all environments', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [dbRecord()],
        rowCount: 1,
      });

      const result = await service.list();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('env-123');
    });

    it('should filter by prId', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

      await service.list({ prId: 'pr-1' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining(['pr-1'])
      );
    });

    it('should filter by status', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

      await service.list({ statusFilter: 'running' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining(['running'])
      );
    });
  });

  describe('getById', () => {
    it('should return environment when found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [dbRecord()],
        rowCount: 1,
      });

      const result = await service.getById('env-123');

      expect(result.id).toBe('env-123');
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM ephemeral_environments WHERE id = $1',
        ['env-123']
      );
    });

    it('should throw error when not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(service.getById('nonexistent')).rejects.toThrow(
        'Ephemeral environment "nonexistent" not found'
      );
    });
  });

  describe('wake', () => {
    it('should wake an idle environment', async () => {
      const idleRec = dbRecord({ status: 'idle', idle_since: new Date() });
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [idleRec], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [dbRecord({ status: 'running', idle_since: null })], rowCount: 1 });

      const result = await service.wake('env-123');

      expect(result.status).toBe('running');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'ephemeral-env.woken',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should throw error if environment not idle', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [dbRecord({ status: 'running' })], rowCount: 1 });

      await expect(service.wake('env-123')).rejects.toThrow(
        'Environment is not idle (status: running)'
      );
    });

    it('should throw error if environment not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(service.wake('nonexistent')).rejects.toThrow(
        'Ephemeral environment "nonexistent" not found'
      );
    });
  });

  describe('teardown', () => {
    it('should teardown a running environment', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [dbRecord({ status: 'running' })], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [dbRecord({ status: 'tearing_down' })], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [dbRecord({ status: 'destroyed' })], rowCount: 1 });

      const result = await service.teardown('env-123', 'manual');

      expect(result.status).toBe('destroyed');
      expect(mockK8s.teardown).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'ephemeral-env.destroyed',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should throw error if already destroyed', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [dbRecord({ status: 'destroyed' })], rowCount: 1 });

      await expect(service.teardown('env-123')).rejects.toThrow(
        'Environment already destroyed'
      );
    });
  });

  describe('setIdle', () => {
    it('should set a running environment to idle', async () => {
      const idleTime = new Date();
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [dbRecord({ status: 'running' })], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [dbRecord({ status: 'idle', idle_since: idleTime })], rowCount: 1 });

      const result = await service.setIdle('env-123');

      expect(result.status).toBe('idle');
      expect(result.idleSince).toBeDefined();
    });

    it('should throw error if environment not running', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [dbRecord({ status: 'idle' })], rowCount: 1 });

      await expect(service.setIdle('env-123')).rejects.toThrow(
        'Environment must be running to set idle (status: idle)'
      );
    });
  });

  describe('cleanupIdleEnvironments', () => {
    it('should destroy idle environments past cutoff', async () => {
      const oldIdleRec = dbRecord({
        id: 'env-old',
        status: 'idle',
        idle_since: new Date(Date.now() - 3 * 60 * 60 * 1000),
      });
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [oldIdleRec], rowCount: 1 }) // findIdleBefore
        .mockResolvedValueOnce({ rows: [oldIdleRec], rowCount: 1 }) // teardown: getById
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // teardown: update tearing_down
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // teardown: update destroyed

      const result = await service.cleanupIdleEnvironments(2);

      expect(result).toContain('env-old');
    });

    it('should not destroy recent idle environments', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await service.cleanupIdleEnvironments(2);

      expect(result).toEqual([]);
    });
  });

  describe('getCost', () => {
    it('should calculate cost for a running environment', async () => {
      const envRec = dbRecord({
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
        auto_destroy_at: new Date(Date.now() + 22 * 60 * 60 * 1000),
      });
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [envRec], rowCount: 1 });

      const result = await service.getCost('env-123');

      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.breakdown).toHaveProperty('cpuCost');
      expect(result.breakdown).toHaveProperty('memoryCost');
      expect(result.breakdown).toHaveProperty('storageCost');
      expect(result.durationHours).toBeGreaterThan(0);
    });

    it('should throw error if environment not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(service.getCost('nonexistent')).rejects.toThrow(
        'Ephemeral environment "nonexistent" not found'
      );
    });
  });

  describe('getPreviewUrl', () => {
    it('should return preview url', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [dbRecord()], rowCount: 1 });

      const result = await service.getPreviewUrl('env-123');

      expect(result).toBe('https://eph-repo-1-pr-1-abc123.dev.orion.internal');
    });

    it('should throw error if preview url not available', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [dbRecord({ preview_url: null })], rowCount: 1 });

      await expect(service.getPreviewUrl('env-123')).rejects.toThrow(
        'Preview URL not available'
      );
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [dbRecord({ status: 'running' })],
        rowCount: 1,
      });
      mockK8s.checkHealth.mockResolvedValue(true);

      const result = await service.checkHealth('env-123');

      expect(result.healthy).toBe(true);
    });

    it('should return unhealthy if namespace not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [dbRecord({ status: 'running' })],
        rowCount: 1,
      });
      mockK8s.checkHealth.mockResolvedValue(false);

      const result = await service.checkHealth('env-123');

      expect(result.healthy).toBe(false);
    });
  });
});

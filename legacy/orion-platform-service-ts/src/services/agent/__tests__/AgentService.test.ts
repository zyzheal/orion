/**
 * AgentService Tests - Test agent task scheduling, status tracking
 */

import { AgentService, AgentServiceError } from '../AgentService';
import { AgentRepository, AgentProfile, AgentRun } from '../AgentRepository';

describe('AgentService', () => {
  let mockRepository: jest.Mocked<AgentRepository>;
  let service: AgentService;

  beforeEach(() => {
    mockRepository = {
      findProfileById: jest.fn(),
      findAllProfiles: jest.fn(),
      createProfile: jest.fn(),
      createRun: jest.fn(),
      completeRun: jest.fn(),
      failRun: jest.fn(),
      getRunHistory: jest.fn(),
    } as unknown as jest.Mocked<AgentRepository>;

    service = new AgentService(mockRepository);
  });

  describe('createProfile', () => {
    it('should create a new agent profile', async () => {
      const mockProfile: AgentProfile = {
        id: 'agent-1',
        tenant_id: 'tenant-1',
        name: 'test-agent',
        type: 'code-review',
        capabilities: ['review', 'suggest'],
        config: {},
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.createProfile.mockResolvedValue(mockProfile);

      const result = await service.createProfile('tenant-1', 'test-agent', 'code-review', ['review', 'suggest']);

      expect(result).toEqual(mockProfile);
      expect(mockRepository.createProfile).toHaveBeenCalledWith(
        'tenant-1', 'test-agent', 'code-review', ['review', 'suggest'], undefined
      );
    });

    it('should create profile with config', async () => {
      const mockProfile: AgentProfile = {
        id: 'agent-2',
        tenant_id: 'tenant-1',
        name: 'configured-agent',
        type: 'build',
        capabilities: ['build'],
        config: { timeout: 300, retries: 3 },
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.createProfile.mockResolvedValue(mockProfile);

      await service.createProfile('tenant-1', 'configured-agent', 'build', ['build'], { timeout: 300, retries: 3 });

      expect(mockRepository.createProfile).toHaveBeenCalledWith(
        'tenant-1', 'configured-agent', 'build', ['build'], { timeout: 300, retries: 3 }
      );
    });

    it('should throw when tenantId is missing', async () => {
      await expect(service.createProfile('', 'agent', 'type', []))
        .rejects
        .toThrow(AgentServiceError);

      await expect(service.createProfile('', 'agent', 'type', []))
        .rejects
        .toThrow('Tenant ID and name required');
    });

    it('should throw when name is missing', async () => {
      await expect(service.createProfile('tenant-1', '', 'type', []))
        .rejects
        .toThrow('Tenant ID and name required');
    });
  });

  describe('listProfiles', () => {
    it('should return all profiles for a tenant', async () => {
      const mockProfiles: AgentProfile[] = [
        { id: 'agent-1', tenant_id: 'tenant-1', name: 'agent-a', type: 'review', capabilities: [], config: {}, status: 'active', created_at: new Date(), updated_at: new Date() },
        { id: 'agent-2', tenant_id: 'tenant-1', name: 'agent-b', type: 'build', capabilities: [], config: {}, status: 'active', created_at: new Date(), updated_at: new Date() },
      ];
      mockRepository.findAllProfiles.mockResolvedValue(mockProfiles);

      const result = await service.listProfiles('tenant-1');

      expect(result).toEqual(mockProfiles);
    });

    it('should return empty array when no profiles', async () => {
      mockRepository.findAllProfiles.mockResolvedValue([]);

      const result = await service.listProfiles('tenant-1');

      expect(result).toEqual([]);
    });
  });

  describe('runAgent', () => {
    it('should run an active agent and complete successfully', async () => {
      const mockProfile: AgentProfile = {
        id: 'agent-1',
        tenant_id: 'tenant-1',
        name: 'active-agent',
        type: 'code-review',
        capabilities: ['review'],
        config: {},
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };
      const mockRun: AgentRun = {
        id: 'run-1',
        agent_id: 'agent-1',
        task: 'review code',
        input: { files: ['main.ts'] },
        output: null,
        status: 'running',
        error: null,
        started_at: new Date(),
        completed_at: null,
        created_at: new Date(),
      };
      const completedRun: AgentRun = {
        ...mockRun,
        output: { result: 'Task completed: review code', agent: 'active-agent' },
        status: 'completed',
        completed_at: new Date(),
      };

      mockRepository.findProfileById.mockResolvedValue(mockProfile);
      mockRepository.createRun.mockResolvedValue(mockRun);
      mockRepository.completeRun.mockResolvedValue(completedRun);

      const result = await service.runAgent('agent-1', 'review code', { files: ['main.ts'] });

      expect(result.status).toBe('completed');
      expect(mockRepository.createRun).toHaveBeenCalledWith('agent-1', 'review code', { files: ['main.ts'] });
      expect(mockRepository.completeRun).toHaveBeenCalled();
    });

    it('should throw when agent not found', async () => {
      mockRepository.findProfileById.mockResolvedValue(null);

      await expect(service.runAgent('non-existent', 'task', {}))
        .rejects
        .toThrow(AgentServiceError);

      await expect(service.runAgent('non-existent', 'task', {}))
        .rejects
        .toThrow('Agent not found: non-existent');
    });

    it('should throw when agent is not active', async () => {
      const inactiveProfile: AgentProfile = {
        id: 'agent-1',
        tenant_id: 'tenant-1',
        name: 'inactive-agent',
        type: 'review',
        capabilities: [],
        config: {},
        status: 'inactive',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockRepository.findProfileById.mockResolvedValue(inactiveProfile);

      await expect(service.runAgent('agent-1', 'task', {}))
        .rejects
        .toThrow('Agent is not active');
    });

    it('should fail run when execution throws', async () => {
      const mockProfile: AgentProfile = {
        id: 'agent-1',
        tenant_id: 'tenant-1',
        name: 'failing-agent',
        type: 'review',
        capabilities: [],
        config: {},
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };
      const mockRun: AgentRun = {
        id: 'run-1',
        agent_id: 'agent-1',
        task: 'fail task',
        input: {},
        output: null,
        status: 'running',
        error: null,
        started_at: new Date(),
        completed_at: null,
        created_at: new Date(),
      };
      const failedRun: AgentRun = {
        ...mockRun,
        status: 'failed',
        error: 'Execution error',
        completed_at: new Date(),
      };

      mockRepository.findProfileById.mockResolvedValue(mockProfile);
      mockRepository.createRun.mockResolvedValue(mockRun);
      // Mock completeRun to throw, simulating a failure
      mockRepository.completeRun.mockRejectedValue(new Error('Execution error'));
      mockRepository.failRun.mockResolvedValue(failedRun);

      const result = await service.runAgent('agent-1', 'fail task', {});

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Execution error');
      expect(mockRepository.failRun).toHaveBeenCalledWith('run-1', 'Execution error');
    });
  });

  describe('getRunHistory', () => {
    it('should return run history for an agent', async () => {
      const mockRuns: AgentRun[] = [
        { id: 'run-1', agent_id: 'agent-1', task: 'task1', input: {}, output: { result: 'ok' }, status: 'completed', error: null, started_at: new Date(), completed_at: new Date(), created_at: new Date() },
        { id: 'run-2', agent_id: 'agent-1', task: 'task2', input: {}, output: { result: 'ok2' }, status: 'completed', error: null, started_at: new Date(), completed_at: new Date(), created_at: new Date() },
      ];
      mockRepository.getRunHistory.mockResolvedValue(mockRuns);

      const result = await service.getRunHistory('agent-1');

      expect(result).toEqual(mockRuns);
      expect(mockRepository.getRunHistory).toHaveBeenCalledWith('agent-1', undefined);
    });

    it('should respect limit parameter', async () => {
      mockRepository.getRunHistory.mockResolvedValue([]);

      await service.getRunHistory('agent-1', 5);

      expect(mockRepository.getRunHistory).toHaveBeenCalledWith('agent-1', 5);
    });
  });
});

describe('AgentRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: AgentRepository;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new AgentRepository(mockDb as any);
  });

  describe('findProfileById', () => {
    it('should return profile when found', async () => {
      const mockRow = { id: 'agent-1', name: 'test', type: 'review' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findProfileById('agent-1');

      expect(result).toEqual(mockRow);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findProfileById('missing');

      expect(result).toBeNull();
    });
  });

  describe('createProfile', () => {
    it('should insert a new profile with active status', async () => {
      const mockRow = { id: 'agent-new', name: 'new-agent', status: 'active' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.createProfile('tenant-1', 'new-agent', 'review', ['review']);

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO agent_profiles');
      expect(sql).toContain("'active'");
    });

    it('should use empty config when not provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'agent-new' }] });

      await repository.createProfile('tenant-1', 'new-agent', 'review', ['review']);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[4]).toEqual({}); // config
    });
  });

  describe('createRun', () => {
    it('should create a new run with running status', async () => {
      const mockRow = { id: 'run-1', agent_id: 'agent-1', status: 'running' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.createRun('agent-1', 'test task', { input: true });

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO agent_runs');
      expect(sql).toContain("'running'");
    });
  });

  describe('completeRun', () => {
    it('should mark run as completed with output', async () => {
      const mockRow = { id: 'run-1', status: 'completed', output: { result: 'done' } };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.completeRun('run-1', { result: 'done' });

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain("status = 'completed'");
    });

    it('should return null when run not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.completeRun('missing', {});

      expect(result).toBeNull();
    });
  });

  describe('failRun', () => {
    it('should mark run as failed with error message', async () => {
      const mockRow = { id: 'run-1', status: 'failed', error: 'something broke' };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.failRun('run-1', 'something broke');

      expect(result).toEqual(mockRow);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain("status = 'failed'");
    });
  });

  describe('getRunHistory', () => {
    it('should return runs ordered by created_at desc with default limit', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getRunHistory('agent-1');

      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(sql).toContain('LIMIT $2');
      const params = mockDb.query.mock.calls[0][1];
      expect(params[1]).toBe(20); // default limit
    });

    it('should respect custom limit', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getRunHistory('agent-1', 5);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[1]).toBe(5);
    });
  });
});

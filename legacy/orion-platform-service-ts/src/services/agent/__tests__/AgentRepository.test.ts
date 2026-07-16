/**
 * AgentRepository Tests - Database layer for Agent CRUD operations
 */

import { AgentRepository, AgentProfile, AgentRun } from '../AgentRepository';

describe('AgentRepository', () => {
  let mockDb: { query: jest.Mock };
  let repository: AgentRepository;

  const mockProfile: AgentProfile = {
    id: 'agent-1',
    tenant_id: 'tenant-1',
    name: 'test-agent',
    type: 'code-review',
    capabilities: ['review', 'suggest'],
    config: { timeout: 300 },
    status: 'active',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  const mockRun: AgentRun = {
    id: 'run-1',
    agent_id: 'agent-1',
    task: 'review code',
    input: { files: ['main.ts'] },
    output: null,
    status: 'running',
    error: null,
    started_at: new Date('2026-01-01'),
    completed_at: null,
    created_at: new Date('2026-01-01'),
  };

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repository = new AgentRepository(mockDb as any);
  });

  // ==================== findProfileById ====================

  describe('findProfileById', () => {
    it('should return profile when found', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockProfile] });

      const result = await repository.findProfileById('agent-1');

      expect(result).toEqual(mockProfile);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM agent_profiles WHERE id = $1',
        ['agent-1'],
      );
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findProfileById('non-existent');

      expect(result).toBeNull();
    });

    it('should propagate database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('DB connection failed'));

      await expect(repository.findProfileById('agent-1')).rejects.toThrow('DB connection failed');
    });
  });

  // ==================== findAllProfiles ====================

  describe('findAllProfiles', () => {
    it('should return all profiles for a tenant', async () => {
      const profiles = [
        mockProfile,
        { ...mockProfile, id: 'agent-2', name: 'agent-2' },
      ];
      mockDb.query.mockResolvedValue({ rows: profiles });

      const result = await repository.findAllProfiles('tenant-1');

      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM agent_profiles WHERE tenant_id = $1',
        ['tenant-1'],
      );
    });

    it('should return empty array when no profiles exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.findAllProfiles('tenant-empty');

      expect(result).toEqual([]);
    });

    it('should enforce tenant isolation by passing tenantId as parameter', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.findAllProfiles('tenant-2');

      const params = mockDb.query.mock.calls[0][1];
      expect(params[0]).toBe('tenant-2');
    });
  });

  // ==================== createProfile ====================

  describe('createProfile', () => {
    it('should insert a new profile with active status', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockProfile] });

      const result = await repository.createProfile('tenant-1', 'test-agent', 'code-review', ['review', 'suggest']);

      expect(result).toEqual(mockProfile);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO agent_profiles');
      expect(sql).toContain("'active'");
      expect(sql).toContain('RETURNING *');
    });

    it('should use empty config object when config is not provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockProfile] });

      await repository.createProfile('tenant-1', 'test-agent', 'review', ['review']);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[4]).toEqual({}); // config defaults to {}
    });

    it('should pass config when provided', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockProfile] });
      const config = { timeout: 300, retries: 3 };

      await repository.createProfile('tenant-1', 'test-agent', 'review', ['review'], config);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[4]).toEqual(config);
    });

    it('should pass all parameters in correct order', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockProfile] });

      await repository.createProfile('tenant-1', 'agent-name', 'build', ['build', 'test'], { key: 'value' });

      const params = mockDb.query.mock.calls[0][1];
      expect(params[0]).toBe('tenant-1');
      expect(params[1]).toBe('agent-name');
      expect(params[2]).toBe('build');
      expect(params[3]).toEqual(['build', 'test']);
      expect(params[4]).toEqual({ key: 'value' });
    });
  });

  // ==================== createRun ====================

  describe('createRun', () => {
    it('should create a new run with running status', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockRun] });

      const result = await repository.createRun('agent-1', 'review code', { files: ['main.ts'] });

      expect(result).toEqual(mockRun);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO agent_runs');
      expect(sql).toContain("'running'");
      expect(sql).toContain('RETURNING *');
    });

    it('should pass agentId, task, and input as parameters', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockRun] });

      await repository.createRun('agent-1', 'build project', { branch: 'main' });

      const params = mockDb.query.mock.calls[0][1];
      expect(params[0]).toBe('agent-1');
      expect(params[1]).toBe('build project');
      expect(params[2]).toEqual({ branch: 'main' });
    });

    it('should handle empty input object', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockRun] });

      await repository.createRun('agent-1', 'task', {});

      const params = mockDb.query.mock.calls[0][1];
      expect(params[2]).toEqual({});
    });
  });

  // ==================== completeRun ====================

  describe('completeRun', () => {
    it('should mark run as completed with output', async () => {
      const completedRun = { ...mockRun, status: 'completed', output: { result: 'done' } };
      mockDb.query.mockResolvedValue({ rows: [completedRun] });

      const result = await repository.completeRun('run-1', { result: 'done' });

      expect(result).toEqual(completedRun);
      expect(result?.status).toBe('completed');
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain("status = 'completed'");
      expect(sql).toContain('completed_at = NOW()');
      expect(sql).toContain('RETURNING *');
    });

    it('should return null when run not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.completeRun('non-existent', {});

      expect(result).toBeNull();
    });

    it('should pass output and id as parameters', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockRun] });
      const output = { summary: 'All tests passed', score: 95 };

      await repository.completeRun('run-1', output);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[0]).toEqual(output);
      expect(params[1]).toBe('run-1');
    });
  });

  // ==================== failRun ====================

  describe('failRun', () => {
    it('should mark run as failed with error message', async () => {
      const failedRun = { ...mockRun, status: 'failed', error: 'timeout exceeded' };
      mockDb.query.mockResolvedValue({ rows: [failedRun] });

      const result = await repository.failRun('run-1', 'timeout exceeded');

      expect(result).toEqual(failedRun);
      expect(result?.status).toBe('failed');
      expect(result?.error).toBe('timeout exceeded');
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain("status = 'failed'");
      expect(sql).toContain('completed_at = NOW()');
    });

    it('should return null when run not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.failRun('non-existent', 'error');

      expect(result).toBeNull();
    });

    it('should pass error message and id as parameters', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockRun] });

      await repository.failRun('run-1', 'out of memory');

      const params = mockDb.query.mock.calls[0][1];
      expect(params[0]).toBe('out of memory');
      expect(params[1]).toBe('run-1');
    });

    it('should handle empty error string', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ ...mockRun, status: 'failed', error: '' }] });

      const result = await repository.failRun('run-1', '');

      expect(result?.error).toBe('');
    });
  });

  // ==================== getRunHistory ====================

  describe('getRunHistory', () => {
    it('should return runs ordered by created_at desc with default limit of 20', async () => {
      const runs = [mockRun, { ...mockRun, id: 'run-2' }];
      mockDb.query.mockResolvedValue({ rows: runs });

      const result = await repository.getRunHistory('agent-1');

      expect(result).toHaveLength(2);
      const sql = mockDb.query.mock.calls[0][0];
      expect(sql).toContain('WHERE agent_id = $1');
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(sql).toContain('LIMIT $2');
      const params = mockDb.query.mock.calls[0][1];
      expect(params[1]).toBe(20); // default limit
    });

    it('should respect custom limit parameter', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getRunHistory('agent-1', 5);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[1]).toBe(5);
    });

    it('should return empty array when no runs exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repository.getRunHistory('agent-1');

      expect(result).toEqual([]);
    });

    it('should pass agentId as first parameter', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repository.getRunHistory('agent-abc', 10);

      const params = mockDb.query.mock.calls[0][1];
      expect(params[0]).toBe('agent-abc');
    });
  });
});

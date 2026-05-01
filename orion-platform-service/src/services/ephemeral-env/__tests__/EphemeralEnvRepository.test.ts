/**
 * EphemeralEnvRepository Unit Tests
 */

import { EphemeralEnvRepository } from '../EphemeralEnvRepository';

// Mock DatabasePool
class MockDatabasePool {
  query = jest.fn();
}

describe('EphemeralEnvRepository', () => {
  let repository: EphemeralEnvRepository;
  let mockPool: MockDatabasePool;

  const mockRecord = {
    id: 'env-123',
    pr_id: 'pr-1',
    repo_id: 'repo-1',
    branch_name: 'feature/test',
    namespace: 'eph-repo-1-pr-1-abc123',
    status: 'running',
    preview_url: 'https://eph-repo-1-pr-1-abc123.dev.orion.internal',
    commit_sha: 'abc123def456',
    resources: { cpu: '2', memory: '4Gi', storage: '10Gi' },
    services: [{ name: 'api', image: 'node:18', replicas: 1, healthy: true }],
    created_by: 'user-1',
    created_at: new Date('2026-04-30T10:00:00Z'),
    idle_since: null,
    auto_destroy_at: new Date('2026-05-01T10:00:00Z'),
    destroyed_at: null,
    destroy_reason: null,
  };

  beforeEach(() => {
    mockPool = new MockDatabasePool();
    repository = new EphemeralEnvRepository(mockPool as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return environment when found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [mockRecord],
        rowCount: 1,
      });

      const result = await repository.findById('env-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('env-123');
      expect(result?.prId).toBe('pr-1');
      expect(result?.repoId).toBe('repo-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM ephemeral_environments WHERE id = $1',
        ['env-123']
      );
    });

    it('should return null when not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all environments ordered by created_at DESC', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [mockRecord],
        rowCount: 1,
      });

      const result = await repository.findAll();

      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM ephemeral_environments  ORDER BY created_at DESC',
        []
      );
    });

    it('should filter by prId', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.findAll({ prId: 'pr-1' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE pr_id = $1'),
        ['pr-1']
      );
    });

    it('should filter by repoId', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.findAll({ repoId: 'repo-1' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE repo_id = $1'),
        ['repo-1']
      );
    });

    it('should filter by status', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.findAll({ statusFilter: 'running' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['running']
      );
    });

    it('should combine multiple filters', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.findAll({ prId: 'pr-1', statusFilter: 'running' });

      const callArgs = (mockPool.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('pr_id = $1');
      expect(callArgs[0]).toContain('status = $2');
    });
  });

  describe('findByPrAndRepo', () => {
    it('should find non-destroyed environment for PR and repo', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [mockRecord],
        rowCount: 1,
      });

      const result = await repository.findByPrAndRepo('pr-1', 'repo-1');

      expect(result).not.toBeNull();
      expect(result?.prId).toBe('pr-1');
    });

    it('should return null when no matching environment', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repository.findByPrAndRepo('pr-1', 'repo-1');

      expect(result).toBeNull();
    });

    it('should use custom exclude statuses', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

      await repository.findByPrAndRepo('pr-1', 'repo-1', ['destroyed', 'tearing_down']);

      const callArgs = (mockPool.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('NOT IN ($3, $4)');
    });
  });

  describe('create', () => {
    it('should insert environment and return created record', async () => {
      const env: any = {
        id: 'new-env',
        prId: 'pr-2',
        repoId: 'repo-2',
        branchName: 'feature/new',
        namespace: 'eph-repo-2-pr-2-xyz',
        status: 'provisioning',
        previewUrl: 'https://eph-repo-2-pr-2-xyz.dev.orion.internal',
        commitSha: 'xyz789',
        resources: { cpu: '2', memory: '4Gi', storage: '10Gi' },
        services: [],
        createdBy: 'user-2',
        createdAt: new Date(),
        autoDestroyAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [{ ...mockRecord, id: 'new-env', pr_id: 'pr-2' }],
        rowCount: 1,
      });

      const result = await repository.create({ prId: 'pr-2', repoId: 'repo-2', branchName: 'feature/new' }, env);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ephemeral_environments'),
        expect.arrayContaining(['new-env', 'pr-2', 'repo-2'])
      );
      expect(result.id).toBe('new-env');
    });
  });

  describe('update', () => {
    it('should update status and return updated record', async () => {
      const updatedRecord = { ...mockRecord, status: 'idle', idle_since: new Date() };
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [updatedRecord],
        rowCount: 1,
      });

      const result = await repository.update('env-123', { status: 'idle' });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ephemeral_environments SET status = $1'),
        expect.arrayContaining(['idle', 'env-123'])
      );
      expect(result?.status).toBe('idle');
    });

    it('should update multiple fields', async () => {
      const now = new Date();
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [{ ...mockRecord, status: 'idle', idle_since: now }],
        rowCount: 1,
      });

      await repository.update('env-123', { status: 'idle', idleSince: now });

      const callArgs = (mockPool.query as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('status = $1');
      expect(callArgs[0]).toContain('idle_since = $2');
    });

    it('should return original if no updates provided', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockRecord], rowCount: 1 });

      const result = await repository.update('env-123', {});

      expect(result?.id).toBe('env-123');
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM ephemeral_environments WHERE id = $1',
        ['env-123']
      );
    });

    it('should return null if record not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await repository.update('nonexistent', { status: 'idle' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete environment and return true', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 1,
      });

      const result = await repository.delete('env-123');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM ephemeral_environments WHERE id = $1',
        ['env-123']
      );
    });

    it('should return false when environment not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await repository.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('findIdleBefore', () => {
    it('should find idle environments before cutoff', async () => {
      const cutoff = new Date('2026-04-30T08:00:00Z');
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [mockRecord],
        rowCount: 1,
      });

      const result = await repository.findIdleBefore(cutoff);

      expect(result).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT * FROM ephemeral_environments WHERE status = 'idle' AND idle_since < $1 ORDER BY idle_since ASC",
        [cutoff]
      );
    });

    it('should return empty array when no idle environments', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await repository.findIdleBefore(new Date());

      expect(result).toEqual([]);
    });
  });
});

/**
 * Tests for ArtifactRepository (service-local DB layer)
 * Covers all 5 methods: findById, findAll, findByName, create, delete
 */

import { ArtifactRepository, Artifact } from '../ArtifactRepository';

function makeDbMock() {
  return {
    query: jest.fn(),
  };
}

function makeDbRow(overrides: Record<string, any> = {}) {
  return {
    id: 'row-001',
    tenant_id: 'tenant-1',
    name: 'my-app',
    version: '1.0.0',
    type: 'DOCKER_IMAGE',
    size_bytes: 2048,
    checksum: 'sha256:abc',
    storage_location: '/storage/my-app-1.0.0',
    metadata: { build: '42' },
    created_at: new Date('2026-01-15'),
    ...overrides,
  };
}

describe('ArtifactRepository (service-local)', () => {
  let repo: ArtifactRepository;
  let mockDb: ReturnType<typeof makeDbMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = makeDbMock();
    repo = new ArtifactRepository(mockDb as any);
  });

  // ==================== findById ====================
  describe('findById', () => {
    it('should return artifact when found', async () => {
      const row = makeDbRow();
      mockDb.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const result = await repo.findById('row-001');

      expect(result).toEqual(row);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM artifacts WHERE id = $1',
        ['row-001'],
      );
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should propagate database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection refused'));

      await expect(repo.findById('row-001')).rejects.toThrow('Connection refused');
    });
  });

  // ==================== findAll ====================
  describe('findAll', () => {
    it('should return all artifacts for a tenant', async () => {
      const rows = [makeDbRow({ id: 'a1' }), makeDbRow({ id: 'a2' })];
      mockDb.query.mockResolvedValue({ rows, rowCount: 2 });

      const result = await repo.findAll('tenant-1');

      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM artifacts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
        ['tenant-1', 50],
      );
    });

    it('should use custom limit', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findAll('tenant-1', 10);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['tenant-1', 10],
      );
    });

    it('should default limit to 50', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findAll('tenant-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['tenant-1', 50],
      );
    });

    it('should return empty array when no artifacts match', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findAll('empty-tenant');

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Table not found'));

      await expect(repo.findAll('tenant-1')).rejects.toThrow('Table not found');
    });
  });

  // ==================== findByName ====================
  describe('findByName', () => {
    it('should return artifacts matching tenant and name', async () => {
      const rows = [makeDbRow({ version: '1.0.0' }), makeDbRow({ id: 'a2', version: '2.0.0' })];
      mockDb.query.mockResolvedValue({ rows, rowCount: 2 });

      const result = await repo.findByName('tenant-1', 'my-app');

      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM artifacts WHERE tenant_id = $1 AND name = $2 ORDER BY created_at DESC',
        ['tenant-1', 'my-app'],
      );
    });

    it('should return empty array when no match', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findByName('tenant-1', 'nonexistent');

      expect(result).toEqual([]);
    });

    it('should propagate database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Query timeout'));

      await expect(repo.findByName('tenant-1', 'my-app')).rejects.toThrow('Query timeout');
    });
  });

  // ==================== create ====================
  describe('create', () => {
    it('should insert and return the created artifact', async () => {
      const row = makeDbRow();
      mockDb.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const result = await repo.create(
        'tenant-1', 'my-app', '1.0.0', 'DOCKER_IMAGE',
        2048, 'sha256:abc', '/storage/my-app-1.0.0', { build: '42' },
      );

      expect(result).toEqual(row);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO artifacts'),
        ['tenant-1', 'my-app', '1.0.0', 'DOCKER_IMAGE', 2048, 'sha256:abc', '/storage/my-app-1.0.0', { build: '42' }],
      );
    });

    it('should default metadata to empty object when not provided', async () => {
      const row = makeDbRow({ metadata: {} });
      mockDb.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      await repo.create('tenant-1', 'my-app', '1.0.0', 'DOCKER_IMAGE', 2048, 'sha256:abc', '/storage/my-app-1.0.0');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO artifacts'),
        expect.arrayContaining([{}]),
      );
    });

    it('should propagate database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Unique violation'));

      await expect(
        repo.create('tenant-1', 'my-app', '1.0.0', 'DOCKER_IMAGE', 2048, 'sha256:abc', '/storage/path'),
      ).rejects.toThrow('Unique violation');
    });
  });

  // ==================== delete ====================
  describe('delete', () => {
    it('should return true when a row is deleted', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const result = await repo.delete('row-001');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM artifacts WHERE id = $1',
        ['row-001'],
      );
    });

    it('should return false when no row is deleted', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.delete('nonexistent');

      expect(result).toBe(false);
    });

    it('should propagate database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('FK constraint'));

      await expect(repo.delete('row-001')).rejects.toThrow('FK constraint');
    });
  });
});

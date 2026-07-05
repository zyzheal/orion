/**
 * Tests for ArtifactService (business logic layer)
 * Covers all 5 methods + ArtifactServiceError: getArtifact, listArtifacts,
 * searchByName, uploadArtifact, deleteArtifact
 */

import { ArtifactService, ArtifactServiceError } from '../ArtifactService';
import { Artifact } from '../ArtifactRepository';

function makeArtifact(overrides: Partial<Artifact> = {}) {
  return {
    id: 'art-001',
    tenant_id: 'tenant-1',
    name: 'my-app',
    version: '1.0.0',
    type: 'DOCKER_IMAGE',
    size_bytes: 1024,
    checksum: 'sha256:abc',
    storage_location: '/storage/my-app-1.0.0',
    metadata: {},
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeMockRepo() {
  return {
    findById: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    findByName: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    delete: jest.fn().mockResolvedValue(true),
  };
}

describe('ArtifactService', () => {
  let service: ArtifactService;
  let mockRepo: ReturnType<typeof makeMockRepo>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = makeMockRepo();
    service = new ArtifactService(mockRepo as any);
  });

  // ==================== ArtifactServiceError ====================
  describe('ArtifactServiceError', () => {
    it('should have correct name and code', () => {
      const error = new ArtifactServiceError('test message', 'TEST_CODE');

      expect(error.name).toBe('ArtifactServiceError');
      expect(error.message).toBe('test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error).toBeInstanceOf(Error);
    });
  });

  // ==================== getArtifact ====================
  describe('getArtifact', () => {
    it('should return artifact when found', async () => {
      const artifact = makeArtifact();
      mockRepo.findById.mockResolvedValue(artifact);

      const result = await service.getArtifact('art-001');

      expect(result).toEqual(artifact);
      expect(mockRepo.findById).toHaveBeenCalledWith('art-001');
    });

    it('should throw ArtifactServiceError when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.getArtifact('nonexistent')).rejects.toThrow(ArtifactServiceError);
      await expect(service.getArtifact('nonexistent')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('should propagate repository errors', async () => {
      mockRepo.findById.mockRejectedValue(new Error('DB connection failed'));

      await expect(service.getArtifact('art-001')).rejects.toThrow('DB connection failed');
    });
  });

  // ==================== listArtifacts ====================
  describe('listArtifacts', () => {
    it('should return artifacts from repository', async () => {
      const artifacts = [makeArtifact({ id: 'a1' }), makeArtifact({ id: 'a2' })];
      mockRepo.findAll.mockResolvedValue(artifacts);

      const result = await service.listArtifacts('tenant-1');

      expect(result).toHaveLength(2);
      expect(mockRepo.findAll).toHaveBeenCalledWith('tenant-1', undefined);
    });

    it('should pass limit to repository', async () => {
      mockRepo.findAll.mockResolvedValue([]);

      await service.listArtifacts('tenant-1', 25);

      expect(mockRepo.findAll).toHaveBeenCalledWith('tenant-1', 25);
    });

    it('should work without limit', async () => {
      mockRepo.findAll.mockResolvedValue([]);

      await service.listArtifacts('tenant-1');

      expect(mockRepo.findAll).toHaveBeenCalledWith('tenant-1', undefined);
    });

    it('should return empty array when no artifacts', async () => {
      mockRepo.findAll.mockResolvedValue([]);

      const result = await service.listArtifacts('empty-tenant');

      expect(result).toEqual([]);
    });

    it('should propagate repository errors', async () => {
      mockRepo.findAll.mockRejectedValue(new Error('Query failed'));

      await expect(service.listArtifacts('tenant-1')).rejects.toThrow('Query failed');
    });
  });

  // ==================== searchByName ====================
  describe('searchByName', () => {
    it('should return matching artifacts', async () => {
      const artifacts = [makeArtifact()];
      mockRepo.findByName.mockResolvedValue(artifacts);

      const result = await service.searchByName('tenant-1', 'my-app');

      expect(result).toEqual(artifacts);
      expect(mockRepo.findByName).toHaveBeenCalledWith('tenant-1', 'my-app');
    });

    it('should return empty array for no matches', async () => {
      mockRepo.findByName.mockResolvedValue([]);

      const result = await service.searchByName('tenant-1', 'nonexistent');

      expect(result).toEqual([]);
    });

    it('should propagate repository errors', async () => {
      mockRepo.findByName.mockRejectedValue(new Error('DB error'));

      await expect(service.searchByName('tenant-1', 'my-app')).rejects.toThrow('DB error');
    });
  });

  // ==================== uploadArtifact ====================
  describe('uploadArtifact', () => {
    it('should create artifact with valid inputs', async () => {
      const created = makeArtifact();
      mockRepo.create.mockResolvedValue(created);

      const result = await service.uploadArtifact(
        'tenant-1', 'my-app', '1.0.0', 'DOCKER_IMAGE',
        1024, 'sha256:abc', '/storage/my-app-1.0.0',
      );

      expect(result).toEqual(created);
      expect(mockRepo.create).toHaveBeenCalledWith(
        'tenant-1', 'my-app', '1.0.0', 'DOCKER_IMAGE',
        1024, 'sha256:abc', '/storage/my-app-1.0.0', undefined,
      );
    });

    it('should pass metadata when provided', async () => {
      const created = makeArtifact();
      mockRepo.create.mockResolvedValue(created);

      await service.uploadArtifact(
        'tenant-1', 'my-app', '1.0.0', 'DOCKER_IMAGE',
        1024, 'sha256:abc', '/storage/path', { build: '42' },
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        'tenant-1', 'my-app', '1.0.0', 'DOCKER_IMAGE',
        1024, 'sha256:abc', '/storage/path', { build: '42' },
      );
    });

    it('should throw when tenantId is empty', async () => {
      await expect(
        service.uploadArtifact('', 'my-app', '1.0.0', 'DOCKER_IMAGE', 1024, 'sha', '/path'),
      ).rejects.toThrow(ArtifactServiceError);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should throw when name is empty', async () => {
      await expect(
        service.uploadArtifact('tenant-1', '', '1.0.0', 'DOCKER_IMAGE', 1024, 'sha', '/path'),
      ).rejects.toThrow(ArtifactServiceError);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should throw when version is empty', async () => {
      await expect(
        service.uploadArtifact('tenant-1', 'my-app', '', 'DOCKER_IMAGE', 1024, 'sha', '/path'),
      ).rejects.toThrow(ArtifactServiceError);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should throw INVALID_INPUT code on validation failure', async () => {
      await expect(
        service.uploadArtifact('', 'my-app', '1.0.0', 'DOCKER_IMAGE', 1024, 'sha', '/path'),
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('should propagate repository errors', async () => {
      mockRepo.create.mockRejectedValue(new Error('Insert failed'));

      await expect(
        service.uploadArtifact('tenant-1', 'my-app', '1.0.0', 'DOCKER_IMAGE', 1024, 'sha', '/path'),
      ).rejects.toThrow('Insert failed');
    });
  });

  // ==================== deleteArtifact ====================
  describe('deleteArtifact', () => {
    it('should return true when artifact is deleted', async () => {
      mockRepo.delete.mockResolvedValue(true);

      const result = await service.deleteArtifact('art-001');

      expect(result).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith('art-001');
    });

    it('should return false when artifact does not exist', async () => {
      mockRepo.delete.mockResolvedValue(false);

      const result = await service.deleteArtifact('nonexistent');

      expect(result).toBe(false);
    });

    it('should propagate repository errors', async () => {
      mockRepo.delete.mockRejectedValue(new Error('FK constraint violation'));

      await expect(service.deleteArtifact('art-001')).rejects.toThrow('FK constraint violation');
    });
  });
});

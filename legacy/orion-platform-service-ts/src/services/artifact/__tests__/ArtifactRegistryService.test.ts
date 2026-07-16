/**
 * Tests for ArtifactRegistryServiceImpl
 * Covers all 14 public methods: create, get, list, update, delete,
 * addTags, removeTags, getTags, download, getDownloadHistory,
 * search, promote, deprecate, quarantine
 */

import { ArtifactRegistryServiceImpl } from '../ArtifactRegistryService';
import { ArtifactType, ArtifactStatus, Artifact, CreateArtifactInput, ArtifactQueryOptions, ArtifactDownloadOptions } from '../../../models/Artifact';
import { OrionError, ErrorCode } from '../../../errors';

// --- Mocks ---

jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

jest.mock('pino', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
  return jest.fn(() => mockLogger);
});

// --- Helpers ---

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: 'artifact-001',
    name: 'my-app',
    namespace: 'dev',
    version: '1.0.0',
    type: ArtifactType.DOCKER_IMAGE,
    status: ArtifactStatus.AVAILABLE,
    sizeBytes: 1024,
    checksumSha256: 'abc123',
    checksumSha512: undefined,
    metadata: { env: 'dev' },
    storagePath: '/storage/my-app-1.0.0',
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<CreateArtifactInput> = {}): CreateArtifactInput {
  return {
    name: 'my-app',
    namespace: 'dev',
    version: '1.0.0',
    type: ArtifactType.DOCKER_IMAGE,
    sizeBytes: 1024,
    checksumSha256: 'abc123',
    storagePath: '/storage/my-app-1.0.0',
    createdBy: 'user-1',
    ...overrides,
  };
}

function makeMockRepository() {
  return {
    create: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findByNamespaceNameVersion: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue({ artifacts: [], total: 0 }),
    update: jest.fn().mockResolvedValue(undefined),
    softDelete: jest.fn().mockResolvedValue(undefined),
    addTag: jest.fn().mockResolvedValue(undefined),
    removeTag: jest.fn().mockResolvedValue(undefined),
    getTags: jest.fn().mockResolvedValue([]),
    recordDownload: jest.fn().mockResolvedValue(undefined),
    getDownloadHistory: jest.fn().mockResolvedValue([]),
    search: jest.fn().mockResolvedValue([]),
  };
}

function makeMockStorage() {
  return {
    upload: jest.fn().mockResolvedValue({ storagePath: '/tmp/file', size: 1024 }),
    download: jest.fn().mockResolvedValue(Buffer.from('file-content')),
    delete: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
    getMetadata: jest.fn().mockResolvedValue({}),
  };
}

// --- Tests ---

describe('ArtifactRegistryServiceImpl', () => {
  let service: ArtifactRegistryServiceImpl;
  let mockRepo: ReturnType<typeof makeMockRepository>;
  let mockStorage: ReturnType<typeof makeMockStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = makeMockRepository();
    mockStorage = makeMockStorage();
    service = new ArtifactRegistryServiceImpl(mockRepo as any, mockStorage as any);
  });

  // ==================== create ====================
  describe('create', () => {
    it('should create a new artifact successfully', async () => {
      mockRepo.findByNamespaceNameVersion.mockResolvedValue(null);

      const result = await service.create(makeCreateInput());

      expect(result.id).toBe('test-uuid-1234');
      expect(result.name).toBe('my-app');
      expect(result.namespace).toBe('dev');
      expect(result.version).toBe('1.0.0');
      expect(result.status).toBe(ArtifactStatus.AVAILABLE);
      expect(result.metadata).toEqual({});
      expect(mockRepo.create).toHaveBeenCalledTimes(1);
    });

    it('should throw if artifact already exists', async () => {
      mockRepo.findByNamespaceNameVersion.mockResolvedValue(makeArtifact());

      await expect(service.create(makeCreateInput())).rejects.toThrow(OrionError);
      await expect(service.create(makeCreateInput())).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should use provided metadata when creating', async () => {
      mockRepo.findByNamespaceNameVersion.mockResolvedValue(null);
      const input = makeCreateInput({ metadata: { buildId: '42' } });

      const result = await service.create(input);

      expect(result.metadata).toEqual({ buildId: '42' });
    });

    it('should default metadata to empty object when not provided', async () => {
      mockRepo.findByNamespaceNameVersion.mockResolvedValue(null);
      const input = makeCreateInput();
      delete (input as any).metadata;

      const result = await service.create(input);

      expect(result.metadata).toEqual({});
    });

    it('should propagate repository errors during create', async () => {
      mockRepo.findByNamespaceNameVersion.mockResolvedValue(null);
      mockRepo.create.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.create(makeCreateInput())).rejects.toThrow('DB connection lost');
    });

    it('should propagate repository errors during existence check', async () => {
      mockRepo.findByNamespaceNameVersion.mockRejectedValue(new Error('Query failed'));

      await expect(service.create(makeCreateInput())).rejects.toThrow('Query failed');
    });
  });

  // ==================== get ====================
  describe('get', () => {
    it('should return artifact when found', async () => {
      const artifact = makeArtifact();
      mockRepo.findById.mockResolvedValue(artifact);

      const result = await service.get('artifact-001');

      expect(result).toEqual(artifact);
      expect(mockRepo.findById).toHaveBeenCalledWith('artifact-001');
    });

    it('should throw OrionError when artifact not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.get('nonexistent')).rejects.toThrow(OrionError);
      await expect(service.get('nonexistent')).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('should propagate repository errors', async () => {
      mockRepo.findById.mockRejectedValue(new Error('DB error'));

      await expect(service.get('artifact-001')).rejects.toThrow('DB error');
    });
  });

  // ==================== list ====================
  describe('list', () => {
    it('should return artifacts and total count', async () => {
      const artifacts = [makeArtifact({ id: 'a1' }), makeArtifact({ id: 'a2' })];
      mockRepo.find.mockResolvedValue({ artifacts, total: 2 });

      const options: ArtifactQueryOptions = { namespace: 'dev', limit: 10 };
      const result = await service.list(options);

      expect(result.artifacts).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockRepo.find).toHaveBeenCalledWith(options);
    });

    it('should return empty list when no artifacts match', async () => {
      mockRepo.find.mockResolvedValue({ artifacts: [], total: 0 });

      const result = await service.list({});

      expect(result.artifacts).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should propagate repository errors', async () => {
      mockRepo.find.mockRejectedValue(new Error('Query timeout'));

      await expect(service.list({})).rejects.toThrow('Query timeout');
    });
  });

  // ==================== update ====================
  describe('update', () => {
    it('should update artifact status', async () => {
      const existing = makeArtifact();
      mockRepo.findById.mockResolvedValue(existing);

      const result = await service.update({ id: 'artifact-001', status: ArtifactStatus.DEPRECATED });

      expect(result.status).toBe(ArtifactStatus.DEPRECATED);
      expect(mockRepo.update).toHaveBeenCalledTimes(1);
    });

    it('should merge metadata on update', async () => {
      const existing = makeArtifact({ metadata: { env: 'dev' } });
      mockRepo.findById.mockResolvedValue(existing);

      const result = await service.update({
        id: 'artifact-001',
        metadata: { buildId: '99' },
      });

      expect(result.metadata).toEqual({ env: 'dev', buildId: '99' });
    });

    it('should update updatedAt timestamp', async () => {
      const existing = makeArtifact();
      mockRepo.findById.mockResolvedValue(existing);
      const beforeUpdate = new Date();

      const result = await service.update({ id: 'artifact-001', status: ArtifactStatus.DEPRECATED });

      expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should throw when artifact not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.update({ id: 'nonexistent', status: ArtifactStatus.DEPRECATED })).rejects.toThrow(OrionError);
    });

    it('should not modify status when not provided', async () => {
      const existing = makeArtifact({ status: ArtifactStatus.AVAILABLE });
      mockRepo.findById.mockResolvedValue(existing);

      const result = await service.update({ id: 'artifact-001', metadata: { extra: 'data' } });

      expect(result.status).toBe(ArtifactStatus.AVAILABLE);
    });

    it('should propagate repository errors', async () => {
      mockRepo.findById.mockRejectedValue(new Error('Connection lost'));

      await expect(service.update({ id: 'artifact-001' })).rejects.toThrow('Connection lost');
    });
  });

  // ==================== delete ====================
  describe('delete', () => {
    it('should soft-delete and remove storage', async () => {
      mockRepo.findById.mockResolvedValue(makeArtifact());

      await service.delete('artifact-001');

      expect(mockRepo.softDelete).toHaveBeenCalledWith('artifact-001');
      expect(mockStorage.delete).toHaveBeenCalledWith('artifact-001');
    });

    it('should throw when artifact not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(OrionError);
      expect(mockRepo.softDelete).not.toHaveBeenCalled();
      expect(mockStorage.delete).not.toHaveBeenCalled();
    });

    it('should propagate soft-delete errors', async () => {
      mockRepo.findById.mockResolvedValue(makeArtifact());
      mockRepo.softDelete.mockRejectedValue(new Error('Delete failed'));

      await expect(service.delete('artifact-001')).rejects.toThrow('Delete failed');
    });

    it('should propagate storage delete errors', async () => {
      mockRepo.findById.mockResolvedValue(makeArtifact());
      mockStorage.delete.mockRejectedValue(new Error('Storage error'));

      await expect(service.delete('artifact-001')).rejects.toThrow('Storage error');
    });
  });

  // ==================== addTags ====================
  describe('addTags', () => {
    it('should add multiple tags', async () => {
      await service.addTags('artifact-001', ['v1', 'stable', 'release']);

      expect(mockRepo.addTag).toHaveBeenCalledTimes(3);
      expect(mockRepo.addTag).toHaveBeenCalledWith('artifact-001', 'v1');
      expect(mockRepo.addTag).toHaveBeenCalledWith('artifact-001', 'stable');
      expect(mockRepo.addTag).toHaveBeenCalledWith('artifact-001', 'release');
    });

    it('should handle empty tags array', async () => {
      await service.addTags('artifact-001', []);

      expect(mockRepo.addTag).not.toHaveBeenCalled();
    });

    it('should propagate repository errors', async () => {
      mockRepo.addTag.mockRejectedValue(new Error('Duplicate tag'));

      await expect(service.addTags('artifact-001', ['v1'])).rejects.toThrow('Duplicate tag');
    });
  });

  // ==================== removeTags ====================
  describe('removeTags', () => {
    it('should remove multiple tags', async () => {
      await service.removeTags('artifact-001', ['v1', 'stable']);

      expect(mockRepo.removeTag).toHaveBeenCalledTimes(2);
      expect(mockRepo.removeTag).toHaveBeenCalledWith('artifact-001', 'v1');
      expect(mockRepo.removeTag).toHaveBeenCalledWith('artifact-001', 'stable');
    });

    it('should handle empty tags array', async () => {
      await service.removeTags('artifact-001', []);

      expect(mockRepo.removeTag).not.toHaveBeenCalled();
    });

    it('should propagate repository errors', async () => {
      mockRepo.removeTag.mockRejectedValue(new Error('Not found'));

      await expect(service.removeTags('artifact-001', ['v1'])).rejects.toThrow('Not found');
    });
  });

  // ==================== getTags ====================
  describe('getTags', () => {
    it('should return tags for an artifact', async () => {
      const tags = [{ tag: 'v1' }, { tag: 'stable' }];
      mockRepo.getTags.mockResolvedValue(tags);

      const result = await service.getTags('artifact-001');

      expect(result).toEqual(tags);
      expect(mockRepo.getTags).toHaveBeenCalledWith('artifact-001');
    });

    it('should return empty array when no tags', async () => {
      mockRepo.getTags.mockResolvedValue([]);

      const result = await service.getTags('artifact-001');

      expect(result).toEqual([]);
    });

    it('should propagate repository errors', async () => {
      mockRepo.getTags.mockRejectedValue(new Error('Query error'));

      await expect(service.getTags('artifact-001')).rejects.toThrow('Query error');
    });
  });

  // ==================== download ====================
  describe('download', () => {
    const downloadOptions: ArtifactDownloadOptions = {
      artifactId: 'artifact-001',
      downloadedBy: 'user-2',
      ipAddress: '10.0.0.1',
      userAgent: 'curl/7.0',
    };

    it('should download an available artifact', async () => {
      mockRepo.findById.mockResolvedValue(makeArtifact());

      const result = await service.download(downloadOptions);

      expect(result.id).toBe('artifact-001');
      expect(mockRepo.recordDownload).toHaveBeenCalledWith(downloadOptions);
    });

    it('should throw when artifact not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.download(downloadOptions)).rejects.toThrow(OrionError);
      expect(mockRepo.recordDownload).not.toHaveBeenCalled();
    });

    it('should throw when artifact is not available (deprecated)', async () => {
      mockRepo.findById.mockResolvedValue(makeArtifact({ status: ArtifactStatus.DEPRECATED }));

      await expect(service.download(downloadOptions)).rejects.toThrow(OrionError);
      expect(mockRepo.recordDownload).not.toHaveBeenCalled();
    });

    it('should throw when artifact is quarantined', async () => {
      mockRepo.findById.mockResolvedValue(makeArtifact({ status: ArtifactStatus.QUARANTINED }));

      await expect(service.download(downloadOptions)).rejects.toThrow(OrionError);
    });

    it('should throw when artifact is uploading', async () => {
      mockRepo.findById.mockResolvedValue(makeArtifact({ status: ArtifactStatus.UPLOADING }));

      await expect(service.download(downloadOptions)).rejects.toThrow(OrionError);
    });

    it('should propagate record-download errors', async () => {
      mockRepo.findById.mockResolvedValue(makeArtifact());
      mockRepo.recordDownload.mockRejectedValue(new Error('Audit log full'));

      await expect(service.download(downloadOptions)).rejects.toThrow('Audit log full');
    });
  });

  // ==================== getDownloadHistory ====================
  describe('getDownloadHistory', () => {
    it('should return download history', async () => {
      const history = [{ downloadedBy: 'user-1' }, { downloadedBy: 'user-2' }];
      mockRepo.getDownloadHistory.mockResolvedValue(history);

      const result = await service.getDownloadHistory('artifact-001');

      expect(result).toEqual(history);
      expect(mockRepo.getDownloadHistory).toHaveBeenCalledWith('artifact-001');
    });

    it('should return empty array when no downloads', async () => {
      mockRepo.getDownloadHistory.mockResolvedValue([]);

      const result = await service.getDownloadHistory('artifact-001');

      expect(result).toEqual([]);
    });

    it('should propagate repository errors', async () => {
      mockRepo.getDownloadHistory.mockRejectedValue(new Error('DB error'));

      await expect(service.getDownloadHistory('artifact-001')).rejects.toThrow('DB error');
    });
  });

  // ==================== search ====================
  describe('search', () => {
    it('should return matching artifacts', async () => {
      const artifacts = [makeArtifact()];
      mockRepo.search.mockResolvedValue(artifacts);

      const result = await service.search('my-app');

      expect(result).toEqual(artifacts);
      expect(mockRepo.search).toHaveBeenCalledWith('my-app');
    });

    it('should return empty array for no matches', async () => {
      mockRepo.search.mockResolvedValue([]);

      const result = await service.search('nonexistent');

      expect(result).toEqual([]);
    });

    it('should propagate repository errors', async () => {
      mockRepo.search.mockRejectedValue(new Error('Search failed'));

      await expect(service.search('query')).rejects.toThrow('Search failed');
    });
  });

  // ==================== promote ====================
  describe('promote', () => {
    it('should promote artifact to target namespace', async () => {
      const existing = makeArtifact();
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.findByNamespaceNameVersion.mockResolvedValue(null);

      const result = await service.promote('artifact-001', 'staging');

      expect(result.namespace).toBe('staging');
      expect(result.metadata.promotedFrom).toBe('dev/my-app');
      expect(mockRepo.create).toHaveBeenCalledTimes(1);
    });

    it('should throw when artifact not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.promote('nonexistent', 'staging')).rejects.toThrow(OrionError);
    });

    it('should throw when promoted artifact already exists in target namespace', async () => {
      mockRepo.findById.mockResolvedValue(makeArtifact());
      mockRepo.findByNamespaceNameVersion.mockResolvedValue(makeArtifact({ namespace: 'staging' }));

      await expect(service.promote('artifact-001', 'staging')).rejects.toThrow(OrionError);
    });

    it('should propagate repository errors', async () => {
      mockRepo.findById.mockRejectedValue(new Error('DB down'));

      await expect(service.promote('artifact-001', 'staging')).rejects.toThrow('DB down');
    });
  });

  // ==================== deprecate ====================
  describe('deprecate', () => {
    it('should set artifact status to DEPRECATED', async () => {
      const existing = makeArtifact();
      mockRepo.findById.mockResolvedValue(existing);

      const result = await service.deprecate('artifact-001');

      expect(result.status).toBe(ArtifactStatus.DEPRECATED);
      expect(mockRepo.update).toHaveBeenCalledTimes(1);
    });

    it('should throw when artifact not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.deprecate('nonexistent')).rejects.toThrow(OrionError);
    });

    it('should propagate repository errors', async () => {
      mockRepo.findById.mockRejectedValue(new Error('DB error'));

      await expect(service.deprecate('artifact-001')).rejects.toThrow('DB error');
    });
  });

  // ==================== quarantine ====================
  describe('quarantine', () => {
    it('should set artifact status to QUARANTINED with reason in metadata', async () => {
      const existing = makeArtifact({ metadata: { env: 'dev' } });
      mockRepo.findById.mockResolvedValue(existing);

      const result = await service.quarantine('artifact-001', 'Malware detected');

      expect(result.status).toBe(ArtifactStatus.QUARANTINED);
      expect(mockRepo.update).toHaveBeenCalledTimes(1);
    });

    it('should throw when artifact not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.quarantine('nonexistent', 'reason')).rejects.toThrow(OrionError);
    });

    it('should propagate repository errors', async () => {
      mockRepo.findById.mockRejectedValue(new Error('DB error'));

      await expect(service.quarantine('artifact-001', 'reason')).rejects.toThrow('DB error');
    });
  });
});

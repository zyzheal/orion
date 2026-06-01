/**
 * ArtifactService 测试 - PostgreSQL Repository 模式
 *
 * 测试 ArtifactService 的 CRUD 操作和 Repository 交互。
 */

import { ArtifactService, ArtifactType } from '../ArtifactService';

// Mock repository instance matching BuildArtifactRepository's actual API
const mockRepo = {
  createArtifact: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  deleteArtifact: jest.fn(),
  recordDownload: jest.fn(),
  cleanupExpired: jest.fn(),
  cleanupByRun: jest.fn(),
};

describe('ArtifactService - PostgreSQL Repository', () => {
  let service: ArtifactService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Pass mockRepo directly as the repository (matches constructor(repository?: BuildArtifactRepository))
    service = new ArtifactService(mockRepo as any);
  });

  describe('createArtifact', () => {
    it('should create an artifact with required fields', async () => {
      mockRepo.createArtifact.mockResolvedValue({
        id: 'artifact-1',
        name: 'test-artifact',
        type: 'binary',
        runId: 'run-123',
        storagePath: '/artifacts/run-123/test-artifact',
        size: 0,
        downloadedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const artifact = await service.createArtifact({
        name: 'test-artifact',
        type: ArtifactType.BINARY,
        runId: 'run-123',
        storagePath: '/artifacts/run-123/test-artifact',
      });

      expect(artifact.id).toBeDefined();
      expect(artifact.name).toBe('test-artifact');
      expect(artifact.type).toBe('binary');
      expect(artifact.runId).toBe('run-123');
      expect(artifact.size).toBe(0);
      expect(artifact.downloadedCount).toBe(0);
      expect(artifact.createdAt).toBeDefined();
    });

    it('should create an artifact with optional fields', async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      mockRepo.createArtifact.mockResolvedValue({
        id: 'artifact-2',
        name: 'full-artifact',
        type: 'docker_image',
        stageId: 'stage-1',
        size: 1024,
        checksum: 'sha256:abc123',
        expiresAt,
        metadata: { key: 'value', taskId: 'task-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const artifact = await service.createArtifact({
        name: 'full-artifact',
        type: ArtifactType.DOCKER_IMAGE,
        runId: 'run-456',
        stageId: 'stage-1',
        taskId: 'task-1',
        size: 1024,
        storagePath: '/artifacts/full',
        checksum: 'sha256:abc123',
        expiresAt,
        metadata: { key: 'value' },
      });

      expect(artifact.stageId).toBe('stage-1');
      expect(artifact.size).toBe(1024);
      expect(artifact.checksum).toBe('sha256:abc123');
    });
  });

  describe('getArtifact', () => {
    it('should return artifact by ID', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'artifact-1',
        name: 'get-test',
        type: 'binary',
        runId: 'run-get',
        createdAt: new Date(),
      });

      const found = await service.getArtifact('artifact-1');
      expect(found).toBeDefined();
      expect(found?.name).toBe('get-test');
    });

    it('should return null for non-existent ID', async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      const found = await service.getArtifact('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('listArtifacts', () => {
    it('should list all artifacts without filters', async () => {
      mockRepo.findAll.mockResolvedValue({
        entities: [
          { id: 'a1', name: 'artifact-1', type: 'binary' },
          { id: 'a2', name: 'artifact-2', type: 'docker_image' },
          { id: 'a3', name: 'artifact-3', type: 'binary' },
        ],
        total: 3,
      });

      const artifacts = await service.listArtifacts();
      expect(artifacts.length).toBe(3);
    });

    it('should filter by runId', async () => {
      mockRepo.findAll.mockResolvedValue({
        entities: [
          { id: 'a1', name: 'artifact-1', runId: 'run-1' },
          { id: 'a2', name: 'artifact-2', runId: 'run-1' },
        ],
        total: 2,
      });

      const artifacts = await service.listArtifacts({ runId: 'run-1' });
      expect(artifacts.length).toBe(2);
    });
  });

  describe('deleteArtifact', () => {
    it('should delete existing artifact', async () => {
      mockRepo.deleteArtifact.mockResolvedValue(true);

      const deleted = await service.deleteArtifact('artifact-1');
      expect(deleted).toBe(true);
    });

    it('should return false for non-existent ID', async () => {
      mockRepo.deleteArtifact.mockResolvedValue(false);

      const deleted = await service.deleteArtifact('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('recordDownload', () => {
    it('should increment download count', async () => {
      mockRepo.recordDownload.mockResolvedValue({
        id: 'artifact-1',
        downloadedCount: 1,
      });

      await service.recordDownload('artifact-1');
      await service.recordDownload('artifact-1');

      expect(mockRepo.recordDownload).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanupExpired', () => {
    it('should return 0 when no expired artifacts', async () => {
      mockRepo.cleanupExpired.mockResolvedValue(0);

      const count = await service.cleanupExpired();
      expect(count).toBe(0);
    });

    it('should delete expired artifacts', async () => {
      mockRepo.cleanupExpired.mockResolvedValue(1);

      const count = await service.cleanupExpired();
      expect(count).toBe(1);
    });
  });

  describe('getByRunId (via listArtifacts)', () => {
    it('should get artifacts by run ID', async () => {
      mockRepo.findAll.mockResolvedValue({
        entities: [
          { id: 'a1', name: 'run1-artifact-1', runId: 'run-specific' },
          { id: 'a2', name: 'run1-artifact-2', runId: 'run-specific' },
        ],
        total: 2,
      });

      const artifacts = await service.listArtifacts({ runId: 'run-specific' });
      expect(artifacts.length).toBe(2);
      expect(artifacts.every(a => a.runId === 'run-specific')).toBe(true);
    });
  });

  describe('getByStageId (via listArtifacts)', () => {
    it('should get artifacts by stage ID', async () => {
      mockRepo.findAll.mockResolvedValue({
        entities: [
          { id: 'a1', name: 'stage-artifact', stageId: 'stage-specific' },
        ],
        total: 1,
      });

      const artifacts = await service.listArtifacts({ stageId: 'stage-specific' });
      expect(artifacts.length).toBe(1);
      expect(artifacts[0].stageId).toBe('stage-specific');
    });
  });
});

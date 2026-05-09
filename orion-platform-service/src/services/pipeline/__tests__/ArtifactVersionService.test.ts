/**
 * ArtifactVersionService Tests
 *
 * Tests for version management: promote, lineage, tag, circular reference protection.
 */

import { ArtifactVersionService } from '../ArtifactVersionService';

// Mock repository
const mockRepository = {
  createVersion: jest.fn().mockImplementation((input) => Promise.resolve({
    id: `ver-${Date.now()}`,
    ...input,
    tags: [],
    metadata: input.metadata || {},
    createdAt: new Date(),
  })),
  findById: jest.fn().mockResolvedValue(null),
  findByVersion: jest.fn().mockResolvedValue(null),
  findByTag: jest.fn().mockResolvedValue([]),
  getAncestors: jest.fn().mockResolvedValue([]),
  getDescendants: jest.fn().mockResolvedValue([]),
  addTag: jest.fn().mockResolvedValue(undefined),
  removeTag: jest.fn().mockResolvedValue(undefined),
  getDeploymentHistory: jest.fn().mockResolvedValue({ pipelineId: '', versions: [] }),
  getVersionDiff: jest.fn().mockResolvedValue({
    pipelineId: '',
    versionA: '',
    versionB: '',
    changes: { metadataAdded: [], metadataRemoved: [], metadataChanged: [] },
  }),
};

describe('ArtifactVersionService', () => {
  let service: ArtifactVersionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ArtifactVersionService(mockRepository as any);
  });

  describe('createVersion', () => {
    test('should create a new version', async () => {
      mockRepository.findByVersion.mockResolvedValue(null);

      const result = await service.createVersion({
        tenantId: 'tenant-1',
        pipelineId: 'pipeline-1',
        runId: 'run-1',
        stageName: 'build',
        artifactName: 'my-app',
        version: '1.0.0',
        commitSha: 'abc123',
        branch: 'main',
        storagePath: '/artifacts/my-app-1.0.0.tar',
      });

      expect(result.artifactName).toBe('my-app');
      expect(result.version).toBe('1.0.0');
      expect(mockRepository.createVersion).toHaveBeenCalled();
    });

    test('should throw when version already exists', async () => {
      mockRepository.findByVersion.mockResolvedValue({ id: 'existing' });

      await expect(service.createVersion({
        tenantId: 'tenant-1',
        pipelineId: 'pipeline-1',
        runId: 'run-1',
        stageName: 'build',
        artifactName: 'my-app',
        version: '1.0.0',
        commitSha: 'abc123',
        branch: 'main',
        storagePath: '/path',
      })).rejects.toThrow('already exists');
    });
  });

  describe('promoteVersion', () => {
    const mockVersion = {
      id: 'ver-1',
      tenantId: 'tenant-1',
      pipelineId: 'pipeline-1',
      runId: 'run-1',
      stageName: 'build',
      artifactName: 'my-app',
      version: '1.0.0',
      commitSha: 'abc123',
      branch: 'main',
      metadata: { previousEnv: 'dev' },
      storagePath: '/path',
      tags: [],
      createdAt: new Date(),
    };

    test('should promote version to target environment', async () => {
      mockRepository.findById.mockResolvedValue(mockVersion);
      mockRepository.getDescendants.mockResolvedValue([]);

      const result = await service.promoteVersion('ver-1', 'staging');

      expect(mockRepository.createVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          artifactName: 'my-app',
          version: '1.0.0',
          metadata: expect.objectContaining({
            promotedTo: 'staging',
          }),
        })
      );
    });

    test('should block circular references', async () => {
      mockRepository.findById.mockResolvedValue(mockVersion);
      mockRepository.getDescendants.mockResolvedValue(['ver-1']);

      await expect(service.promoteVersion('ver-1', 'staging'))
        .rejects.toThrow('circular reference');
    });

    test('should throw when version not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.promoteVersion('nonexistent', 'staging'))
        .rejects.toThrow('Version not found');
    });
  });

  describe('getVersionLineage', () => {
    test('should return version with ancestors and descendants', async () => {
      const mockVersion = { id: 'ver-1' };
      mockRepository.findById.mockResolvedValue(mockVersion);
      mockRepository.getAncestors.mockResolvedValue([{ id: 'ver-0' }]);
      mockRepository.getDescendants.mockResolvedValue(['ver-2', 'ver-3']);

      const lineage = await service.getVersionLineage('ver-1');

      expect(lineage.version).toEqual({ id: 'ver-1' });
      expect(lineage.ancestors).toHaveLength(1);
      expect(lineage.descendants).toHaveLength(2);
    });

    test('should throw when version not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getVersionLineage('nonexistent'))
        .rejects.toThrow('Version not found');
    });
  });

  describe('tag management', () => {
    const mockVersion = {
      id: 'ver-1',
      tags: ['latest'],
    };

    test('should add tag to version', async () => {
      mockRepository.findById.mockResolvedValue(mockVersion);

      const result = await service.addTag('ver-1', 'stable');

      expect(mockRepository.addTag).toHaveBeenCalledWith('ver-1', 'stable');
      expect(result.tags).toContain('stable');
    });

    test('should remove tag from version', async () => {
      await service.removeTag('ver-1', 'latest');

      expect(mockRepository.removeTag).toHaveBeenCalledWith('ver-1', 'latest');
    });

    test('should find versions by tag', async () => {
      mockRepository.findByTag.mockResolvedValue([{ id: 'ver-1', tags: ['stable'] }]);

      const results = await service.findVersionsByTag('stable');

      expect(results).toHaveLength(1);
    });
  });
});

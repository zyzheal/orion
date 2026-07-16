/**
 * TraceabilityService 单元测试
 *
 * GAP-CN-06: Tests the business logic layer for artifact version traceability.
 */

import { TraceabilityService, TraceabilityServiceError } from '../TraceabilityService';
import type { ArtifactVersionRepository } from '../../repositories/ArtifactVersionRepository';
import type { ArtifactVersion, TraceabilityChain, DeploymentHistory, VersionDiff } from '../../models/ArtifactVersion';

describe('TraceabilityService', () => {
  let mockRepo: jest.Mocked<ArtifactVersionRepository>;
  let service: TraceabilityService;

  beforeEach(() => {
    mockRepo = {
      createVersion: jest.fn(),
      findByRunId: jest.fn(),
      findByPipelineId: jest.fn(),
      findByVersion: jest.fn(),
      findLatestByPipeline: jest.fn(),
      findByCommitSha: jest.fn(),
      findTraceabilityChain: jest.fn(),
      getDeploymentHistory: jest.fn(),
      getVersionDiff: jest.fn(),
      findWithFilters: jest.fn(),
    } as unknown as jest.Mocked<ArtifactVersionRepository>;

    service = new TraceabilityService(mockRepo);
  });

  // ==================== recordVersion ====================

  describe('recordVersion', () => {
    const sampleVersion: ArtifactVersion = {
      id: 'av-1',
      tenantId: 'tenant-1',
      pipelineId: 'pipe-1',
      runId: 'run-1',
      stageName: 'build',
      artifactName: 'app.jar',
      version: '1.0.0',
      commitSha: 'abc123',
      branch: 'main',
      metadata: { imageTag: '1.0.0' },
      storagePath: '/artifacts/app.jar',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };

    test('should record a new artifact version', async () => {
      mockRepo.createVersion.mockResolvedValue(sampleVersion);

      const result = await service.recordVersion({
        tenantId: 'tenant-1',
        pipelineId: 'pipe-1',
        runId: 'run-1',
        stageName: 'build',
        artifactName: 'app.jar',
        version: '1.0.0',
        commitSha: 'abc123',
        branch: 'main',
        metadata: { imageTag: '1.0.0' },
        storagePath: '/artifacts/app.jar',
      });

      expect(result.id).toBe('av-1');
      expect(result.version).toBe('1.0.0');
      expect(mockRepo.createVersion).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        pipelineId: 'pipe-1',
        runId: 'run-1',
        stageName: 'build',
        artifactName: 'app.jar',
        version: '1.0.0',
        commitSha: 'abc123',
        branch: 'main',
        metadata: { imageTag: '1.0.0' },
        storagePath: '/artifacts/app.jar',
      });
    });
  });

  // ==================== getTraceabilityChain ====================

  describe('getTraceabilityChain', () => {
    test('should return full traceability chain', async () => {
      const chain: TraceabilityChain = {
        version: {
          id: 'av-1',
          tenantId: 'tenant-1',
          pipelineId: 'pipe-1',
          runId: 'run-1',
          stageName: 'build',
          artifactName: 'app.jar',
          version: '1.0.0',
          commitSha: 'abc',
          branch: 'main',
          metadata: {},
          storagePath: '/a.jar',
          createdAt: new Date('2024-01-01'),
        },
        pipelineRun: {
          id: 'run-1',
          pipelineId: 'pipe-1',
          triggerType: 'git',
          status: 'success',
          startedAt: new Date('2024-01-01T00:00:00Z'),
          completedAt: new Date('2024-01-01T00:05:00Z'),
          context: { ref: 'main' },
        },
        deployments: [
          {
            id: 'deploy-1',
            environment: 'staging',
            status: 'success',
            deployedAt: new Date('2024-01-01T00:10:00Z'),
            deployedBy: 'user-1',
          },
        ],
      };
      mockRepo.findTraceabilityChain.mockResolvedValue(chain);

      const result = await service.getTraceabilityChain('av-1');

      expect(result.version.id).toBe('av-1');
      expect(result.pipelineRun!.id).toBe('run-1');
      expect(result.deployments!.length).toBe(1);
    });

    test('should throw NotFoundError if chain not found', async () => {
      mockRepo.findTraceabilityChain.mockResolvedValue(undefined);

      await expect(service.getTraceabilityChain('unknown')).rejects.toThrow(
        TraceabilityServiceError,
      );
      try {
        await service.getTraceabilityChain('unknown');
        fail('Expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(TraceabilityServiceError);
        expect((err as TraceabilityServiceError).code).toBe('NOT_FOUND');
      }
    });
  });

  // ==================== getDeploymentHistory ====================

  describe('getDeploymentHistory', () => {
    test('should return deployment history for a pipeline', async () => {
      const history: DeploymentHistory = {
        pipelineId: 'pipe-1',
        versions: [
          {
            version: '1.0.0',
            commitSha: 'abc',
            branch: 'main',
            createdAt: new Date('2024-01-01'),
            deployments: [
              {
                environment: 'staging',
                status: 'success',
                deployedAt: new Date('2024-01-01T00:10:00Z'),
                deployedBy: 'user-1',
              },
            ],
          },
        ],
      };
      mockRepo.getDeploymentHistory.mockResolvedValue(history);

      const result = await service.getDeploymentHistory('pipe-1');

      expect(result.pipelineId).toBe('pipe-1');
      expect(result.versions).toHaveLength(1);
      expect(result.versions[0].version).toBe('1.0.0');
    });

    test('should support custom limit', async () => {
      mockRepo.getDeploymentHistory.mockResolvedValue({
        pipelineId: 'pipe-1',
        versions: [],
      });

      await service.getDeploymentHistory('pipe-1', 5);

      expect(mockRepo.getDeploymentHistory).toHaveBeenCalledWith('pipe-1', 5);
    });
  });

  // ==================== getVersionDiff ====================

  describe('getVersionDiff', () => {
    test('should return diff between two versions', async () => {
      const diff: VersionDiff = {
        pipelineId: 'pipe-1',
        versionA: '1.0.0',
        versionB: '2.0.0',
        changes: {
          metadataAdded: ['key3'],
          metadataRemoved: ['key1'],
          metadataChanged: [{ key: 'key2', oldValue: 'v2a', newValue: 'v2b' }],
          commitDiff: { from: 'aaa', to: 'bbb' },
          branchDiff: { from: 'main', to: 'develop' },
        },
      };
      mockRepo.getVersionDiff.mockResolvedValue(diff);

      const result = await service.getVersionDiff('pipe-1', '1.0.0', '2.0.0');

      expect(result.versionA).toBe('1.0.0');
      expect(result.versionB).toBe('2.0.0');
      expect(result.changes.metadataAdded).toContain('key3');
      expect(result.changes.metadataRemoved).toContain('key1');
      expect(result.changes.metadataChanged).toHaveLength(1);
    });

    test('should throw NotFoundError if diff not available', async () => {
      mockRepo.getVersionDiff.mockResolvedValue(undefined);

      await expect(service.getVersionDiff('pipe-1', '1.0.0', 'unknown')).rejects.toThrow(
        TraceabilityServiceError,
      );
      try {
        await service.getVersionDiff('pipe-1', '1.0.0', 'unknown');
        fail('Expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(TraceabilityServiceError);
        expect((err as TraceabilityServiceError).code).toBe('NOT_FOUND');
      }
    });
  });

  // ==================== findVersionsByRun ====================

  describe('findVersionsByRun', () => {
    test('should return versions for a runId', async () => {
      const versions: ArtifactVersion[] = [
        {
          id: 'av-1',
          tenantId: 'tenant-1',
          pipelineId: 'pipe-1',
          runId: 'run-1',
          stageName: 'build',
          artifactName: 'app.jar',
          version: '1.0.0',
          commitSha: 'abc',
          branch: 'main',
          metadata: {},
          storagePath: '/a.jar',
          createdAt: new Date('2024-01-01'),
        },
      ];
      mockRepo.findByRunId.mockResolvedValue(versions);

      const result = await service.findVersionsByRun('run-1');

      expect(result).toHaveLength(1);
      expect(result[0].artifactName).toBe('app.jar');
    });
  });

  // ==================== findVersionsByPipeline ====================

  describe('findVersionsByPipeline', () => {
    test('should return versions for a pipelineId', async () => {
      const versions: ArtifactVersion[] = [
        {
          id: 'av-1',
          tenantId: 'tenant-1',
          pipelineId: 'pipe-1',
          runId: 'run-1',
          stageName: 'build',
          artifactName: 'app.jar',
          version: '1.0.0',
          commitSha: 'abc',
          branch: 'main',
          metadata: {},
          storagePath: '/a.jar',
          createdAt: new Date('2024-01-01'),
        },
      ];
      mockRepo.findByPipelineId.mockResolvedValue(versions);

      const result = await service.findVersionsByPipeline('pipe-1');

      expect(result).toHaveLength(1);
      expect(mockRepo.findByPipelineId).toHaveBeenCalledWith('pipe-1', 50);
    });

    test('should support custom limit', async () => {
      mockRepo.findByPipelineId.mockResolvedValue([]);

      await service.findVersionsByPipeline('pipe-1', 10);

      expect(mockRepo.findByPipelineId).toHaveBeenCalledWith('pipe-1', 10);
    });
  });

  // ==================== findVersionsByCommit ====================

  describe('findVersionsByCommit', () => {
    test('should return all versions for a commit SHA', async () => {
      const versions: ArtifactVersion[] = [
        {
          id: 'av-1',
          tenantId: 'tenant-1',
          pipelineId: 'pipe-1',
          runId: 'run-1',
          stageName: 'build',
          artifactName: 'app.jar',
          version: '1.0.0',
          commitSha: 'abc123',
          branch: 'main',
          metadata: {},
          storagePath: '/a.jar',
          createdAt: new Date('2024-01-01'),
        },
      ];
      mockRepo.findByCommitSha.mockResolvedValue(versions);

      const result = await service.findVersionsByCommit('abc123');

      expect(result).toHaveLength(1);
      expect(result[0].commitSha).toBe('abc123');
    });
  });

  // ==================== getLatestVersion ====================

  describe('getLatestVersion', () => {
    test('should return the latest version for a pipeline', async () => {
      const latest: ArtifactVersion = {
        id: 'av-latest',
        tenantId: 'tenant-1',
        pipelineId: 'pipe-1',
        runId: 'run-3',
        stageName: 'build',
        artifactName: 'app.jar',
        version: '1.2.0',
        commitSha: 'xyz',
        branch: 'develop',
        metadata: {},
        storagePath: '/app.jar',
        createdAt: new Date('2024-01-03'),
      };
      mockRepo.findLatestByPipeline.mockResolvedValue(latest);

      const result = await service.getLatestVersion('pipe-1');

      expect(result!.version).toBe('1.2.0');
    });

    test('should return undefined if no versions exist', async () => {
      mockRepo.findLatestByPipeline.mockResolvedValue(undefined);

      const result = await service.getLatestVersion('pipe-1');
      expect(result).toBeUndefined();
    });
  });

  // ==================== searchVersions ====================

  describe('searchVersions', () => {
    test('should search with filters', async () => {
      mockRepo.findWithFilters.mockResolvedValue({
        versions: [],
        total: 0,
      });

      const result = await service.searchVersions({
        tenantId: 'tenant-1',
        pipelineId: 'pipe-1',
        branch: 'main',
      });

      expect(mockRepo.findWithFilters).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        pipelineId: 'pipe-1',
        branch: 'main',
      });
    });

    test('should return paginated results', async () => {
      const versions: ArtifactVersion[] = [
        {
          id: 'av-1',
          tenantId: 'tenant-1',
          pipelineId: 'pipe-1',
          runId: 'run-1',
          stageName: 'build',
          artifactName: 'app.jar',
          version: '1.0.0',
          commitSha: 'abc',
          branch: 'main',
          metadata: {},
          storagePath: '/a.jar',
          createdAt: new Date('2024-01-01'),
        },
      ];
      mockRepo.findWithFilters.mockResolvedValue({
        versions,
        total: 1,
      });

      const result = await service.searchVersions({
        pipelineId: 'pipe-1',
        limit: 10,
        offset: 0,
      });

      expect(result.versions).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ==================== Integration-style tests ====================

  describe('getTraceabilityChain with partial data', () => {
    test('should handle chain with deployments but no pipelineRun', async () => {
      const chain: TraceabilityChain = {
        version: {
          id: 'av-1',
          tenantId: 'tenant-1',
          pipelineId: 'pipe-1',
          runId: 'run-deleted',
          stageName: 'build',
          artifactName: 'app.jar',
          version: '1.0.0',
          commitSha: 'abc',
          branch: 'main',
          metadata: {},
          storagePath: '/a.jar',
          createdAt: new Date('2024-01-01'),
        },
        pipelineRun: undefined,
        deployments: [
          {
            id: 'deploy-1',
            environment: 'prod',
            status: 'success',
            deployedAt: new Date('2024-01-01T00:10:00Z'),
            deployedBy: 'system',
          },
        ],
      };
      mockRepo.findTraceabilityChain.mockResolvedValue(chain);

      const result = await service.getTraceabilityChain('av-1');

      expect(result.version).toBeDefined();
      expect(result.pipelineRun).toBeUndefined();
      expect(result.deployments).toHaveLength(1);
    });
  });

  describe('getVersionDiff with no changes', () => {
    test('should handle identical metadata', async () => {
      const diff: VersionDiff = {
        pipelineId: 'pipe-1',
        versionA: '1.0.0',
        versionB: '1.0.1',
        changes: {
          metadataAdded: [],
          metadataRemoved: [],
          metadataChanged: [],
          commitDiff: { from: 'aaa', to: 'bbb' },
          branchDiff: { from: 'main', to: 'main' },
        },
      };
      mockRepo.getVersionDiff.mockResolvedValue(diff);

      const result = await service.getVersionDiff('pipe-1', '1.0.0', '1.0.1');

      expect(result.changes.metadataAdded).toEqual([]);
      expect(result.changes.metadataRemoved).toEqual([]);
      expect(result.changes.metadataChanged).toEqual([]);
    });
  });
});

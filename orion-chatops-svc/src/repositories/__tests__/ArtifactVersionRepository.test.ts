/**
 * ArtifactVersionRepository 单元测试
 *
 * GAP-CN-06: Tests CRUD operations and traceability queries for artifact version tracking.
 */

import {
  ArtifactVersionRepository,
} from '../ArtifactVersionRepository';
import type { ArtifactVersionCreateInput } from '../../models/ArtifactVersion';

describe('ArtifactVersionRepository', () => {
  let repo: ArtifactVersionRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new ArtifactVersionRepository(mockDb);
  });

  // ==================== createVersion ====================

  describe('createVersion', () => {
    const input: ArtifactVersionCreateInput = {
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
    };

    const mockRow = {
      id: 'av-1',
      tenant_id: 'tenant-1',
      pipeline_id: 'pipe-1',
      run_id: 'run-1',
      stage_name: 'build',
      artifact_name: 'app.jar',
      version: '1.0.0',
      commit_sha: 'abc123',
      branch: 'main',
      metadata: { imageTag: '1.0.0' },
      storage_path: '/artifacts/app.jar',
      created_at: new Date('2024-01-01T00:00:00Z'),
    };

    test('should create a version record', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.createVersion(input);

      expect(result.id).toBe('av-1');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.pipelineId).toBe('pipe-1');
      expect(result.version).toBe('1.0.0');
      expect(result.commitSha).toBe('abc123');
      expect(result.branch).toBe('main');
      expect(result.metadata).toEqual({ imageTag: '1.0.0' });
      expect(result.storagePath).toBe('/artifacts/app.jar');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO artifact_version_tracking'),
        expect.arrayContaining([
          'tenant-1',
          'pipe-1',
          'run-1',
          'build',
          'app.jar',
          '1.0.0',
          'abc123',
          'main',
          { imageTag: '1.0.0' },
          '/artifacts/app.jar',
        ]),
      );
    });

    test('should handle null commitSha and branch', async () => {
      const inputWithoutSource = {
        ...input,
        commitSha: undefined,
        branch: undefined,
      };
      const rowWithoutSource = {
        ...mockRow,
        commit_sha: null,
        branch: null,
      };
      mockDb.query.mockResolvedValue({ rows: [rowWithoutSource] });

      const result = await repo.createVersion(inputWithoutSource);

      expect(result.commitSha).toBeUndefined();
      expect(result.branch).toBeUndefined();
      const callArgs = mockDb.query.mock.calls[0];
      expect(callArgs[1][6]).toBeNull(); // commit_sha
      expect(callArgs[1][7]).toBeNull(); // branch
    });

    test('should throw if INSERT returns no rows', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(repo.createVersion(input)).rejects.toThrow(
        'INSERT into artifact_version_tracking returned no rows',
      );
    });

    test('should default metadata to empty object if not provided', async () => {
      const inputNoMeta: ArtifactVersionCreateInput = {
        tenantId: 'tenant-1',
        pipelineId: 'pipe-1',
        runId: 'run-1',
        stageName: 'build',
        artifactName: 'app.jar',
        version: '1.0.0',
        storagePath: '/artifacts/app.jar',
      };
      mockDb.query.mockResolvedValue({
        rows: [{ ...mockRow, metadata: {} }],
      });

      const result = await repo.createVersion(inputNoMeta);
      expect(result.metadata).toEqual({});
    });
  });

  // ==================== findByRunId ====================

  describe('findByRunId', () => {
    test('should return versions for a given runId', async () => {
      const mockRows = [
        {
          id: 'av-1',
          tenant_id: 'tenant-1',
          pipeline_id: 'pipe-1',
          run_id: 'run-1',
          stage_name: 'build',
          artifact_name: 'app.jar',
          version: '1.0.0',
          commit_sha: 'abc123',
          branch: 'main',
          metadata: {},
          storage_path: '/artifacts/app.jar',
          created_at: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 'av-2',
          tenant_id: 'tenant-1',
          pipeline_id: 'pipe-1',
          run_id: 'run-1',
          stage_name: 'test',
          artifact_name: 'report.html',
          version: '1.0.0',
          commit_sha: 'abc123',
          branch: 'main',
          metadata: {},
          storage_path: '/artifacts/report.html',
          created_at: new Date('2024-01-01T00:01:00Z'),
        },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const results = await repo.findByRunId('run-1');

      expect(results).toHaveLength(2);
      expect(results[0].artifactName).toBe('app.jar');
      expect(results[1].artifactName).toBe('report.html');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE run_id = $1'),
        ['run-1'],
      );
    });

    test('should return empty array for unknown runId', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const results = await repo.findByRunId('unknown');
      expect(results).toEqual([]);
    });
  });

  // ==================== findByPipelineId ====================

  describe('findByPipelineId', () => {
    test('should return versions for a given pipelineId with default limit', async () => {
      const mockRows = [
        {
          id: 'av-1',
          tenant_id: 'tenant-1',
          pipeline_id: 'pipe-1',
          run_id: 'run-1',
          stage_name: 'build',
          artifact_name: 'app.jar',
          version: '1.0.0',
          commit_sha: 'abc',
          branch: 'main',
          metadata: {},
          storage_path: '/a.jar',
          created_at: new Date('2024-01-01'),
        },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const results = await repo.findByPipelineId('pipe-1');

      expect(results).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        ['pipe-1', 50],
      );
    });

    test('should respect custom limit', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await repo.findByPipelineId('pipe-1', 10);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.any(String),
        ['pipe-1', 10],
      );
    });
  });

  // ==================== findByVersion ====================

  describe('findByVersion', () => {
    test('should return the latest version matching pipelineId and version', async () => {
      const mockRow = {
        id: 'av-1',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        run_id: 'run-1',
        stage_name: 'build',
        artifact_name: 'app.jar',
        version: '1.0.0',
        commit_sha: 'abc',
        branch: 'main',
        metadata: {},
        storage_path: '/a.jar',
        created_at: new Date('2024-01-01'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.findByVersion('pipe-1', '1.0.0');

      expect(result).toBeDefined();
      expect(result!.version).toBe('1.0.0');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE pipeline_id = $1 AND version = $2'),
        ['pipe-1', '1.0.0'],
      );
    });

    test('should return undefined if no match', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findByVersion('pipe-1', '9.9.9');
      expect(result).toBeUndefined();
    });
  });

  // ==================== findLatestByPipeline ====================

  describe('findLatestByPipeline', () => {
    test('should return the most recent version', async () => {
      const mockRow = {
        id: 'av-latest',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        run_id: 'run-3',
        stage_name: 'build',
        artifact_name: 'app.jar',
        version: '1.2.0',
        commit_sha: 'xyz',
        branch: 'develop',
        metadata: {},
        storage_path: '/app.jar',
        created_at: new Date('2024-01-03'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.findLatestByPipeline('pipe-1');

      expect(result).toBeDefined();
      expect(result!.version).toBe('1.2.0');
    });

    test('should return undefined for unknown pipeline', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const result = await repo.findLatestByPipeline('unknown');
      expect(result).toBeUndefined();
    });
  });

  // ==================== findByCommitSha ====================

  describe('findByCommitSha', () => {
    test('should return all versions for a commit', async () => {
      const mockRows = [
        {
          id: 'av-1',
          tenant_id: 'tenant-1',
          pipeline_id: 'pipe-1',
          run_id: 'run-1',
          stage_name: 'build',
          artifact_name: 'app.jar',
          version: '1.0.0',
          commit_sha: 'abc123',
          branch: 'main',
          metadata: {},
          storage_path: '/a.jar',
          created_at: new Date('2024-01-01'),
        },
        {
          id: 'av-2',
          tenant_id: 'tenant-1',
          pipeline_id: 'pipe-2',
          run_id: 'run-2',
          stage_name: 'build',
          artifact_name: 'lib.jar',
          version: '2.0.0',
          commit_sha: 'abc123',
          branch: 'main',
          metadata: {},
          storage_path: '/l.jar',
          created_at: new Date('2024-01-02'),
        },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const results = await repo.findByCommitSha('abc123');

      expect(results).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE commit_sha = $1'),
        ['abc123'],
      );
    });

    test('should return empty array for unknown commit', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const results = await repo.findByCommitSha('nonexistent');
      expect(results).toEqual([]);
    });
  });

  // ==================== findTraceabilityChain ====================

  describe('findTraceabilityChain', () => {
    test('should return full chain with version, run, and deployments', async () => {
      const versionRow = {
        id: 'av-1',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        run_id: 'run-1',
        stage_name: 'build',
        artifact_name: 'app.jar',
        version: '1.0.0',
        commit_sha: 'abc',
        branch: 'main',
        metadata: {},
        storage_path: '/a.jar',
        created_at: new Date('2024-01-01'),
      };
      const runRow = {
        id: 'run-1',
        pipeline_id: 'pipe-1',
        triggerType: 'git',
        status: 'success',
        startedAt: new Date('2024-01-01T00:00:00Z'),
        completedAt: new Date('2024-01-01T00:05:00Z'),
        context: { ref: 'main' },
      };
      const deployRows = [
        {
          id: 'deploy-1',
          environment: 'staging',
          status: 'success',
          deployedAt: new Date('2024-01-01T00:10:00Z'),
          deployedBy: 'user-1',
        },
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: [versionRow] })
        .mockResolvedValueOnce({ rows: [runRow] })
        .mockResolvedValueOnce({ rows: deployRows });

      const chain = await repo.findTraceabilityChain('av-1');

      expect(chain).toBeDefined();
      expect(chain!.version.id).toBe('av-1');
      expect(chain!.pipelineRun).toBeDefined();
      expect(chain!.pipelineRun!.id).toBe('run-1');
      expect(chain!.pipelineRun!.status).toBe('success');
      expect(chain!.deployments).toHaveLength(1);
      expect(chain!.deployments![0].environment).toBe('staging');
    });

    test('should return undefined for unknown version', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const chain = await repo.findTraceabilityChain('unknown');
      expect(chain).toBeUndefined();
    });

    test('should handle missing pipelineRun', async () => {
      const versionRow = {
        id: 'av-1',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        run_id: 'run-ghost',
        stage_name: 'build',
        artifact_name: 'app.jar',
        version: '1.0.0',
        commit_sha: 'abc',
        branch: 'main',
        metadata: {},
        storage_path: '/a.jar',
        created_at: new Date('2024-01-01'),
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [versionRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const chain = await repo.findTraceabilityChain('av-1');

      expect(chain).toBeDefined();
      expect(chain!.version.id).toBe('av-1');
      expect(chain!.pipelineRun).toBeUndefined();
      expect(chain!.deployments).toEqual([]);
    });
  });

  // ==================== getDeploymentHistory ====================

  describe('getDeploymentHistory', () => {
    test('should return deployment history for a pipeline', async () => {
      // First call: findByPipelineId
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'av-1',
            tenant_id: 'tenant-1',
            pipeline_id: 'pipe-1',
            run_id: 'run-1',
            stage_name: 'build',
            artifact_name: 'app.jar',
            version: '1.0.0',
            commit_sha: 'abc',
            branch: 'main',
            metadata: {},
            storage_path: '/a.jar',
            created_at: new Date('2024-01-01'),
          },
        ],
      });
      // Second call: deployment query for each version
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            environment: 'staging',
            status: 'success',
            deployedAt: new Date('2024-01-01T00:10:00Z'),
            deployedBy: 'user-1',
          },
        ],
      });

      const history = await repo.getDeploymentHistory('pipe-1', 10);

      expect(history.pipelineId).toBe('pipe-1');
      expect(history.versions).toHaveLength(1);
      expect(history.versions[0].version).toBe('1.0.0');
      expect(history.versions[0].deployments).toHaveLength(1);
      expect(history.versions[0].deployments[0].environment).toBe('staging');
    });

    test('should return empty versions for unknown pipeline', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const history = await repo.getDeploymentHistory('unknown');
      expect(history.pipelineId).toBe('unknown');
      expect(history.versions).toEqual([]);
    });
  });

  // ==================== getVersionDiff ====================

  describe('getVersionDiff', () => {
    test('should return diff between two versions', async () => {
      const rowA = {
        id: 'av-a',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        run_id: 'run-1',
        stage_name: 'build',
        artifact_name: 'app.jar',
        version: '1.0.0',
        commit_sha: 'aaa',
        branch: 'main',
        metadata: { key1: 'v1', key2: 'same' },
        storage_path: '/a.jar',
        created_at: new Date('2024-01-01'),
      };
      const rowB = {
        id: 'av-b',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        run_id: 'run-2',
        stage_name: 'build',
        artifact_name: 'app.jar',
        version: '2.0.0',
        commit_sha: 'bbb',
        branch: 'main',
        metadata: { key2: 'same', key3: 'v3' },
        storage_path: '/b.jar',
        created_at: new Date('2024-01-02'),
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [rowA] })
        .mockResolvedValueOnce({ rows: [rowB] });

      const diff = await repo.getVersionDiff('pipe-1', '1.0.0', '2.0.0');

      expect(diff).toBeDefined();
      expect(diff!.versionA).toBe('1.0.0');
      expect(diff!.versionB).toBe('2.0.0');
      expect(diff!.changes.metadataRemoved).toContain('key1');
      expect(diff!.changes.metadataAdded).toContain('key3');
      expect(diff!.changes.metadataChanged).toEqual([]); // key2 unchanged
      expect(diff!.changes.commitDiff).toEqual({ from: 'aaa', to: 'bbb' });
    });

    test('should return undefined if either version not found', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const diff = await repo.getVersionDiff('pipe-1', '1.0.0', '2.0.0');
      expect(diff).toBeUndefined();
    });

    test('should detect metadata changes', async () => {
      const rowA = {
        id: 'av-a',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        run_id: 'run-1',
        stage_name: 'build',
        artifact_name: 'app.jar',
        version: '1.0.0',
        commit_sha: 'aaa',
        branch: 'main',
        metadata: { size: '100', env: 'prod' },
        storage_path: '/a.jar',
        created_at: new Date('2024-01-01'),
      };
      const rowB = {
        id: 'av-b',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        run_id: 'run-2',
        stage_name: 'build',
        artifact_name: 'app.jar',
        version: '2.0.0',
        commit_sha: 'bbb',
        branch: 'develop',
        metadata: { size: '200', env: 'staging' },
        storage_path: '/b.jar',
        created_at: new Date('2024-01-02'),
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [rowA] })
        .mockResolvedValueOnce({ rows: [rowB] });

      const diff = await repo.getVersionDiff('pipe-1', '1.0.0', '2.0.0');

      expect(diff!.changes.metadataChanged).toHaveLength(2);
      expect(diff!.changes.metadataChanged).toContainEqual({
        key: 'size',
        oldValue: '100',
        newValue: '200',
      });
      expect(diff!.changes.branchDiff).toEqual({ from: 'main', to: 'develop' });
    });
  });

  // ==================== findWithFilters ====================

  describe('findWithFilters', () => {
    test('should filter by tenantId', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findWithFilters({ tenantId: 'tenant-1' });

      const countCall = mockDb.query.mock.calls[1];
      expect(countCall[0]).toContain('tenant_id = $1');
    });

    test('should filter by multiple conditions', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findWithFilters({
        tenantId: 'tenant-1',
        pipelineId: 'pipe-1',
        branch: 'main',
      });

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall[0]).toContain('tenant_id = $1');
      expect(queryCall[0]).toContain('pipeline_id = $2');
      expect(queryCall[0]).toContain('branch = $3');
    });

    test('should support pagination', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findWithFilters({ limit: 10, offset: 20 });

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall[1]).toContain(10);
      expect(queryCall[1]).toContain(20);
    });

    test('should return versions and total count', async () => {
      const mockRow = {
        id: 'av-1',
        tenant_id: 'tenant-1',
        pipeline_id: 'pipe-1',
        run_id: 'run-1',
        stage_name: 'build',
        artifact_name: 'app.jar',
        version: '1.0.0',
        commit_sha: 'abc',
        branch: 'main',
        metadata: {},
        storage_path: '/a.jar',
        created_at: new Date('2024-01-01'),
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockRow] })
        .mockResolvedValueOnce({ rows: [{ count: '42' }] });

      const result = await repo.findWithFilters({ pipelineId: 'pipe-1' });

      expect(result.versions).toHaveLength(1);
      expect(result.total).toBe(42);
    });

    test('should handle default limit and offset', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findWithFilters({});

      const queryCall = mockDb.query.mock.calls[0];
      // Default limit=50, offset=0
      expect(queryCall[1]).toContain(50);
      expect(queryCall[1]).toContain(0);
    });
  });

  // ==================== Column name verification ====================

  describe('column name verification', () => {
    test('createVersion should use snake_case column names', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const input: ArtifactVersionCreateInput = {
        tenantId: 'tenant-1',
        pipelineId: 'pipe-1',
        runId: 'run-1',
        stageName: 'build',
        artifactName: 'app.jar',
        version: '1.0.0',
        storagePath: '/a.jar',
      };

      try {
        await repo.createVersion(input);
      } catch {
        // Expected to throw on empty rows
      }

      const callArgs = mockDb.query.mock.calls[0];
      const sql = callArgs[0];
      expect(sql).toContain('tenant_id');
      expect(sql).toContain('pipeline_id');
      expect(sql).toContain('run_id');
      expect(sql).toContain('stage_name');
      expect(sql).toContain('artifact_name');
      expect(sql).toContain('storage_path');
      expect(sql).toContain('commit_sha');
      expect(sql).toContain('branch');
    });
  });
});

/**
 * PipelineVersionService Unit Tests
 */

import { PipelineVersionService, MAX_VERSIONS } from '../PipelineVersionService';

function createMockPool(rows: any[] = []) {
  return {
    query: jest.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  } as any;
}

describe('PipelineVersionService', () => {
  let service: PipelineVersionService;
  let pool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    jest.clearAllMocks();
    pool = createMockPool();
    service = new PipelineVersionService(pool);
  });

  const mockVersionRow = {
    id: 'v-1',
    pipeline_id: 'p-1',
    version: 1,
    yaml_definition: 'stages:\n  - name: build',
    spec: { stages: [{ name: 'build' }] },
    created_at: new Date('2025-01-01'),
    created_by: 'user-1',
    change_summary: 'Initial version',
    tags: ['v1.0'],
    is_baseline: false,
    parent_version_id: null,
  };

  // ==================== MAX_VERSIONS ====================

  describe('MAX_VERSIONS', () => {
    it('should be 50', () => {
      expect(MAX_VERSIONS).toBe(50);
    });
  });

  // ==================== createVersion ====================

  describe('createVersion', () => {
    it('should create a version', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockVersionRow] });

      const result = await service.createVersion({
        pipelineId: 'p-1',
        version: 1,
        yamlDefinition: 'stages:\n  - name: build',
        spec: { stages: [{ name: 'build' }] },
      });

      expect(result.id).toBe('v-1');
      expect(result.version).toBe(1);
      expect(result.pipelineId).toBe('p-1');
    });

    it('should use optional fields', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockVersionRow] });

      await service.createVersion({
        pipelineId: 'p-1',
        version: 1,
        yamlDefinition: 'yaml',
        spec: {},
        changeSummary: 'test',
        createdBy: 'user-1',
        parentVersionId: 'v-0',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['p-1', 1, 'yaml', {}, 'test', 'user-1', 'v-0'])
      );
    });

    it('should default optional fields to null', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockVersionRow] });

      await service.createVersion({
        pipelineId: 'p-1',
        version: 1,
        yamlDefinition: 'yaml',
        spec: {},
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null, null, null])
      );
    });
  });

  // ==================== listVersions ====================

  describe('listVersions', () => {
    it('should return paginated versions', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [mockVersionRow, { ...mockVersionRow, id: 'v-2', version: 2 }] });

      const result = await service.listVersions('p-1');

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should support pagination', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [mockVersionRow] });

      const result = await service.listVersions('p-1', { page: 2, limit: 5 });

      expect(result.total).toBe(10);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining(['p-1', 5, 5])
      );
    });

    it('should filter by tag', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockVersionRow] });

      await service.listVersions('p-1', { tag: 'v1.0' });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('@>'),
        expect.arrayContaining(['p-1', 'v1.0'])
      );
    });
  });

  // ==================== getVersionById ====================

  describe('getVersionById', () => {
    it('should return version with stats', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          ...mockVersionRow,
          avg_duration: '5000',
          success_rate: '80',
        }],
      });

      const result = await service.getVersionById('p-1', 'v-1');

      expect(result).not.toBeNull();
      expect(result!.durationMs).toBe(5000);
      expect(result!.successRate).toBe(80);
    });

    it('should return null when not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getVersionById('p-1', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should handle null stats', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ ...mockVersionRow, avg_duration: null, success_rate: null }],
      });

      const result = await service.getVersionById('p-1', 'v-1');

      expect(result!.durationMs).toBeUndefined();
      expect(result!.successRate).toBeUndefined();
    });
  });

  // ==================== getVersionByNumber ====================

  describe('getVersionByNumber', () => {
    it('should return version by number', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockVersionRow] });

      const result = await service.getVersionByNumber('p-1', 1);

      expect(result).not.toBeNull();
      expect(result!.version).toBe(1);
    });

    it('should return null when not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getVersionByNumber('p-1', 999);

      expect(result).toBeNull();
    });
  });

  // ==================== getLatestVersionNumber ====================

  describe('getLatestVersionNumber', () => {
    it('should return latest version number', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ max_ver: '5' }] });

      const result = await service.getLatestVersionNumber('p-1');

      expect(result).toBe(5);
    });

    it('should return 0 when no versions', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ max_ver: null }] });

      const result = await service.getLatestVersionNumber('p-1');

      expect(result).toBe(0);
    });
  });

  // ==================== diffVersions ====================

  describe('diffVersions', () => {
    it('should compute diff between versions', async () => {
      const v1 = { ...mockVersionRow, yaml_definition: 'line1\nline2\nline3' };
      const v2 = { ...mockVersionRow, id: 'v-2', yaml_definition: 'line1\nmodified\nline3\nline4' };

      pool.query
        .mockResolvedValueOnce({ rows: [{ ...v1, avg_duration: null, success_rate: null }] })
        .mockResolvedValueOnce({ rows: [{ ...v2, avg_duration: null, success_rate: null }] });

      const result = await service.diffVersions('p-1', 'v-1', 'v-2');

      expect(result).not.toBeNull();
      expect(result!.additions).toContain('line4');
      expect(result!.modifications.length).toBeGreaterThan(0);
      expect(result!.summary.modified).toBeGreaterThan(0);
    });

    it('should return null when source not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.diffVersions('p-1', 'nonexistent', 'v-2');

      expect(result).toBeNull();
    });

    it('should return null when target not found', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ ...mockVersionRow, avg_duration: null, success_rate: null }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.diffVersions('p-1', 'v-1', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should detect deletions', async () => {
      const v1 = { ...mockVersionRow, yaml_definition: 'line1\nline2\nline3' };
      const v2 = { ...mockVersionRow, id: 'v-2', yaml_definition: 'line1' };

      pool.query
        .mockResolvedValueOnce({ rows: [{ ...v1, avg_duration: null, success_rate: null }] })
        .mockResolvedValueOnce({ rows: [{ ...v2, avg_duration: null, success_rate: null }] });

      const result = await service.diffVersions('p-1', 'v-1', 'v-2');

      expect(result!.deletions).toContain('line2');
      expect(result!.deletions).toContain('line3');
    });

    it('should handle identical versions', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ ...mockVersionRow, avg_duration: null, success_rate: null }] })
        .mockResolvedValueOnce({ rows: [{ ...mockVersionRow, avg_duration: null, success_rate: null }] });

      const result = await service.diffVersions('p-1', 'v-1', 'v-1');

      expect(result!.summary).toEqual({ added: 0, deleted: 0, modified: 0 });
    });
  });

  // ==================== rollbackToVersion ====================

  describe('rollbackToVersion', () => {
    it('should create a new version as rollback', async () => {
      // Get source version
      pool.query.mockResolvedValueOnce({ rows: [{ ...mockVersionRow, avg_duration: null, success_rate: null }] });
      // Get latest version number
      pool.query.mockResolvedValueOnce({ rows: [{ max_ver: '3' }] });
      // Create new version
      pool.query.mockResolvedValueOnce({ rows: [{ ...mockVersionRow, id: 'v-4', version: 4 }] });

      const result = await service.rollbackToVersion('p-1', 'v-1', { reason: 'Bug fix', createdBy: 'user-1' });

      expect(result).not.toBeNull();
      expect(result!.version).toBe(4);
    });

    it('should return null when version not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.rollbackToVersion('p-1', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should use default change summary', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ ...mockVersionRow, avg_duration: null, success_rate: null }] })
        .mockResolvedValueOnce({ rows: [{ max_ver: '2' }] })
        .mockResolvedValueOnce({ rows: [{ ...mockVersionRow, id: 'v-3', version: 3 }] });

      const result = await service.rollbackToVersion('p-1', 'v-1');

      expect(result).not.toBeNull();
      // The change summary should mention "Rollback to v1"
    });
  });

  // ==================== addTag ====================

  describe('addTag', () => {
    it('should add a tag to a version', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ ...mockVersionRow, tags: ['v1.0'], avg_duration: null, success_rate: null }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.addTag('p-1', 'v-1', 'stable');

      expect(result).toContain('v1.0');
      expect(result).toContain('stable');
    });

    it('should not add duplicate tag', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ ...mockVersionRow, avg_duration: null, success_rate: null }] });

      const result = await service.addTag('p-1', 'v-1', 'v1.0');

      expect(result).toEqual(['v1.0']);
      // Should not have called update query
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('should return null when version not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.addTag('p-1', 'nonexistent', 'tag');

      expect(result).toBeNull();
    });
  });

  // ==================== removeTag ====================

  describe('removeTag', () => {
    it('should remove a tag from a version', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ ...mockVersionRow, avg_duration: null, success_rate: null }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.removeTag('p-1', 'v-1', 'v1.0');

      expect(result).not.toContain('v1.0');
    });

    it('should return null when version not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.removeTag('p-1', 'nonexistent', 'tag');

      expect(result).toBeNull();
    });
  });

  // ==================== setBaseline ====================

  describe('setBaseline', () => {
    it('should set baseline for a version', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ ...mockVersionRow, avg_duration: null, success_rate: null }] })
        .mockResolvedValueOnce({ rowCount: 1 }) // unset existing baselines
        .mockResolvedValueOnce({ rowCount: 1 }); // set new baseline

      const result = await service.setBaseline('p-1', 'v-1', true);

      expect(result).toBe(true);
    });

    it('should unset baseline', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ ...mockVersionRow, is_baseline: true, avg_duration: null, success_rate: null }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.setBaseline('p-1', 'v-1', false);

      expect(result).toBe(true);
    });

    it('should return false when version not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.setBaseline('p-1', 'nonexistent', true);

      expect(result).toBe(false);
    });
  });

  // ==================== getBaselineVersion ====================

  describe('getBaselineVersion', () => {
    it('should return baseline version', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ ...mockVersionRow, is_baseline: true }] });

      const result = await service.getBaselineVersion('p-1');

      expect(result).not.toBeNull();
      expect(result!.isBaseline).toBe(true);
    });

    it('should return null when no baseline', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getBaselineVersion('p-1');

      expect(result).toBeNull();
    });
  });

  // ==================== mapVersion ====================

  describe('mapVersion (internal)', () => {
    it('should handle null fields', async () => {
      const minimal = { id: 'v-1', pipeline_id: 'p-1', version: 1, yaml_definition: '', is_baseline: false };
      pool.query.mockResolvedValueOnce({ rows: [minimal] });

      const result = await service.getVersionByNumber('p-1', 1);

      expect(result!.spec).toEqual({});
      expect(result!.tags).toEqual([]);
      expect(result!.changeSummary).toBeFalsy();
      expect(result!.parentVersionId).toBeFalsy();
      expect(result!.createdBy).toBeFalsy();
    });
  });
});

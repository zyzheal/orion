/**
 * PipelineRepository Unit Tests
 *
 * Tests for PipelineRepository, PipelineStageRepository,
 * PipelineRunRepository, StageExecutionRepository
 */

import {
  PipelineRepository,
  PipelineStageRepository,
  PipelineRunRepository,
  StageExecutionRepository,
} from '../PipelineRepository';

function createMockDb(rows: any[] = []) {
  return {
    query: jest.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  } as any;
}

describe('PipelineRepository', () => {
  let repo: PipelineRepository;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    db = createMockDb();
    repo = new PipelineRepository(db);
  });

  const mockRow = {
    id: 'p-1',
    tenant_id: 't-1',
    project_id: 'proj-1',
    name: 'Build Pipeline',
    description: 'CI pipeline',
    trigger_type: 'manual',
    config: { key: 'value' },
    status: 'active',
    version: 1,
    yaml_definition: 'yaml...',
    spec: { stages: [] },
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    created_by: 'user-1',
  };

  describe('findAll', () => {
    it('should return all pipelines', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await repo.findAll();

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].id).toBe('p-1');
      expect(result.total).toBe(1);
    });

    it('should return empty when no pipelines', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.findAll();

      expect(result.entities).toHaveLength(0);
    });
  });

  describe('findByTenant', () => {
    it('should query by tenant_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await repo.findByTenant('t-1');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $1'),
        ['t-1']
      );
    });
  });

  describe('findByProject', () => {
    it('should query by project_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await repo.findByProject('proj-1');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('project_id = $1'),
        ['proj-1']
      );
    });
  });

  describe('findByName', () => {
    it('should find by name and tenant', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await repo.findByName('Build Pipeline', 't-1');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Build Pipeline');
    });

    it('should find by name without tenant', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await repo.findByName('Build Pipeline');

      expect(result).not.toBeNull();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('name = $1'),
        ['Build Pipeline']
      );
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.findByName('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findVersions', () => {
    it('should find versions by pipeline ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await repo.findVersions('p-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('updateVersion', () => {
    it('should update pipeline version', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...mockRow, version: 2 }] });

      const result = await repo.updateVersion('p-1', 2);

      expect(result).not.toBeNull();
      expect(result!.version).toBe(2);
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.updateVersion('nonexistent', 2);

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return pipeline run statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_runs: '10',
          success_runs: '7',
          failed_runs: '2',
          running_runs: '1',
          avg_duration: '5000',
        }],
      });

      const stats = await repo.getStats('p-1');

      expect(stats.totalRuns).toBe(10);
      expect(stats.successRuns).toBe(7);
      expect(stats.failedRuns).toBe(2);
      expect(stats.runningRuns).toBe(1);
      expect(stats.avgDuration).toBe(5000);
    });

    it('should handle zero stats', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ total_runs: '0', success_runs: '0', failed_runs: '0', running_runs: '0', avg_duration: null }],
      });

      const stats = await repo.getStats('p-1');

      expect(stats.totalRuns).toBe(0);
      expect(stats.avgDuration).toBe(0);
    });
  });

  describe('mapRowToEntity', () => {
    it('should handle null fields gracefully', async () => {
      const minimalRow = { id: 'p-1', name: 'test' };
      db.query.mockResolvedValueOnce({ rows: [minimalRow] });

      const result = await repo.findAll();

      expect(result.entities[0].tenant_id).toBeUndefined();
      expect(result.entities[0].description).toBeNull();
      expect(result.entities[0].trigger_type).toBe('manual');
      expect(result.entities[0].config).toEqual({});
      expect(result.entities[0].status).toBe('active');
      expect(result.entities[0].version).toBe(1);
    });
  });
});

describe('PipelineStageRepository', () => {
  let repo: PipelineStageRepository;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    db = createMockDb();
    repo = new PipelineStageRepository(db);
  });

  const stageRow = {
    id: 's-1',
    pipeline_id: 'p-1',
    name: 'Build',
    type: 'shell',
    config: { command: 'npm build' },
    order_index: 1,
    timeout: 3600,
    retry_count: 0,
    parallel: false,
    conditions: {},
    created_at: '2025-01-01T00:00:00Z',
  };

  describe('findByPipeline', () => {
    it('should find stages by pipeline ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [stageRow] });

      const result = await repo.findByPipeline('p-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Build');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('pipeline_id = $1'),
        ['p-1']
      );
    });
  });

  describe('createForPipeline', () => {
    it('should create a stage for a pipeline', async () => {
      db.query.mockResolvedValueOnce({ rows: [stageRow] });

      const result = await repo.createForPipeline('p-1', {
        name: 'Build',
        type: 'shell',
        order_index: 1,
      });

      expect(result.name).toBe('Build');
      expect(result.pipeline_id).toBe('p-1');
    });

    it('should use defaults for optional fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [stageRow] });

      await repo.createForPipeline('p-1', { name: 'test', type: 'shell', order_index: 0 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([{}, null, 0, false, {}])
      );
    });
  });

  describe('mapRowToEntity', () => {
    it('should handle null fields', async () => {
      const minimal = { id: 's-1', pipeline_id: 'p-1', name: 'test', type: 'shell', order_index: 0 };
      db.query.mockResolvedValueOnce({ rows: [minimal] });

      const result = await repo.findByPipeline('p-1');

      expect(result[0].config).toEqual({});
      expect(result[0].timeout).toBeNull();
      expect(result[0].retry_count).toBe(0);
      expect(result[0].parallel).toBe(false);
      expect(result[0].conditions).toEqual({});
    });
  });
});

describe('PipelineRunRepository', () => {
  let repo: PipelineRunRepository;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    db = createMockDb();
    repo = new PipelineRunRepository(db);
  });

  const runRow = {
    id: 'r-1',
    tenant_id: 't-1',
    pipeline_id: 'p-1',
    trigger_type: 'manual',
    trigger_by: 'user-1',
    status: 'success',
    config_snapshot: { version: '1' },
    started_at: '2025-01-01T00:00:00Z',
    completed_at: '2025-01-01T01:00:00Z',
    duration_ms: 3600000,
    error_message: null,
    created_at: '2025-01-01T00:00:00Z',
  };

  describe('findByPipeline', () => {
    it('should find runs by pipeline with pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [runRow] });

      const result = await repo.findByPipeline('p-1', { limit: 10, offset: 0 });

      expect(result).toHaveLength(1);
    });

    it('should use default pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await repo.findByPipeline('p-1');

      expect(db.query).toHaveBeenCalledWith(expect.any(String), ['p-1', 50, 0]);
    });
  });

  describe('findByTenant', () => {
    it('should find runs by tenant', async () => {
      db.query.mockResolvedValueOnce({ rows: [runRow] });

      const result = await repo.findByTenant('t-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('updateStatus', () => {
    it('should update run status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...runRow, status: 'failed' }] });

      const result = await repo.updateStatus('r-1', 'failed', new Date(), new Date(), 'Error');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('failed');
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.updateStatus('nonexistent', 'failed');

      expect(result).toBeNull();
    });
  });

  describe('mapRowToEntity', () => {
    it('should handle null fields', async () => {
      const minimal = { id: 'r-1', pipeline_id: 'p-1' };
      db.query.mockResolvedValueOnce({ rows: [minimal] });

      const result = await repo.findByPipeline('p-1');

      expect(result[0].trigger_type).toBe('manual');
      expect(result[0].status).toBe('pending');
      expect(result[0].started_at).toBeNull();
      expect(result[0].completed_at).toBeNull();
      expect(result[0].duration_ms).toBeNull();
    });
  });
});

describe('StageExecutionRepository', () => {
  let repo: StageExecutionRepository;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    db = createMockDb();
    repo = new StageExecutionRepository(db);
  });

  const execRow = {
    id: 'e-1',
    run_id: 'r-1',
    stage_id: 's-1',
    stage_name: 'Build',
    status: 'success',
    started_at: '2025-01-01T00:00:00Z',
    completed_at: '2025-01-01T00:05:00Z',
    duration_ms: 300000,
    error_message: null,
    logs: 'Build output...',
    created_at: '2025-01-01T00:00:00Z',
  };

  describe('findByRun', () => {
    it('should find executions by run ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [execRow] });

      const result = await repo.findByRun('r-1');

      expect(result).toHaveLength(1);
      expect(result[0].stage_name).toBe('Build');
    });
  });

  describe('updateStatus', () => {
    it('should update execution status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...execRow, status: 'failed' }] });

      const result = await repo.updateStatus('e-1', 'failed');

      expect(result).not.toBeNull();
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repo.updateStatus('nonexistent', 'failed');

      expect(result).toBeNull();
    });
  });

  describe('mapRowToEntity', () => {
    it('should handle null fields', async () => {
      const minimal = { id: 'e-1', run_id: 'r-1', stage_name: 'test' };
      db.query.mockResolvedValueOnce({ rows: [minimal] });

      const result = await repo.findByRun('r-1');

      expect(result[0].stage_id).toBeNull();
      expect(result[0].status).toBe('pending');
      expect(result[0].logs).toBeNull();
    });
  });
});

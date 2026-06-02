/**
 * DualEngineRepository Tests
 *
 * Covers:
 * - create(): INSERT with all fields, JSON serialization of configs
 * - findById(): found, not found
 * - findAll(): multiple results, empty results, tenant filtering
 * - update(): partial updates (name, description, astConfig, llmConfig, status), no-op updates, not found
 * - delete(): success, not found
 * - getStatus(): found, not found
 * - updateStatus(): partial status updates
 * - mapRow(): JSON parsing of ast_config/llm_config (string vs object)
 * - Error propagation from database
 */

import { DualEngineRepository } from '../dual-engine-repository';
import { AstAnalysisConfig, LlmParsingConfig } from '../dual-engine-model';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockDb() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
}

function createAstConfig(overrides: Partial<AstAnalysisConfig> = {}): AstAnalysisConfig {
  return {
    supportedLanguages: ['python', 'javascript'],
    parseTimeout: 5000,
    incrementalParsing: true,
    maxDepth: 10,
    ...overrides,
  };
}

function createLlmConfig(overrides: Partial<LlmParsingConfig> = {}): LlmParsingConfig {
  return {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
    contextLearning: true,
    contextWindowSize: 4000,
    ...overrides,
  };
}

function createDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'de-001',
    tenant_id: 't1',
    name: 'Test Engine',
    description: 'A test engine',
    ast_config: JSON.stringify(createAstConfig()),
    llm_config: JSON.stringify(createLlmConfig()),
    status: 'active',
    created_at: '2026-06-02T10:00:00.000Z',
    updated_at: '2026-06-02T10:00:00.000Z',
    ...overrides,
  };
}

function createStatusDbRow(overrides: Record<string, unknown> = {}) {
  return {
    engine_id: 'de-001',
    ast_status: 'idle',
    llm_status: 'idle',
    current_processing_files: 0,
    processed_files: 10,
    error_files: 0,
    last_updated_at: '2026-06-02T10:00:00.000Z',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('DualEngineRepository', () => {
  let db: ReturnType<typeof createMockDb>;
  let repo: DualEngineRepository;

  beforeEach(() => {
    db = createMockDb();
    repo = new DualEngineRepository(db as any);
  });

  // ─── create ─────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should INSERT with all fields and return mapped config', async () => {
      const row = createDbRow();
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const result = await repo.create('t1', 'Test Engine', 'A test engine', createAstConfig(), createLlmConfig());

      expect(result.id).toBe('de-001');
      expect(result.tenantId).toBe('t1');
      expect(result.name).toBe('Test Engine');
      expect(result.description).toBe('A test engine');
      expect(result.status).toBe('active');
      expect(result.astConfig).toEqual(createAstConfig());
      expect(result.llmConfig).toEqual(createLlmConfig());
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should call db.query with INSERT SQL and correct parameters', async () => {
      const row = createDbRow();
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      await repo.create('t1', 'Test Engine', 'A test engine', createAstConfig(), createLlmConfig());

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO dual_engines');
      expect(sql).toContain('RETURNING *');
      expect(params[1]).toBe('t1');       // tenantId
      expect(params[2]).toBe('Test Engine'); // name
      expect(params[3]).toBe('A test engine'); // description
      expect(typeof params[4]).toBe('string'); // astConfig JSON string
      expect(typeof params[5]).toBe('string'); // llmConfig JSON string
      expect(params[6]).toBe('active');    // default status
    });

    it('should serialize astConfig and llmConfig as JSON strings', async () => {
      const row = createDbRow();
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const astConfig = createAstConfig({ supportedLanguages: ['go'], maxDepth: 5 });
      const llmConfig = createLlmConfig({ model: 'claude-3', temperature: 0.3 });

      await repo.create('t1', 'Engine', 'desc', astConfig, llmConfig);

      const [, params] = db.query.mock.calls[0];
      const parsedAst = JSON.parse(params[4]);
      const parsedLlm = JSON.parse(params[5]);
      expect(parsedAst.supportedLanguages).toEqual(['go']);
      expect(parsedAst.maxDepth).toBe(5);
      expect(parsedLlm.model).toBe('claude-3');
      expect(parsedLlm.temperature).toBe(0.3);
    });

    it('should propagate database errors', async () => {
      db.query.mockRejectedValue(new Error('duplicate key'));

      await expect(
        repo.create('t1', 'Engine', 'desc', createAstConfig(), createLlmConfig())
      ).rejects.toThrow('duplicate key');
    });
  });

  // ─── findById ───────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return mapped config when row exists', async () => {
      db.query.mockResolvedValue({ rows: [createDbRow()], rowCount: 1 });

      const result = await repo.findById('de-001');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('de-001');
      expect(result!.tenantId).toBe('t1');
      expect(result!.astConfig).toEqual(createAstConfig());
      expect(result!.llmConfig).toEqual(createLlmConfig());
    });

    it('should return null when row does not exist', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should query with correct id parameter', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findById('de-123');

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('SELECT * FROM dual_engines WHERE id = $1');
      expect(params).toEqual(['de-123']);
    });

    it('should propagate database errors', async () => {
      db.query.mockRejectedValue(new Error('connection refused'));

      await expect(repo.findById('de-001')).rejects.toThrow('connection refused');
    });
  });

  // ─── findAll ────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all engines for a tenant', async () => {
      const rows = [
        createDbRow({ id: 'de-001', name: 'Engine 1' }),
        createDbRow({ id: 'de-002', name: 'Engine 2' }),
      ];
      db.query.mockResolvedValue({ rows, rowCount: 2 });

      const result = await repo.findAll('t1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('de-001');
      expect(result[0].name).toBe('Engine 1');
      expect(result[1].id).toBe('de-002');
      expect(result[1].name).toBe('Engine 2');
    });

    it('should return empty array when no engines exist', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.findAll('t1');

      expect(result).toEqual([]);
    });

    it('should filter by tenantId and order by created_at DESC', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.findAll('tenant-abc');

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('WHERE tenant_id = $1');
      expect(sql).toContain('ORDER BY created_at DESC');
      expect(params).toEqual(['tenant-abc']);
    });

    it('should map each row to DualEngineConfig', async () => {
      const rows = [
        createDbRow({ id: 'de-001', ast_config: JSON.stringify(createAstConfig({ maxDepth: 3 })) }),
      ];
      db.query.mockResolvedValue({ rows, rowCount: 1 });

      const result = await repo.findAll('t1');

      expect(result[0].astConfig.maxDepth).toBe(3);
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update name field', async () => {
      const updatedRow = createDbRow({ name: 'Updated Engine' });
      db.query.mockResolvedValue({ rows: [updatedRow], rowCount: 1 });

      const result = await repo.update('de-001', { name: 'Updated Engine' });

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Updated Engine');

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('name = $1');
      expect(sql).toContain('updated_at = $2');
      expect(sql).toContain('WHERE id = $3');
      expect(params[0]).toBe('Updated Engine');
    });

    it('should update description field', async () => {
      const updatedRow = createDbRow({ description: 'New description' });
      db.query.mockResolvedValue({ rows: [updatedRow], rowCount: 1 });

      const result = await repo.update('de-001', { description: 'New description' });

      expect(result!.description).toBe('New description');
      const [sql] = db.query.mock.calls[0];
      expect(sql).toContain('description = $1');
    });

    it('should update status field', async () => {
      const updatedRow = createDbRow({ status: 'inactive' });
      db.query.mockResolvedValue({ rows: [updatedRow], rowCount: 1 });

      const result = await repo.update('de-001', { status: 'inactive' });

      expect(result!.status).toBe('inactive');
      const [sql] = db.query.mock.calls[0];
      expect(sql).toContain('status = $1');
    });

    it('should update astConfig as JSON string', async () => {
      const newAst = createAstConfig({ maxDepth: 20 });
      const updatedRow = createDbRow({ ast_config: JSON.stringify(newAst) });
      db.query.mockResolvedValue({ rows: [updatedRow], rowCount: 1 });

      const result = await repo.update('de-001', { astConfig: newAst });

      expect(result!.astConfig.maxDepth).toBe(20);
      const [, params] = db.query.mock.calls[0];
      const parsed = JSON.parse(params[0]);
      expect(parsed.maxDepth).toBe(20);
    });

    it('should update llmConfig as JSON string', async () => {
      const newLlm = createLlmConfig({ model: 'gpt-4o' });
      const updatedRow = createDbRow({ llm_config: JSON.stringify(newLlm) });
      db.query.mockResolvedValue({ rows: [updatedRow], rowCount: 1 });

      const result = await repo.update('de-001', { llmConfig: newLlm });

      expect(result!.llmConfig.model).toBe('gpt-4o');
    });

    it('should update multiple fields at once', async () => {
      const updatedRow = createDbRow({ name: 'New', status: 'error' });
      db.query.mockResolvedValue({ rows: [updatedRow], rowCount: 1 });

      await repo.update('de-001', { name: 'New', status: 'error' });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('name = $1');
      expect(sql).toContain('status = $2');
      expect(sql).toContain('updated_at = $3');
      expect(params[0]).toBe('New');
      expect(params[1]).toBe('error');
    });

    it('should return existing config when no updates provided (no-op)', async () => {
      const existingRow = createDbRow();
      db.query.mockResolvedValue({ rows: [existingRow], rowCount: 1 });

      const result = await repo.update('de-001', {});

      expect(result).not.toBeNull();
      expect(result!.id).toBe('de-001');
      // Should call findById, not UPDATE
      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql] = db.query.mock.calls[0];
      expect(sql).toContain('SELECT * FROM dual_engines WHERE id = $1');
    });

    it('should return null when engine not found on update', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.update('non-existent', { name: 'New' });

      expect(result).toBeNull();
    });

    it('should propagate database errors', async () => {
      db.query.mockRejectedValue(new Error('constraint violation'));

      await expect(
        repo.update('de-001', { name: 'New' })
      ).rejects.toThrow('constraint violation');
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should return true when engine is deleted', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const result = await repo.delete('de-001');

      expect(result).toBe(true);
      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM dual_engines WHERE id = $1');
      expect(params).toEqual(['de-001']);
    });

    it('should return false when engine does not exist', async () => {
      db.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.delete('non-existent');

      expect(result).toBe(false);
    });

    it('should propagate database errors', async () => {
      db.query.mockRejectedValue(new Error('foreign key constraint'));

      await expect(repo.delete('de-001')).rejects.toThrow('foreign key constraint');
    });
  });

  // ─── getStatus ──────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should return mapped status when row exists', async () => {
      const statusRow = createStatusDbRow();
      db.query.mockResolvedValue({ rows: [statusRow], rowCount: 1 });

      const result = await repo.getStatus('de-001');

      expect(result).not.toBeNull();
      expect(result!.engineId).toBe('de-001');
      expect(result!.astStatus).toBe('idle');
      expect(result!.llmStatus).toBe('idle');
      expect(result!.currentProcessingFiles).toBe(0);
      expect(result!.processedFiles).toBe(10);
      expect(result!.errorFiles).toBe(0);
      expect(result!.lastUpdatedAt).toBeInstanceOf(Date);
    });

    it('should return null when status not found', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const result = await repo.getStatus('non-existent');

      expect(result).toBeNull();
    });

    it('should query with correct engineId parameter', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await repo.getStatus('de-456');

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('SELECT * FROM dual_engine_status WHERE engine_id = $1');
      expect(params).toEqual(['de-456']);
    });
  });

  // ─── updateStatus ───────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update astStatus field', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      await repo.updateStatus('de-001', { astStatus: 'processing' });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('ast_status = $1');
      expect(sql).toContain('last_updated_at = $2');
      expect(sql).toContain('WHERE engine_id = $3');
      expect(params[0]).toBe('processing');
    });

    it('should update llmStatus field', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      await repo.updateStatus('de-001', { llmStatus: 'error' });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('llm_status = $1');
      expect(params[0]).toBe('error');
    });

    it('should update currentProcessingFiles', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      await repo.updateStatus('de-001', { currentProcessingFiles: 5 });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('current_processing_files = $1');
      expect(params[0]).toBe(5);
    });

    it('should update processedFiles', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      await repo.updateStatus('de-001', { processedFiles: 100 });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('processed_files = $1');
      expect(params[0]).toBe(100);
    });

    it('should update errorFiles', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      await repo.updateStatus('de-001', { errorFiles: 3 });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('error_files = $1');
      expect(params[0]).toBe(3);
    });

    it('should update multiple status fields at once', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      await repo.updateStatus('de-001', {
        astStatus: 'processing',
        llmStatus: 'processing',
        currentProcessingFiles: 5,
      });

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('ast_status = $1');
      expect(sql).toContain('llm_status = $2');
      expect(sql).toContain('current_processing_files = $3');
      expect(sql).toContain('last_updated_at = $4');
      expect(sql).toContain('WHERE engine_id = $5');
      expect(params[0]).toBe('processing');
      expect(params[1]).toBe('processing');
      expect(params[2]).toBe(5);
    });

    it('should always include last_updated_at', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      await repo.updateStatus('de-001', {});

      const [sql, params] = db.query.mock.calls[0];
      expect(sql).toContain('last_updated_at = $1');
      expect(sql).toContain('WHERE engine_id = $2');
      expect(params[1]).toBe('de-001');
    });

    it('should propagate database errors', async () => {
      db.query.mockRejectedValue(new Error('timeout'));

      await expect(
        repo.updateStatus('de-001', { astStatus: 'error' })
      ).rejects.toThrow('timeout');
    });
  });

  // ─── mapRow edge cases ──────────────────────────────────────────────────

  describe('mapRow edge cases', () => {
    it('should parse ast_config when it is already an object', async () => {
      const row = createDbRow();
      // Simulate DB returning object instead of JSON string
      row.ast_config = createAstConfig();
      row.llm_config = createLlmConfig();
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const result = await repo.findById('de-001');

      expect(result).not.toBeNull();
      expect(result!.astConfig).toEqual(createAstConfig());
      expect(result!.llmConfig).toEqual(createLlmConfig());
    });

    it('should parse ast_config when it is a JSON string', async () => {
      const row = createDbRow();
      // ast_config is already a JSON string from createDbRow
      db.query.mockResolvedValue({ rows: [row], rowCount: 1 });

      const result = await repo.findById('de-001');

      expect(result).not.toBeNull();
      expect(typeof result!.astConfig).toBe('object');
      expect(result!.astConfig.supportedLanguages).toEqual(['python', 'javascript']);
    });

    it('should correctly map all DualEngineStatus fields', async () => {
      const statusRow = createStatusDbRow({
        engine_id: 'de-999',
        ast_status: 'error',
        llm_status: 'processing',
        current_processing_files: 7,
        processed_files: 50,
        error_files: 2,
        last_updated_at: '2026-06-01T08:00:00.000Z',
      });
      db.query.mockResolvedValue({ rows: [statusRow], rowCount: 1 });

      const result = await repo.getStatus('de-999');

      expect(result).not.toBeNull();
      expect(result!.engineId).toBe('de-999');
      expect(result!.astStatus).toBe('error');
      expect(result!.llmStatus).toBe('processing');
      expect(result!.currentProcessingFiles).toBe(7);
      expect(result!.processedFiles).toBe(50);
      expect(result!.errorFiles).toBe(2);
      expect(result!.lastUpdatedAt).toEqual(new Date('2026-06-01T08:00:00.000Z'));
    });
  });
});

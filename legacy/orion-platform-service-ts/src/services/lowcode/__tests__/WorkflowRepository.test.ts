/**
 * WorkflowRepository - Comprehensive Unit Tests
 *
 * Covers: WorkflowDefinitionRepository CRUD, WorkflowInstanceRepository CRUD,
 * findByIds, findByTenant, addHistory, updateStatus, cleanupExpiredInstances,
 * error handling, and edge cases.
 */

// Mock pino logger
jest.mock('pino', () => {
  return jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });
});

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Date.now()),
}));

// Mock LowcodeWorkflowDefinitionPgRepository
jest.mock('../../../repositories/LowcodeWorkflowDefinitionRepository', () => ({
  LowcodeWorkflowDefinitionPgRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({}),
  })),
}));

// Mock LowcodeWorkflowInstancePgRepository
jest.mock('../../../repositories/LowcodeWorkflowInstanceRepository', () => ({
  LowcodeWorkflowInstancePgRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({}),
  })),
}));

import { WorkflowDefinitionRepository, WorkflowInstanceRepository } from '../WorkflowRepository';
import type { WorkflowDefinition, WorkflowInstance } from '../types';

// ─── Mock DB ────────────────────────────────────────────────────────────────

function createMockPool() {
  return {
    query: jest.fn(),
  };
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const dbDefRow = {
  id: 'def-1',
  tenant_id: 'tenant-1',
  name: 'Test Workflow',
  description: 'A test workflow',
  version: 1,
  enabled: true,
  nodes: JSON.stringify([{ id: 'n1', type: 'start', name: 'Start', position: { x: 0, y: 0 }, config: { type: 'start' } }]),
  edges: JSON.stringify([]),
  created_by: 'user-1',
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const dbInstanceRow = {
  id: 'inst-1',
  workflow_id: 'wf-1',
  workflow_definition_id: 'def-1',
  tenant_id: 'tenant-1',
  status: 'pending',
  current_node_id: 'n1',
  variables: JSON.stringify({}),
  history: JSON.stringify([]),
  input: JSON.stringify({ key: 'value' }),
  output: null,
  error: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  completed_at: null,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('WorkflowDefinitionRepository', () => {
  let repo: WorkflowDefinitionRepository;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    mockPool = createMockPool();
    repo = new WorkflowDefinitionRepository(mockPool as any);
  });

  describe('create', () => {
    it('should create a workflow definition', async () => {
      mockPool.query.mockResolvedValue({ rows: [dbDefRow] });

      const result = await repo.create({
        tenantId: 'tenant-1',
        name: 'Test Workflow',
        description: 'A test workflow',
        version: 1,
        enabled: true,
        nodes: [{ id: 'n1', type: 'start', name: 'Start', position: { x: 0, y: 0 }, config: { type: 'start' } }] as any,
        edges: [],
        createdBy: 'user-1',
      });

      expect(result.id).toBe('def-1');
      expect(result.name).toBe('Test Workflow');
      expect(result.tenantId).toBe('tenant-1');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO lowcode_workflow_definition'),
        expect.arrayContaining(['tenant-1', 'Test Workflow']),
      );
    });

    it('should handle null description', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ ...dbDefRow, description: null }] });

      const result = await repo.create({
        tenantId: 'tenant-1',
        name: 'Test',
        version: 1,
        enabled: true,
        nodes: [],
        edges: [],
        createdBy: 'user-1',
      });

      expect(result.description).toBeNull();
    });

    it('should throw on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      await expect(
        repo.create({
          tenantId: 't1',
          name: 'Test',
          version: 1,
          enabled: true,
          nodes: [],
          edges: [],
          createdBy: 'u1',
        }),
      ).rejects.toThrow('DB error');
    });
  });

  describe('findById', () => {
    it('should return definition when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [dbDefRow] });

      const result = await repo.findById('def-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('def-1');
      expect(result!.nodes).toEqual([{ id: 'n1', type: 'start', name: 'Start', position: { x: 0, y: 0 }, config: { type: 'start' } }]);
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findById('missing');
      expect(result).toBeNull();
    });

    it('should throw on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      await expect(repo.findById('def-1')).rejects.toThrow('DB error');
    });
  });

  describe('findByIds', () => {
    it('should return name map for given ids', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'def-1', name: 'Workflow A' },
          { id: 'def-2', name: 'Workflow B' },
        ],
      });

      const result = await repo.findByIds(['def-1', 'def-2']);
      expect(result.size).toBe(2);
      expect(result.get('def-1')).toBe('Workflow A');
      expect(result.get('def-2')).toBe('Workflow B');
    });

    it('should return empty map for empty ids', async () => {
      const result = await repo.findByIds([]);
      expect(result.size).toBe(0);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all definitions with total', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbDefRow] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await repo.findAll();
      expect(result.entities).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by enabled', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbDefRow] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      await repo.findAll({ enabled: true });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE enabled = $1'),
        [true],
      );
    });

    it('should apply limit and offset', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await repo.findAll({ limit: 5, offset: 10 });
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('LIMIT 5');
      expect(sql).toContain('OFFSET 10');
    });

    it('should return empty result on error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      const result = await repo.findAll();
      expect(result.entities).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findByTenant', () => {
    it('should find definitions by tenant', async () => {
      mockPool.query.mockResolvedValue({ rows: [dbDefRow] });

      const result = await repo.findByTenant('tenant-1');
      expect(result).toHaveLength(1);
      expect(result[0].tenantId).toBe('tenant-1');
    });

    it('should filter by enabled', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findByTenant('t1', { enabled: false });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND enabled = $2'),
        expect.arrayContaining(['t1', false]),
      );
    });

    it('should throw on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      await expect(repo.findByTenant('t1')).rejects.toThrow('DB error');
    });
  });

  describe('update', () => {
    it('should update definition and return updated row', async () => {
      // First call: findById (inside update)
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbDefRow] })
        .mockResolvedValueOnce({ rows: [{ ...dbDefRow, name: 'Updated' }] });

      const result = await repo.update('def-1', { name: 'Updated' });
      expect(result!.name).toBe('Updated');
    });

    it('should return null when definition not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.update('missing', { name: 'New' });
      expect(result).toBeNull();
    });

    it('should throw on database error', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbDefRow] })
        .mockRejectedValueOnce(new Error('DB error'));

      await expect(repo.update('def-1', { name: 'Fail' })).rejects.toThrow('DB error');
    });
  });

  describe('delete', () => {
    it('should return true when deleted', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await repo.delete('def-1');
      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.delete('missing');
      expect(result).toBe(false);
    });

    it('should throw on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      await expect(repo.delete('def-1')).rejects.toThrow('DB error');
    });
  });

  describe('mapRowToDefinition (private via public methods)', () => {
    it('should parse JSON string nodes and edges', async () => {
      mockPool.query.mockResolvedValue({ rows: [dbDefRow] });

      const result = await repo.findById('def-1');
      expect(Array.isArray(result!.nodes)).toBe(true);
      expect(Array.isArray(result!.edges)).toBe(true);
    });

    it('should handle already-parsed nodes and edges', async () => {
      const row = {
        ...dbDefRow,
        nodes: [{ id: 'n1' }],
        edges: [],
      };
      mockPool.query.mockResolvedValue({ rows: [row] });

      const result = await repo.findById('def-1');
      expect(Array.isArray(result!.nodes)).toBe(true);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WorkflowInstanceRepository Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('WorkflowInstanceRepository', () => {
  let repo: WorkflowInstanceRepository;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    mockPool = createMockPool();
    repo = new WorkflowInstanceRepository(mockPool as any);
  });

  describe('create', () => {
    it('should create a workflow instance', async () => {
      mockPool.query.mockResolvedValue({ rows: [dbInstanceRow] });

      const result = await repo.create({
        workflowId: 'wf-1',
        workflowDefinitionId: 'def-1',
        tenantId: 'tenant-1',
        status: 'pending',
        currentNodeId: 'n1',
        variables: {},
        history: [],
        input: { key: 'value' },
      });

      expect(result.id).toBe('inst-1');
      expect(result.status).toBe('pending');
      expect(result.input).toEqual({ key: 'value' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO lowcode_workflow_instance'),
        expect.any(Array),
      );
    });

    it('should handle optional fields (output, error, completedAt)', async () => {
      const rowWithOptionals = {
        ...dbInstanceRow,
        output: JSON.stringify({ result: 'ok' }),
        error: 'some error',
        completed_at: new Date('2026-06-01'),
      };
      mockPool.query.mockResolvedValue({ rows: [rowWithOptionals] });

      const result = await repo.create({
        workflowId: 'wf-1',
        workflowDefinitionId: 'def-1',
        tenantId: 'tenant-1',
        status: 'completed',
        currentNodeId: 'n1',
        variables: {},
        history: [],
        input: {},
        output: { result: 'ok' },
        error: 'some error',
        completedAt: new Date('2026-06-01'),
      });

      expect(result.output).toEqual({ result: 'ok' });
      expect(result.error).toBe('some error');
      expect(result.completedAt).toBeDefined();
    });

    it('should throw on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB error'));

      await expect(
        repo.create({
          workflowId: 'wf-1',
          workflowDefinitionId: 'def-1',
          tenantId: 'tenant-1',
          status: 'pending',
          currentNodeId: 'n1',
          variables: {},
          history: [],
          input: {},
        }),
      ).rejects.toThrow('DB error');
    });
  });

  describe('findById', () => {
    it('should return instance when found', async () => {
      mockPool.query.mockResolvedValue({ rows: [dbInstanceRow] });

      const result = await repo.findById('inst-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('inst-1');
      expect(result!.workflowId).toBe('wf-1');
    });

    it('should return null when not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.findById('missing');
      expect(result).toBeNull();
    });
  });

  describe('findByWorkflowId', () => {
    it('should find instances by workflow id', async () => {
      mockPool.query.mockResolvedValue({ rows: [dbInstanceRow] });

      const result = await repo.findByWorkflowId('wf-1');
      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findByWorkflowId('wf-1', { status: 'running' });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('AND status = $2'),
        expect.arrayContaining(['wf-1', 'running']),
      );
    });

    it('should apply limit and offset', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.findByWorkflowId('wf-1', { limit: 5, offset: 10 });
      const sql = mockPool.query.mock.calls[0][0] as string;
      expect(sql).toContain('LIMIT 5');
      expect(sql).toContain('OFFSET 10');
    });
  });

  describe('update', () => {
    it('should update instance status', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbInstanceRow] })
        .mockResolvedValueOnce({ rows: [{ ...dbInstanceRow, status: 'running' }] });

      const result = await repo.update('inst-1', { status: 'running' });
      expect(result!.status).toBe('running');
    });

    it('should update currentNodeId, variables, history', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbInstanceRow] })
        .mockResolvedValueOnce({
          rows: [{
            ...dbInstanceRow,
            current_node_id: 'n2',
            variables: JSON.stringify({ x: 1 }),
            history: JSON.stringify([{ nodeId: 'n1' }]),
          }],
        });

      const result = await repo.update('inst-1', {
        currentNodeId: 'n2',
        variables: { x: 1 },
        history: [{ nodeId: 'n1' } as any],
      });

      expect(result!.currentNodeId).toBe('n2');
    });

    it('should update output, error, and completedAt', async () => {
      const completedAt = new Date();
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbInstanceRow] })
        .mockResolvedValueOnce({
          rows: [{
            ...dbInstanceRow,
            status: 'completed',
            output: JSON.stringify({ done: true }),
            error: null,
            completed_at: completedAt,
          }],
        });

      const result = await repo.update('inst-1', {
        output: { done: true },
        completedAt,
      });

      expect(result!.output).toEqual({ done: true });
    });

    it('should return null when instance not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.update('missing', { status: 'running' });
      expect(result).toBeNull();
    });
  });

  describe('addHistory', () => {
    it('should append history item to instance', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbInstanceRow] })           // findById
        .mockResolvedValueOnce({ rows: [dbInstanceRow] })           // findById (inside update)
        .mockResolvedValueOnce({ rows: [dbInstanceRow] });          // update query

      await repo.addHistory('inst-1', {
        nodeId: 'n1',
        nodeName: 'Start',
        nodeType: 'start',
        action: 'enter',
        timestamp: new Date(),
      });

      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should throw OrionError when instance not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await expect(
        repo.addHistory('missing', {
          nodeId: 'n1',
          nodeName: 'Start',
          nodeType: 'start',
          action: 'enter',
          timestamp: new Date(),
        }),
      ).rejects.toThrow();
    });
  });

  describe('updateStatus', () => {
    it('should update status without error', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbInstanceRow] })
        .mockResolvedValueOnce({ rows: [{ ...dbInstanceRow, status: 'running' }] });

      const result = await repo.updateStatus('inst-1', 'running');
      expect(result!.status).toBe('running');
    });

    it('should update status with error message', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbInstanceRow] })
        .mockResolvedValueOnce({
          rows: [{ ...dbInstanceRow, status: 'failed', error: 'Something broke' }],
        });

      const result = await repo.updateStatus('inst-1', 'failed', 'Something broke');
      expect(result!.status).toBe('failed');
      expect(result!.error).toBe('Something broke');
    });

    it('should set completedAt for terminal statuses', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbInstanceRow] })
        .mockResolvedValueOnce({
          rows: [{ ...dbInstanceRow, status: 'completed', completed_at: new Date() }],
        });

      const result = await repo.updateStatus('inst-1', 'completed');
      expect(result!.status).toBe('completed');
    });

    it('should set completedAt for failed status', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbInstanceRow] })
        .mockResolvedValueOnce({
          rows: [{ ...dbInstanceRow, status: 'failed', completed_at: new Date() }],
        });

      await repo.updateStatus('inst-1', 'failed');
      const updateCall = mockPool.query.mock.calls[1];
      expect(updateCall[0]).toContain('completed_at');
    });

    it('should set completedAt for terminated status', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbInstanceRow] })
        .mockResolvedValueOnce({
          rows: [{ ...dbInstanceRow, status: 'terminated', completed_at: new Date() }],
        });

      await repo.updateStatus('inst-1', 'terminated');
      const updateCall = mockPool.query.mock.calls[1];
      expect(updateCall[0]).toContain('completed_at');
    });
  });

  describe('cleanupExpiredInstances', () => {
    it('should delete expired instances and return count', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 3 });

      const retentionDate = new Date('2026-01-01');
      const result = await repo.cleanupExpiredInstances(retentionDate);
      expect(result).toBe(3);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM lowcode_workflow_instance'),
        [retentionDate],
      );
    });

    it('should return 0 when no instances deleted', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.cleanupExpiredInstances(new Date());
      expect(result).toBe(0);
    });

    it('should handle null rowCount', async () => {
      mockPool.query.mockResolvedValue({ rowCount: null });

      const result = await repo.cleanupExpiredInstances(new Date());
      expect(result).toBe(0);
    });
  });

  describe('mapRowToInstance (private via public methods)', () => {
    it('should parse JSON string fields', async () => {
      mockPool.query.mockResolvedValue({ rows: [dbInstanceRow] });

      const result = await repo.findById('inst-1');
      expect(typeof result!.variables).toBe('object');
      expect(Array.isArray(result!.history)).toBe(true);
      expect(typeof result!.input).toBe('object');
    });

    it('should handle already-parsed object fields', async () => {
      const row = {
        ...dbInstanceRow,
        variables: { x: 1 },
        history: [],
        input: { key: 'val' },
        output: { result: 'ok' },
      };
      mockPool.query.mockResolvedValue({ rows: [row] });

      const result = await repo.findById('inst-1');
      expect(result!.variables).toEqual({ x: 1 });
      expect(result!.output).toEqual({ result: 'ok' });
    });

    it('should handle null output', async () => {
      mockPool.query.mockResolvedValue({ rows: [dbInstanceRow] });

      const result = await repo.findById('inst-1');
      expect(result!.output).toBeUndefined();
    });
  });
});

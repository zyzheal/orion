/**
 * ApprovalGateRepository Tests
 *
 * Tests for PostgreSQL data access layer for approval gates.
 */

import { ApprovalGateRepository } from '../ApprovalGateRepository';

// Mock pg Pool
const createMockPool = () => {
  const rows: any[] = [];

  return {
    query: jest.fn(async (text: string, params?: unknown[]) => {
      // Handle INSERT
      if (text.includes('INSERT INTO approval_gates')) {
        const id = params?.[0];
        rows.push({
          id,
          tenant_id: params?.[1],
          run_id: params?.[2],
          stage_id: params?.[3],
          status: params?.[4],
          requested_by: params?.[5],
          approver_ids: JSON.parse(params?.[6] as string || '[]'),
          metadata: params?.[7] ? JSON.parse(params?.[7] as string) : null,
          created_at: params?.[8],
          updated_at: params?.[9],
        });
        return { rows: [rows[rows.length - 1]], rowCount: 1 };
      }

      // Handle SELECT by id
      if (text.includes('WHERE id = $1')) {
        const found = rows.find(r => r.id === params?.[0]);
        return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
      }

      // Handle SELECT by run_id
      if (text.includes('WHERE run_id = $1')) {
        const found = rows.filter(r => r.run_id === params?.[0]);
        return { rows: found, rowCount: found.length };
      }

      // Handle SELECT by run_id AND stage_id
      if (text.includes('run_id = $1 AND stage_id = $2')) {
        const found = rows.find(r => r.run_id === params?.[0] && r.stage_id === params?.[1]);
        return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
      }

      // Handle UPDATE
      if (text.includes('UPDATE approval_gates')) {
        const id = params?.[params.length - 1];
        const idx = rows.findIndex(r => r.id === id);
        if (idx >= 0) {
          // Simple update simulation - parse SET clause to update fields
          if (text.includes('status = ')) {
            rows[idx].status = 'approved';
          }
          if (text.includes('reviewed_by = ')) {
            rows[idx].reviewed_by = params?.[1];
          }
          rows[idx].updated_at = new Date();
          return { rows: [rows[idx]], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // Handle DELETE
      if (text.includes('DELETE FROM approval_gates')) {
        const idx = rows.findIndex(r => r.id === params?.[0]);
        if (idx >= 0) {
          rows.splice(idx, 1);
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    }),
    rows,
  };
};

describe('ApprovalGateRepository', () => {
  let repository: ApprovalGateRepository;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    mockPool = createMockPool();
    repository = new ApprovalGateRepository(mockPool as any);
  });

  describe('create', () => {
    it('should create a new approval gate', async () => {
      const result = await repository.create({
        tenantId: 'tenant-1',
        runId: 'run-123',
        stageId: 'stage-456',
        requestedBy: 'user1',
        approverIds: ['user1', 'user2'],
        metadata: { reason: 'Need approval' },
      });

      expect(result).toBeDefined();
      expect(result.id).toContain('gate-');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.runId).toBe('run-123');
      expect(result.status).toBe('pending');
      expect(result.approverIds).toEqual(['user1', 'user2']);
    });
  });

  describe('findById', () => {
    it('should return gate when found', async () => {
      const created = await repository.create({
        tenantId: 'tenant-1',
        runId: 'run-123',
        stageId: 'stage-456',
        requestedBy: 'user1',
        approverIds: ['user1'],
      });

      const result = await repository.findById(created.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(created.id);
    });

    it('should return null when not found', async () => {
      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByRunId', () => {
    it('should return all gates for a run', async () => {
      await repository.create({
        tenantId: 'tenant-1',
        runId: 'run-123',
        stageId: 'stage-1',
        requestedBy: 'user1',
        approverIds: ['user1'],
      });

      await repository.create({
        tenantId: 'tenant-1',
        runId: 'run-123',
        stageId: 'stage-2',
        requestedBy: 'user1',
        approverIds: ['user1'],
      });

      await repository.create({
        tenantId: 'tenant-1',
        runId: 'run-other',
        stageId: 'stage-1',
        requestedBy: 'user1',
        approverIds: ['user1'],
      });

      const result = await repository.findByRunId('run-123');

      expect(result).toHaveLength(2);
    });
  });

  describe('findByRunAndStage', () => {
    it('should return gate when found', async () => {
      const created = await repository.create({
        tenantId: 'tenant-1',
        runId: 'run-123',
        stageId: 'stage-456',
        requestedBy: 'user1',
        approverIds: ['user1'],
      });

      const result = await repository.findByRunAndStage('run-123', 'stage-456');

      expect(result).toBeDefined();
      expect(result?.id).toBe(created.id);
    });

    it('should return null when not found', async () => {
      const result = await repository.findByRunAndStage('run-123', 'stage-456');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update gate status', async () => {
      const created = await repository.create({
        tenantId: 'tenant-1',
        runId: 'run-123',
        stageId: 'stage-456',
        requestedBy: 'user1',
        approverIds: ['user1'],
      });

      const result = await repository.update(created.id, {
        status: 'approved',
        reviewedBy: 'user1',
        reviewedAt: new Date(),
        comment: 'Approved',
      });

      expect(result).toBeDefined();
      // Status should be updated
      expect(result?.status).toBe('approved');
      // Note: The mock doesn't perfectly simulate all update fields
    });

    it('should return null when gate not found', async () => {
      const result = await repository.update('non-existent', {
        status: 'approved',
      });

      expect(result).toBeNull();
    });
  });

  describe('isApprovalRequired', () => {
    it('should return true when pending gate exists', async () => {
      await repository.create({
        tenantId: 'tenant-1',
        runId: 'run-123',
        stageId: 'stage-456',
        requestedBy: 'user1',
        approverIds: ['user1'],
      });

      const result = await repository.isApprovalRequired('run-123', 'stage-456');

      expect(result).toBe(true);
    });

    it('should return false when no pending gate', async () => {
      const result = await repository.isApprovalRequired('run-123', 'stage-456');

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete gate', async () => {
      const created = await repository.create({
        tenantId: 'tenant-1',
        runId: 'run-123',
        stageId: 'stage-456',
        requestedBy: 'user1',
        approverIds: ['user1'],
      });

      const result = await repository.delete(created.id);

      expect(result).toBe(true);
    });

    it('should return false when gate not found', async () => {
      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });
  });
});
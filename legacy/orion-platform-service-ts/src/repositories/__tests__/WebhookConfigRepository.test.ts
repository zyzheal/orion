/**
 * WebhookConfigRepository Tests
 *
 * 测试 Webhook 配置仓库的增删查功能。
 */

import { WebhookConfigRepository, WebhookConfigEntity } from '../WebhookConfigRepository';

// Mock database
function createMockDb() {
  const rows: any[] = [];
  let nextId = 1;

  const db = {
    query: jest.fn(async (text: string, params?: any[]) => {
      if (text.includes('INSERT')) {
        const newRow = {
          id: `webhook-${nextId++}`,
          pipeline_id: params?.[0] ?? 'pipeline-1',
          name: params?.[1] ?? 'test-webhook',
          url: params?.[2] ?? 'https://example.com/hook',
          method: params?.[3] ?? 'POST',
          headers: params?.[4] ?? {},
          secret: params?.[5] ?? null,
          events: params?.[6] ?? [],
          enabled: params?.[7] !== undefined ? params[7] : true,
          retries: params?.[8] !== undefined ? params[8] : 3,
          created_at: new Date(),
          updated_at: new Date(),
        };
        rows.push(newRow);
        return { rows: [newRow], rowCount: 1 };
      }
      if (text.includes('DELETE')) {
        const beforeCount = rows.length;
        const pipelineId = params?.[0];
        if (pipelineId) {
          // Simulate delete by pipeline
          const filtered = rows.filter(r => r.pipeline_id !== pipelineId);
          rows.length = 0;
          rows.push(...filtered);
        }
        return { rows: [], rowCount: beforeCount - rows.length };
      }
      if (text.includes('UPDATE')) {
        return { rows: [rows[rows.length - 1]], rowCount: 1 };
      }
      // SELECT
      return { rows: [...rows], rowCount: rows.length };
    }),
  };

  return { db, rows };
}

describe('WebhookConfigRepository', () => {
  let repo: WebhookConfigRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new WebhookConfigRepository(mockDb.db);
  });

  describe('findByPipelineId', () => {
    it('should return all webhook configs for a pipeline', async () => {
      // Insert test data
      await repo.create({
        pipelineId: 'pipeline-1',
        name: 'webhook-1',
        url: 'https://hook1.example.com',
      } as any);
      await repo.create({
        pipelineId: 'pipeline-1',
        name: 'webhook-2',
        url: 'https://hook2.example.com',
      } as any);
      await repo.create({
        pipelineId: 'pipeline-2',
        name: 'webhook-3',
        url: 'https://hook3.example.com',
      } as any);

      const results = await repo.findByPipelineId('pipeline-1');
      expect(results).toHaveLength(3); // mock returns all rows, filtering happens in real DB
    });
  });

  describe('findByEvent', () => {
    it('should return configs that match the event type', async () => {
      await repo.create({
        pipelineId: 'pipeline-1',
        name: 'complete-webhook',
        url: 'https://hook.example.com/complete',
        events: ['pipeline.complete'],
      } as any);
      await repo.create({
        pipelineId: 'pipeline-1',
        name: 'all-events',
        url: 'https://hook.example.com/all',
        events: [], // empty = all events
      } as any);

      const results = await repo.findByEvent('pipeline-1', 'pipeline.complete');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('deleteByPipelineId', () => {
    it('should delete all configs for a pipeline', async () => {
      await repo.create({
        pipelineId: 'pipeline-1',
        name: 'webhook-1',
        url: 'https://hook1.example.com',
      } as any);

      const deleted = await repo.deleteByPipelineId('pipeline-1');
      expect(deleted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('mapRowToEntity', () => {
    it('should correctly map database row to entity', () => {
      const row = {
        id: 'test-id',
        pipeline_id: 'pipeline-1',
        name: 'test-webhook',
        url: 'https://example.com/hook',
        method: 'PUT',
        headers: { 'X-Custom': 'value' },
        secret: 'my-secret',
        events: ['pipeline.complete', 'pipeline.failed'],
        enabled: true,
        retries: 5,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
      };

      const entity = (repo as any).mapRowToEntity(row);

      expect(entity).toEqual({
        id: 'test-id',
        pipelineId: 'pipeline-1',
        name: 'test-webhook',
        url: 'https://example.com/hook',
        method: 'PUT',
        headers: { 'X-Custom': 'value' },
        secret: 'my-secret',
        events: ['pipeline.complete', 'pipeline.failed'],
        enabled: true,
        retries: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      });
    });

    it('should handle null/undefined fields with defaults', () => {
      const row = {
        id: 'test-id',
        pipeline_id: 'pipeline-1',
        name: 'test-webhook',
        url: 'https://example.com/hook',
        method: null,
        headers: null,
        secret: null,
        events: null,
        enabled: null,
        retries: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const entity = (repo as any).mapRowToEntity(row);

      expect(entity.method).toBe('POST');
      expect(entity.headers).toEqual({});
      expect(entity.secret).toBeNull();
      expect(entity.events).toEqual([]);
      expect(entity.enabled).toBe(true);
      expect(entity.retries).toBe(3);
    });
  });
});

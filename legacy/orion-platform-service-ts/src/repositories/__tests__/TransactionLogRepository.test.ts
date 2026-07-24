/**
 * TransactionLogRepository 单元测试
 */

import { TransactionLogRepository } from '../TransactionLogRepository';

describe('TransactionLogRepository', () => {
  let repo: TransactionLogRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new TransactionLogRepository(mockDb);
  });

  describe('save', () => {
    it('应该插入新的 saga checkpoint', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });
      await repo.save({
        transactionId: 'tx-1',
        requestId: 'req-1',
        sagaName: 'TestSaga',
        status: 'pending',
        input: { key: 'value' },
        metadata: { tenantId: 'tenant-1' },
        stepExecutions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO saga_checkpoints'),
        expect.arrayContaining(['tx-1', 'req-1', 'TestSaga', 'pending'])
      );
    });

    it('应该在冲突时更新现有记录', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });
      await repo.save({
        transactionId: 'tx-1',
        requestId: 'req-1',
        sagaName: 'TestSaga',
        status: 'completed',
        input: {},
        metadata: {},
        stepExecutions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (transaction_id) DO UPDATE'),
        expect.any(Array)
      );
    });
  });

  describe('get', () => {
    it('应该通过 transaction_id 查找', async () => {
      const mockRow = {
        transaction_id: 'tx-1',
        request_id: 'req-1',
        saga_name: 'TestSaga',
        status: 'running',
        input: {},
        output: null,
        error: null,
        metadata: {},
        step_executions: [],
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null,
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });
      const result = await repo.get('tx-1');
      expect(result).not.toBeNull();
      expect(result!.transaction_id).toBe('tx-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM saga_checkpoints WHERE transaction_id = $1',
        ['tx-1']
      );
    });

    it('未找到时应该返回 null', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      const result = await repo.get('not-exist');
      expect(result).toBeNull();
    });
  });

  describe('getByRequestId', () => {
    it('应该通过 request_id 查找', async () => {
      const mockRow = {
        transaction_id: 'tx-1',
        request_id: 'req-1',
        saga_name: 'TestSaga',
        status: 'running',
        input: {},
        output: null,
        error: null,
        metadata: {},
        step_executions: [],
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null,
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });
      const result = await repo.getByRequestId('req-1');
      expect(result).not.toBeNull();
      expect(result!.request_id).toBe('req-1');
    });
  });

  describe('delete', () => {
    it('应该删除 checkpoint', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });
      await repo.delete('tx-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM saga_checkpoints WHERE transaction_id = $1',
        ['tx-1']
      );
    });
  });

  describe('query', () => {
    it('应该支持 sagaName 过滤', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await repo.query({ sagaName: 'TestSaga' });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("saga_name = $1"),
        expect.arrayContaining(['TestSaga'])
      );
    });

    it('应该支持 status 过滤', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await repo.query({ status: 'running' });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status IN ($1)'),
        expect.arrayContaining(['running'])
      );
    });

    it('应该支持 status 数组过滤', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await repo.query({ status: ['running', 'compensating'] });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('status IN ($1, $2)'),
        expect.arrayContaining(['running', 'compensating'])
      );
    });

    it('应该支持分页', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await repo.query({ limit: 10, offset: 5 });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 10 OFFSET 5'),
        expect.any(Array)
      );
    });
  });

  describe('getRecoverable', () => {
    it('应该返回 running 和 compensating 状态的事务', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });
      await repo.getRecoverable();
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status IN ('running', 'compensating')")
      );
    });
  });
});

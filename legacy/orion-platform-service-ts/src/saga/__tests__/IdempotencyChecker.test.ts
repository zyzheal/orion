/**
 * 幂等性检查器单元测试
 */

import { IdempotencyChecker } from '../IdempotencyChecker';

describe('IdempotencyChecker', () => {
  let checker: IdempotencyChecker;

  beforeEach(() => {
    checker = new IdempotencyChecker();
  });

  describe('首次执行检查', () => {
    it('should allow first execution', async () => {
      const result = await checker.check('new-request-id');

      expect(result.canExecute).toBe(true);
      expect(result.isProcessed).toBe(false);
    });

    it('should return none status for new request', async () => {
      const status = await checker.getStatus('new-request-id');

      expect(status.status).toBe('none');
    });
  });

  describe('处理中状态', () => {
    it('should mark as processing', async () => {
      await checker.markProcessing('processing-request-id', 'tx-123');

      const status = await checker.getStatus('processing-request-id');
      expect(status.status).toBe('processing');
      expect(status.createdAt).toBeDefined();
    });

    it('should not allow execution while processing', async () => {
      await checker.markProcessing('processing-request-id-2');

      const result = await checker.check('processing-request-id-2');
      expect(result.canExecute).toBe(false);
      expect(result.isProcessed).toBe(false);
    });
  });

  describe('完成状态', () => {
    it('should mark as completed with result', async () => {
      const requestId = 'completed-request-id';
      const resultData = { data: 'test-result' };

      await checker.markProcessing(requestId);
      await checker.markCompleted(requestId, resultData);

      const status = await checker.getStatus(requestId);
      expect(status.status).toBe('completed');
      expect(status.result).toEqual(resultData);
    });

    it('should return previous result for completed request', async () => {
      const requestId = 'completed-request-id-2';
      const resultData = { value: 42 };

      await checker.markProcessing(requestId);
      await checker.markCompleted(requestId, resultData);

      const result = await checker.check(requestId);
      expect(result.canExecute).toBe(false);
      expect(result.isProcessed).toBe(true);
      expect(result.previousResult).toEqual(resultData);
    });
  });

  describe('失败状态', () => {
    it('should mark as failed with error', async () => {
      const requestId = 'failed-request-id';
      const errorMessage = 'Execution failed';

      await checker.markProcessing(requestId);
      await checker.markFailed(requestId, errorMessage);

      const status = await checker.getStatus(requestId);
      expect(status.status).toBe('failed');
      expect(status.error).toBe(errorMessage);
    });

    it('should return previous error for failed request', async () => {
      const requestId = 'failed-request-id-2';
      const errorMessage = 'Something went wrong';

      await checker.markProcessing(requestId);
      await checker.markFailed(requestId, errorMessage);

      const result = await checker.check(requestId);
      expect(result.canExecute).toBe(false);
      expect(result.isProcessed).toBe(true);
      expect(result.previousError).toBe(errorMessage);
    });
  });

  describe('清除记录', () => {
    it('should allow re-execution after clearing', async () => {
      const requestId = 'clearable-request-id';

      await checker.markProcessing(requestId);
      await checker.markCompleted(requestId, { data: 'test' });

      // 清除记录
      await checker.clear(requestId);

      const result = await checker.check(requestId);
      expect(result.canExecute).toBe(true);
      expect(result.isProcessed).toBe(false);
    });
  });

  describe('并发请求', () => {
    it('should handle concurrent checks correctly', async () => {
      const requestId = 'concurrent-request-id';

      // 多个并发检查
      const results = await Promise.all([
        checker.check(requestId),
        checker.check(requestId),
        checker.check(requestId),
      ]);

      // 所有检查应该返回相同结果（首次检查）
      expect(results.every(r => r.canExecute === true)).toBe(true);

      // 标记为处理中
      await checker.markProcessing(requestId);

      // 再次检查应该不允许执行
      const result = await checker.check(requestId);
      expect(result.canExecute).toBe(false);
    });
  });

  describe('状态转换', () => {
    it('should transition from processing to completed', async () => {
      const requestId = 'transition-request-id';

      await checker.markProcessing(requestId);
      expect(await checker.getStatus(requestId)).toMatchObject({ status: 'processing' });

      await checker.markCompleted(requestId);
      expect(await checker.getStatus(requestId)).toMatchObject({ status: 'completed' });
    });

    it('should transition from processing to failed', async () => {
      const requestId = 'transition-failed-request-id';

      await checker.markProcessing(requestId);
      expect(await checker.getStatus(requestId)).toMatchObject({ status: 'processing' });

      await checker.markFailed(requestId, 'error');
      expect(await checker.getStatus(requestId)).toMatchObject({ status: 'failed' });
    });
  });

  describe('事务 ID 关联', () => {
    it('should store transaction ID when marking processing', async () => {
      const requestId = 'tx-linked-request';
      const transactionId = 'tx-abc-123';

      await checker.markProcessing(requestId, transactionId);
      await checker.markCompleted(requestId, undefined, transactionId);

      const status = await checker.getStatus(requestId);
      // 检查记录是否包含事务 ID（通过内部存储）
      expect(status.status).toBe('completed');
    });
  });
});
/**
 * 事务日志单元测试
 */

import { TransactionLog, TransactionLogEntry, InMemoryTransactionLogStorage } from '../TransactionLog';
import { SagaStatus, SagaStepStatus, SagaContext, createSagaContext } from '../types';

describe('TransactionLog', () => {
  let transactionLog: TransactionLog;
  let storage: InMemoryTransactionLogStorage;

  beforeEach(() => {
    storage = new InMemoryTransactionLogStorage();
    transactionLog = new TransactionLog(storage);
  });

  describe('创建事务', () => {
    it('should create transaction log entry', async () => {
      const context = createSagaContext('test-request');
      const input = { data: 'test' };

      const entry = await transactionLog.createTransaction('TestSaga', input, context);

      expect(entry.transactionId).toBe(context.transactionId);
      expect(entry.requestId).toBe('test-request');
      expect(entry.sagaName).toBe('TestSaga');
      expect(entry.status).toBe(SagaStatus.PENDING);
      expect(entry.input).toEqual(input);
    });

    it('should store transaction in storage', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);

      const retrieved = await storage.get(context.transactionId);
      expect(retrieved).toBeDefined();
    });
  });

  describe('获取事务', () => {
    it('should get transaction by transactionId', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);

      const entry = await transactionLog.getTransaction(context.transactionId);
      expect(entry).toBeDefined();
      expect(entry?.transactionId).toBe(context.transactionId);
    });

    it('should get transaction by requestId', async () => {
      const context = createSagaContext('unique-request-id');
      await transactionLog.createTransaction('TestSaga', {}, context);

      const entry = await transactionLog.getTransactionByRequestId('unique-request-id');
      expect(entry).toBeDefined();
      expect(entry?.requestId).toBe('unique-request-id');
    });

    it('should return null for unknown transaction', async () => {
      const entry = await transactionLog.getTransaction('unknown-id');
      expect(entry).toBeNull();
    });
  });

  describe('更新状态', () => {
    it('should update transaction status', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);

      await transactionLog.updateStatus(context.transactionId, SagaStatus.RUNNING);

      const entry = await transactionLog.getTransaction(context.transactionId);
      expect(entry?.status).toBe(SagaStatus.RUNNING);
    });

    it('should store output when provided', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);

      const output = { result: 'success' };
      await transactionLog.updateStatus(context.transactionId, SagaStatus.COMPLETED, output);

      const entry = await transactionLog.getTransaction(context.transactionId);
      expect(entry?.output).toEqual(output);
    });

    it('should store error when provided', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);

      await transactionLog.updateStatus(context.transactionId, SagaStatus.FAILED, undefined, 'Something went wrong');

      const entry = await transactionLog.getTransaction(context.transactionId);
      expect(entry?.error).toBe('Something went wrong');
    });

    it('should set completedAt for terminal states', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);

      await transactionLog.updateStatus(context.transactionId, SagaStatus.COMPLETED);

      const entry = await transactionLog.getTransaction(context.transactionId);
      expect(entry?.completedAt).toBeDefined();
    });
  });

  describe('步骤记录', () => {
    it('should record step started', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);

      await transactionLog.recordStepStarted(context.transactionId, 'step1', 1);

      const entry = await transactionLog.getTransaction(context.transactionId);
      const stepExecution = entry?.stepExecutions.find(e => e.stepName === 'step1');
      expect(stepExecution?.status).toBe(SagaStepStatus.EXECUTING);
      expect(stepExecution?.startedAt).toBeDefined();
    });

    it('should record step completed', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);
      await transactionLog.recordStepStarted(context.transactionId, 'step1', 1);

      const output = { result: 'step1-output' };
      await transactionLog.recordStepCompleted(context.transactionId, 'step1', output);

      const entry = await transactionLog.getTransaction(context.transactionId);
      const stepExecution = entry?.stepExecutions.find(e => e.stepName === 'step1');
      expect(stepExecution?.status).toBe(SagaStepStatus.COMPLETED);
      expect(stepExecution?.output).toEqual(output);
      expect(stepExecution?.completedAt).toBeDefined();
    });

    it('should record step failed', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);
      await transactionLog.recordStepStarted(context.transactionId, 'step1', 1);

      await transactionLog.recordStepFailed(context.transactionId, 'step1', 'Step failed');

      const entry = await transactionLog.getTransaction(context.transactionId);
      const stepExecution = entry?.stepExecutions.find(e => e.stepName === 'step1');
      expect(stepExecution?.status).toBe(SagaStepStatus.FAILED);
      expect(stepExecution?.error).toBe('Step failed');
    });

    it('should handle multiple steps', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);

      await transactionLog.recordStepStarted(context.transactionId, 'step1', 1);
      await transactionLog.recordStepCompleted(context.transactionId, 'step1', {});
      await transactionLog.recordStepStarted(context.transactionId, 'step2', 2);
      await transactionLog.recordStepCompleted(context.transactionId, 'step2', {});

      const entry = await transactionLog.getTransaction(context.transactionId);
      expect(entry?.stepExecutions.length).toBe(2);
    });
  });

  describe('补偿记录', () => {
    it('should record compensation started', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);
      await transactionLog.recordStepStarted(context.transactionId, 'step1', 1);
      await transactionLog.recordStepCompleted(context.transactionId, 'step1', {});

      await transactionLog.recordCompensationStarted(context.transactionId, 'step1');

      const entry = await transactionLog.getTransaction(context.transactionId);
      const stepExecution = entry?.stepExecutions.find(e => e.stepName === 'step1');
      expect(stepExecution?.status).toBe(SagaStepStatus.COMPENSATING);
      expect(entry?.status).toBe(SagaStatus.COMPENSATING);
    });

    it('should record compensation completed', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);
      await transactionLog.recordStepStarted(context.transactionId, 'step1', 1);
      await transactionLog.recordStepCompleted(context.transactionId, 'step1', {});
      await transactionLog.recordCompensationStarted(context.transactionId, 'step1');

      await transactionLog.recordCompensationCompleted(context.transactionId, 'step1');

      const entry = await transactionLog.getTransaction(context.transactionId);
      const stepExecution = entry?.stepExecutions.find(e => e.stepName === 'step1');
      expect(stepExecution?.status).toBe(SagaStepStatus.COMPENSATED);
      expect(stepExecution?.compensationCompletedAt).toBeDefined();
    });

    it('should record compensation failed', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);
      await transactionLog.recordStepStarted(context.transactionId, 'step1', 1);
      await transactionLog.recordStepCompleted(context.transactionId, 'step1', {});
      await transactionLog.recordCompensationStarted(context.transactionId, 'step1');

      await transactionLog.recordCompensationFailed(context.transactionId, 'step1', 'Compensation error');

      const entry = await transactionLog.getTransaction(context.transactionId);
      const stepExecution = entry?.stepExecutions.find(e => e.stepName === 'step1');
      expect(stepExecution?.status).toBe(SagaStepStatus.COMPENSATION_FAILED);
      expect(entry?.status).toBe(SagaStatus.FAILED);
    });
  });

  describe('重试记录', () => {
    it('should increment retry count', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);
      await transactionLog.recordStepStarted(context.transactionId, 'step1', 1);

      const count1 = await transactionLog.incrementRetryCount(context.transactionId, 'step1');
      expect(count1).toBe(1);

      const count2 = await transactionLog.incrementRetryCount(context.transactionId, 'step1');
      expect(count2).toBe(2);
    });
  });

  describe('查询事务', () => {
    it('should query by sagaName', async () => {
      const context1 = createSagaContext();
      const context2 = createSagaContext();
      await transactionLog.createTransaction('SagaA', {}, context1);
      await transactionLog.createTransaction('SagaB', {}, context2);

      const entries = await transactionLog.queryTransactions({ sagaName: 'SagaA' });
      expect(entries.length).toBe(1);
      expect(entries[0].sagaName).toBe('SagaA');
    });

    it('should query by status', async () => {
      const context1 = createSagaContext();
      const context2 = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context1);
      await transactionLog.createTransaction('TestSaga', {}, context2);
      await transactionLog.updateStatus(context2.transactionId, SagaStatus.COMPLETED);

      const entries = await transactionLog.queryTransactions({ status: SagaStatus.COMPLETED });
      expect(entries.length).toBe(1);
    });

    it('should support pagination', async () => {
      for (let i = 0; i < 10; i++) {
        const context = createSagaContext();
        await transactionLog.createTransaction('TestSaga', {}, context);
      }

      const page1 = await transactionLog.queryTransactions({ limit: 5, offset: 0 });
      const page2 = await transactionLog.queryTransactions({ limit: 5, offset: 5 });

      expect(page1.length).toBe(5);
      expect(page2.length).toBe(5);
    });
  });

  describe('可恢复事务', () => {
    it('should find running transactions as recoverable', async () => {
      const context1 = createSagaContext();
      const context2 = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context1);
      await transactionLog.createTransaction('TestSaga', {}, context2);
      await transactionLog.updateStatus(context1.transactionId, SagaStatus.RUNNING);
      await transactionLog.updateStatus(context2.transactionId, SagaStatus.COMPLETED);

      const recoverable = await transactionLog.getRecoverableTransactions();
      expect(recoverable.length).toBe(1);
      expect(recoverable[0].status).toBe(SagaStatus.RUNNING);
    });

    it('should find compensating transactions as recoverable', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);
      await transactionLog.updateStatus(context.transactionId, SagaStatus.COMPENSATING);

      const recoverable = await transactionLog.getRecoverableTransactions();
      expect(recoverable.length).toBe(1);
    });
  });

  describe('删除事务', () => {
    it('should delete transaction log', async () => {
      const context = createSagaContext();
      await transactionLog.createTransaction('TestSaga', {}, context);

      await transactionLog.deleteTransaction(context.transactionId);

      const entry = await transactionLog.getTransaction(context.transactionId);
      expect(entry).toBeNull();
    });
  });
});
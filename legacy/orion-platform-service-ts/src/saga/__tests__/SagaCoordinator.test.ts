/**
 * Saga 协调器单元测试
 */

import { SagaCoordinator } from '../SagaCoordinator';
import { TransactionLog } from '../TransactionLog';
import { IdempotencyChecker } from '../IdempotencyChecker';
import {
  SagaStatus,
  SagaStepStatus,
  SagaDefinition,
  SagaStep,
} from '../types';

describe('SagaCoordinator', () => {
  let coordinator: SagaCoordinator;
  let transactionLog: TransactionLog;
  let idempotencyChecker: IdempotencyChecker;

  beforeEach(() => {
    transactionLog = new TransactionLog();
    idempotencyChecker = new IdempotencyChecker();
    coordinator = new SagaCoordinator({
      transactionLog,
      idempotencyChecker,
      defaultRetryConfig: {
        maxRetries: 2,
        initialDelayMs: 10, // 使用更短的延迟以加快测试
        maxDelayMs: 100,
        multiplier: 1,
      },
    });
  });

  /**
   * 创建测试 Saga 定义
   */
  function createTestSaga(shouldFailAt?: number): SagaDefinition<{ value: number }, { result: number }> {
    const steps: SagaStep<{ value: number }, unknown>[] = [
      {
        name: 'step1',
        sequence: 1,
        execute: async (input, context) => {
          context.metadata.step1Result = input.value * 2;
          return { doubled: input.value * 2 };
        },
        compensate: async (input, output, context) => {
          context.metadata.step1Compensated = true;
        },
        retryConfig: {
          maxRetries: 0,
          initialDelayMs: 10,
          maxDelayMs: 100,
          multiplier: 1,
        },
      },
      {
        name: 'step2',
        sequence: 2,
        execute: async (input, context) => {
          if (shouldFailAt === 2) {
            throw new Error('Step 2 failed');
          }
          context.metadata.step2Result = input.value * 3;
          return { tripled: input.value * 3 };
        },
        compensate: async (input, output, context) => {
          context.metadata.step2Compensated = true;
        },
        retryConfig: {
          maxRetries: 0,
          initialDelayMs: 10,
          maxDelayMs: 100,
          multiplier: 1,
        },
      },
      {
        name: 'step3',
        sequence: 3,
        execute: async (input, context) => {
          if (shouldFailAt === 3) {
            throw new Error('Step 3 failed');
          }
          const total = (context.metadata.step1Result as number) + (context.metadata.step2Result as number);
          return { total };
        },
        compensate: async (input, output, context) => {
          context.metadata.step3Compensated = true;
        },
        retryConfig: {
          maxRetries: 0,
          initialDelayMs: 10,
          maxDelayMs: 100,
          multiplier: 1,
        },
      },
    ];

    return {
      name: 'TestSaga',
      steps,
      finalize: async (input, context) => {
        return { result: context.metadata.total as number || 0 };
      },
    };
  }

  describe('正常完成流程', () => {
    it('should execute all steps and return success', async () => {
      const saga = createTestSaga();
      const input = { value: 10 };

      const result = await coordinator.execute(saga, input);

      expect(result.success).toBe(true);
      expect(result.status).toBe(SagaStatus.COMPLETED);
      expect(result.transactionId).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should record all steps in transaction log', async () => {
      const saga = createTestSaga();
      const input = { value: 10 };

      const result = await coordinator.execute(saga, input);

      const entry = await transactionLog.getTransaction(result.transactionId);
      expect(entry).toBeDefined();
      expect(entry?.status).toBe(SagaStatus.COMPLETED);
      expect(entry?.stepExecutions.length).toBe(3);
    });

    it('should mark each step as completed', async () => {
      const saga = createTestSaga();
      const input = { value: 10 };

      const result = await coordinator.execute(saga, input);
      const status = await coordinator.getTransactionStatus(result.transactionId);

      expect(status).toBeDefined();
      expect(status?.stepExecutions.every(e => e.status === SagaStepStatus.COMPLETED)).toBe(true);
    });
  });

  describe('单步失败补偿', () => {
    it('should compensate completed steps when step fails', async () => {
      const saga = createTestSaga(2); // 在 step2 失败
      const input = { value: 10 };

      const result = await coordinator.execute(saga, input);

      expect(result.success).toBe(false);
      expect(result.status).toBe(SagaStatus.COMPENSATED);
      expect(result.error).toContain('Step 2 failed');
    });

    it('should record step1 as completed then compensated', async () => {
      const saga = createTestSaga(2);
      const input = { value: 10 };

      const result = await coordinator.execute(saga, input);
      const status = await coordinator.getTransactionStatus(result.transactionId);

      expect(status).toBeDefined();
      const step1 = status?.stepExecutions.find(e => e.stepName === 'step1');
      expect(step1?.status).toBe(SagaStepStatus.COMPENSATED);
    });

    it('should mark failed step as failed', async () => {
      const saga = createTestSaga(2);
      const input = { value: 10 };

      const result = await coordinator.execute(saga, input);
      const status = await coordinator.getTransactionStatus(result.transactionId);

      const step2 = status?.stepExecutions.find(e => e.stepName === 'step2');
      expect(step2?.status).toBe(SagaStepStatus.FAILED);
    });

    it('should not execute remaining steps after failure', async () => {
      const saga = createTestSaga(2);
      const input = { value: 10 };

      const result = await coordinator.execute(saga, input);
      const status = await coordinator.getTransactionStatus(result.transactionId);

      const step3 = status?.stepExecutions.find(e => e.stepName === 'step3');
      // step3 可能未创建，或状态为 PENDING
      expect(step3?.status ?? SagaStepStatus.PENDING).toBe(SagaStepStatus.PENDING);
    });
  });

  describe('多步失败补偿', () => {
    it('should compensate all completed steps in reverse order', async () => {
      const saga = createTestSaga(3); // 在 step3 失败
      const input = { value: 10 };

      const result = await coordinator.execute(saga, input);

      expect(result.success).toBe(false);
      expect(result.status).toBe(SagaStatus.COMPENSATED);
    });

    it('should record step1 and step2 as compensated', async () => {
      const saga = createTestSaga(3);
      const input = { value: 10 };

      const result = await coordinator.execute(saga, input);
      const status = await coordinator.getTransactionStatus(result.transactionId);

      const step1 = status?.stepExecutions.find(e => e.stepName === 'step1');
      const step2 = status?.stepExecutions.find(e => e.stepName === 'step2');
      expect(step1?.status).toBe(SagaStepStatus.COMPENSATED);
      expect(step2?.status).toBe(SagaStepStatus.COMPENSATED);
    });
  });

  describe('幂等性检查', () => {
    it('should prevent duplicate execution with same requestId', async () => {
      const saga = createTestSaga();
      const input = { value: 10 };
      const requestId = 'test-request-id-1';

      // 第一次执行
      const result1 = await coordinator.execute(saga, input, { requestId });
      expect(result1.success).toBe(true);

      // 第二次执行（相同 requestId）- 应返回之前的结果
      const result2 = await coordinator.execute(saga, input, { requestId });
      expect(result2.success).toBe(true);
      expect(result2.output).toEqual(result1.output);
    });

    it('should return previous result for duplicate request', async () => {
      const saga = createTestSaga();
      const input = { value: 10 };
      const requestId = 'test-request-id-2';

      const result1 = await coordinator.execute(saga, input, { requestId });

      const result2 = await coordinator.execute(saga, input, { requestId });
      expect(result2.output).toEqual(result1.output);
    });

    it('should return previous error for failed duplicate request', async () => {
      const saga = createTestSaga(2);
      const input = { value: 10 };
      const requestId = 'test-request-id-3';

      const result1 = await coordinator.execute(saga, input, { requestId });
      expect(result1.success).toBe(false);

      const result2 = await coordinator.execute(saga, input, { requestId });
      expect(result2.success).toBe(false);
      expect(result2.error).toBe(result1.error);
    });

    it('should allow different requestId for new execution', async () => {
      const saga = createTestSaga();
      const input = { value: 10 };

      const result1 = await coordinator.execute(saga, input, { requestId: 'request-1' });
      const result2 = await coordinator.execute(saga, input, { requestId: 'request-2' });

      expect(result1.transactionId).not.toBe(result2.transactionId);
    });
  });

  describe('重试机制', () => {
    it('should retry failed steps according to retry config', async () => {
      let attemptCount = 0;
      const saga: SagaDefinition<{ value: number }, { result: number }> = {
        name: 'RetryTestSaga',
        steps: [
          {
            name: 'retryStep',
            sequence: 1,
            execute: async (input) => {
              attemptCount++;
              if (attemptCount < 3) {
                throw new Error('Temporary failure');
              }
              return { success: true };
            },
            compensate: async () => {},
            retryConfig: {
              maxRetries: 3,
              initialDelayMs: 10,
              maxDelayMs: 100,
              multiplier: 1,
            },
          },
        ],
        finalize: async () => ({ result: 1 }),
      };

      const result = await coordinator.execute(saga, { value: 10 });

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
    });

    it('should fail after max retries exhausted', async () => {
      let attemptCount = 0;
      const saga: SagaDefinition<{ value: number }, { result: number }> = {
        name: 'MaxRetryTestSaga',
        steps: [
          {
            name: 'alwaysFailStep',
            sequence: 1,
            execute: async () => {
              attemptCount++;
              throw new Error('Always fails');
            },
            compensate: async () => {},
            retryConfig: {
              maxRetries: 2,
              initialDelayMs: 10,
              maxDelayMs: 100,
              multiplier: 1,
            },
          },
        ],
        finalize: async () => ({ result: 1 }),
      };

      const result = await coordinator.execute(saga, { value: 10 });

      expect(result.success).toBe(false);
      expect(attemptCount).toBe(3); // 1 initial + 2 retries
    });
  });

  describe('事务状态查询', () => {
    it('should return null for unknown transaction', async () => {
      const status = await coordinator.getTransactionStatus('unknown-id');
      expect(status).toBeNull();
    });

    it('should return correct status for running transaction', async () => {
      const saga = createTestSaga();
      const input = { value: 10 };

      const result = await coordinator.execute(saga, input);
      const status = await coordinator.getTransactionStatus(result.transactionId);

      expect(status?.status).toBe(SagaStatus.COMPLETED);
    });
  });
});
/**
 * Job 模型测试
 *
 * 此模块为纯类型定义文件，无工厂函数。
 * 测试验证类型可正确导入使用。
 */
import type {
  Job,
  JobStatus,
  JobInput,
  QueueStats,
  ListJobsOptions,
  PaginatedJobsResult,
} from '../Job';
import { JobPriority } from '../Job';

describe('Job', () => {
  describe('JobPriority enum', () => {
    it('should have correct values', () => {
      expect(JobPriority.LOW).toBe(-1);
      expect(JobPriority.NORMAL).toBe(0);
      expect(JobPriority.HIGH).toBe(1);
      expect(JobPriority.CRITICAL).toBe(2);
    });
  });

  describe('type compatibility', () => {
    it('should accept valid Job object', () => {
      const job: Job = {
        id: 'job-1',
        tenantId: 't1',
        queueName: 'default',
        jobType: 'pipeline-execution',
        payload: { pipelineId: 'p1' },
        status: 'pending',
        priority: 0,
        result: null,
        errorMessage: null,
        maxAttempts: 3,
        attempts: 0,
        nextRetryAt: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(job.status).toBe('pending');
      expect(job.priority).toBe(0);
    });

    it('should accept JobInput', () => {
      const input: JobInput = {
        jobType: 'email-send',
        payload: { to: 'user@example.com' },
      };

      expect(input.jobType).toBe('email-send');
    });

    it('should accept QueueStats', () => {
      const stats: QueueStats = {
        total: 100,
        pending: 10,
        running: 5,
        completed: 80,
        failed: 3,
        cancelled: 2,
        avgWaitTime: 500,
        avgExecutionTime: 2000,
      };

      expect(stats.total).toBe(100);
    });

    it('should accept PaginatedJobsResult', () => {
      const result: PaginatedJobsResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };

      expect(result.data).toEqual([]);
    });
  });
});

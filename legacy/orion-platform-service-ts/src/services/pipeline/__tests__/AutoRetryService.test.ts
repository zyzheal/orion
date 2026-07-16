/**
 * AutoRetryService Tests
 */

import { AutoRetryService } from '../AutoRetryService';
import { ErrorClassifier } from '../ErrorClassifier';

// Mock DatabasePool
const mockDbQuery = jest.fn();
const mockDb = {
  query: mockDbQuery,
};

// Mock ErrorClassifier
const mockClassifyError = jest.fn();
const mockGetErrorStats = jest.fn();
const mockErrorClassifier = {
  classifyError: mockClassifyError,
  getErrorStats: mockGetErrorStats,
} as unknown as ErrorClassifier;

describe('AutoRetryService', () => {
  let service: AutoRetryService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClassifyError.mockResolvedValue({
      type: 'transient',
      shouldRetry: true,
      retryStrategy: 'backoff',
      confidence: 0.9,
      reasoning: 'Test',
    });
    service = new AutoRetryService(mockDb as any, mockErrorClassifier);
  });

  describe('shouldRetry', () => {
    it('should return shouldRetry=true for transient error within limit', async () => {
      const result = await service.shouldRetry(
        new Error('ETIMEDOUT'),
        1,
        { stageName: 'build', retryCount: 1, maxRetries: 3 }
      );

      expect(result.shouldRetry).toBe(true);
      expect(result.strategy).toBe('backoff');
    });

    it('should return shouldRetry=false when max retries exceeded', async () => {
      const result = await service.shouldRetry(
        new Error('ETIMEDOUT'),
        4,
        { stageName: 'build', retryCount: 4, maxRetries: 3 }
      );

      expect(result.shouldRetry).toBe(false);
    });

    it('should return shouldRetry=false for permanent error', async () => {
      mockClassifyError.mockResolvedValueOnce({
        type: 'permanent',
        shouldRetry: false,
        retryStrategy: 'skip',
        confidence: 0.95,
        reasoning: 'Test',
      });

      const result = await service.shouldRetry(
        new Error('SyntaxError'),
        0,
        { stageName: 'build', retryCount: 0, maxRetries: 3 }
      );

      expect(result.shouldRetry).toBe(false);
      expect(result.strategy).toBe('skip');
    });
  });

  describe('executeWithAutoRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue(undefined);

      const result = await service.executeWithAutoRetry(mockFn, 3, {
        runId: 'run-1',
        stageName: 'build',
      });

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(0);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('ETIMEDOUT');
        }
      });

      // Use immediate strategy to avoid long delays
      const result = await service.executeWithAutoRetry(mockFn, 3, {
        runId: 'run-1',
        stageName: 'build',
        config: { strategy: 'immediate', baseDelayMs: 0, maxDelayMs: 0, jitter: false },
      });

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
    });

    it('should stop retrying when strategy is skip', async () => {
      mockClassifyError.mockResolvedValue({
        type: 'permanent',
        shouldRetry: false,
        retryStrategy: 'skip',
        confidence: 0.95,
        reasoning: 'Test',
      });

      const mockFn = jest.fn().mockRejectedValue(new Error('SyntaxError'));

      const result = await service.executeWithAutoRetry(mockFn, 3, {
        runId: 'run-1',
        stageName: 'build',
      });

      expect(result.success).toBe(false);
      // Should not retry for permanent errors
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and return failure', async () => {
      mockClassifyError.mockImplementation(async () => ({
        type: 'transient',
        shouldRetry: true,
        retryStrategy: 'immediate',
        confidence: 0.9,
        reasoning: 'Test',
      }));

      const mockFn = jest.fn().mockImplementation(() => {
        throw new Error('ETIMEDOUT');
      });

      const result = await service.executeWithAutoRetry(mockFn, 2, {
        runId: 'run-1',
        stageName: 'build',
        config: { strategy: 'immediate', baseDelayMs: 0, maxDelayMs: 0, jitter: false },
      });

      expect(result.success).toBe(false);
      // With maxRetries=2: attempt 0 fails, retry recorded (retryCount=1),
      // attempt 1 fails, shouldRetry sees retryCount=2 >= maxRetries=2, so stops.
      // Total: 2 calls (1 initial + 1 retry)
      expect(result.retryCount).toBe(1);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRetryStats', () => {
    it('should return empty stats when db is not available', async () => {
      const noDbService = new AutoRetryService(null, mockErrorClassifier);
      const stats = await noDbService.getRetryStats();

      expect(stats.totalRetries).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    it('should return stats from database', async () => {
      mockDbQuery
        .mockResolvedValueOnce({
          rows: [{ total: '5', successful: '3', failed: '2', unique_runs: '2' }],
        })
        .mockResolvedValueOnce({ rows: [] }) // by strategy
        .mockResolvedValueOnce({ rows: [] }); // by error type

      const stats = await service.getRetryStats();

      expect(stats.totalRetries).toBe(5);
      expect(stats.successfulRetries).toBe(3);
      expect(stats.failedRetries).toBe(2);
      expect(stats.successRate).toBe(0.6);
    });

    it('should filter by pipelineId', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: '0', successful: '0', failed: '0', unique_runs: '0' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.getRetryStats('pipeline-1');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE pipeline_id = $1'),
        ['pipeline-1']
      );
    });

    it('should return global stats when pipelineId is "all"', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: '10', successful: '7', failed: '3', unique_runs: '3' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const stats = await service.getRetryStats('all');

      expect(stats.totalRetries).toBe(10);
    });
  });

  describe('configureRetry', () => {
    it('should return merged config with defaults', async () => {
      const config = await service.configureRetry({
        stageName: 'build',
        maxRetries: 5,
        strategy: 'immediate',
      });

      expect(config.maxRetries).toBe(5);
      expect(config.strategy).toBe('immediate');
      expect(config.baseDelayMs).toBe(1000); // default
      expect(config.maxDelayMs).toBe(60000); // default
    });

    it('should validate that pipelineId or stageName is needed for persistence', async () => {
      // Config without target should still work (just return defaults)
      const config = await service.configureRetry({
        maxRetries: 2,
      });

      expect(config.maxRetries).toBe(2);
    });
  });
});

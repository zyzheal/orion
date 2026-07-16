/**
 * ErrorClassifier Tests
 */

import { ErrorClassifier, ErrorType } from '../ErrorClassifier';

// Mock DatabasePool
const mockDbQuery = jest.fn();
const mockDb = {
  query: mockDbQuery,
};

describe('ErrorClassifier', () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    jest.clearAllMocks();
    classifier = new ErrorClassifier(mockDb as any);
  });

  describe('classifyError', () => {
    it('should classify ETIMEDOUT as transient', async () => {
      const result = await classifier.classifyError('ETIMEDOUT: Connection timed out', {
        stageName: 'build',
        retryCount: 0,
        maxRetries: 3,
      });

      expect(result.type).toBe('transient');
      expect(result.shouldRetry).toBe(true);
      expect(result.retryStrategy).toBe('backoff');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should classify ECONNRESET as transient', async () => {
      const result = await classifier.classifyError('ECONNRESET: Connection reset by peer', {
        stageName: 'deploy',
        retryCount: 0,
        maxRetries: 3,
      });

      expect(result.type).toBe('transient');
      expect(result.shouldRetry).toBe(true);
    });

    it('should classify syntax error as permanent', async () => {
      const result = await classifier.classifyError('compilation failed: type error in main.ts', {
        stageName: 'build',
        retryCount: 0,
        maxRetries: 3,
      });

      expect(result.type).toBe('permanent');
      expect(result.shouldRetry).toBe(false);
      expect(result.retryStrategy).toBe('skip');
    });

    it('should classify permission denied as permanent', async () => {
      const result = await classifier.classifyError('Permission denied: /etc/secret', {
        stageName: 'test',
        retryCount: 0,
        maxRetries: 3,
      });

      expect(result.type).toBe('permanent');
      expect(result.shouldRetry).toBe(false);
    });

    it('should classify missing env var as config error', async () => {
      const result = await classifier.classifyError('Env DATABASE_URL not set', {
        stageName: 'build',
        retryCount: 0,
        maxRetries: 3,
      });

      expect(result.type).toBe('config');
      expect(result.shouldRetry).toBe(false);
    });

    it('should classify 404 as permanent', async () => {
      const result = await classifier.classifyError('404: Repository not found', {
        stageName: 'build',
        retryCount: 0,
        maxRetries: 3,
      });

      expect(result.type).toBe('permanent');
      expect(result.shouldRetry).toBe(false);
    });

    it('should default to transient with low confidence for unknown errors', async () => {
      const result = await classifier.classifyError('Something weird happened', {
        stageName: 'build',
        retryCount: 0,
        maxRetries: 3,
      });

      expect(result.type).toBe('transient');
      expect(result.shouldRetry).toBe(true);
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });

    it('should detect flaky errors when previous errors show inconsistency', async () => {
      const result = await classifier.classifyError('ETIMEDOUT: Connection timed out', {
        stageName: 'build',
        retryCount: 3,
        maxRetries: 5,
        previousErrors: ['Success', 'ETIMEDOUT', 'Success', 'ETIMEDOUT'],
      });

      expect(result.type).toBe('flaky');
      expect(result.shouldRetry).toBe(true);
    });

    it('should not retry when max retries exceeded', async () => {
      const result = await classifier.classifyError('ETIMEDOUT: Connection timed out', {
        stageName: 'build',
        retryCount: 5,
        maxRetries: 3,
      });

      expect(result.shouldRetry).toBe(false);
      expect(result.retryStrategy).toBe('skip');
    });

    it('should handle Error objects', async () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const result = await classifier.classifyError(error, {
        stageName: 'deploy',
        retryCount: 0,
        maxRetries: 3,
      });

      expect(result.type).toBe('transient');
    });

    it('should classify OOMKilled as transient', async () => {
      const result = await classifier.classifyError('Container was OOMKilled', {
        stageName: 'test',
        retryCount: 0,
        maxRetries: 3,
      });

      expect(result.type).toBe('transient');
    });

    it('should classify rate limit as transient', async () => {
      const result = await classifier.classifyError('Rate limit exceeded', {
        stageName: 'build',
        retryCount: 0,
        maxRetries: 3,
      });

      expect(result.type).toBe('transient');
    });

    it('should classify ENOENT as config error', async () => {
      const result = await classifier.classifyError('ENOENT: no such file or directory, open config.json', {
        stageName: 'build',
        retryCount: 0,
        maxRetries: 3,
      });

      expect(result.type).toBe('config');
    });
  });

  describe('getErrorStats', () => {
    it('should return empty stats when db is not available', async () => {
      const noDbClassifier = new ErrorClassifier(null);
      const stats = await noDbClassifier.getErrorStats();

      expect(stats.total).toBe(0);
      expect(stats.byType.transient).toBe(0);
      expect(stats.topErrors).toEqual([]);
    });

    it('should return stats from database', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [] }) // type stats
        .mockResolvedValueOnce({ rows: [{ total: '5' }] }) // total
        .mockResolvedValueOnce({ rows: [{ total_classified: '3', retry_success: '2' }] }) // retry stats
        .mockResolvedValueOnce({ rows: [] }); // top errors

      const stats = await classifier.getErrorStats();

      expect(stats.total).toBe(5);
      expect(stats.retrySuccessRate).toBeCloseTo(2 / 3);
    });

    it('should filter stats by stage name', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '2' }] })
        .mockResolvedValueOnce({ rows: [{ total_classified: '0', retry_success: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await classifier.getErrorStats('build');

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE stage_name = $1'),
        ['build']
      );
    });
  });
});

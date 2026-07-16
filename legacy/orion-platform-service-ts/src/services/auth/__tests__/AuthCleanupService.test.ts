/**
 * Tests for AuthCleanupService
 */
import { AuthCleanupService } from '../AuthCleanupService';

const mockQuery = jest.fn();
const mockCleanupExpired = jest.fn();
const mockTracingCleanup = jest.fn();
const mockDbProfilerCleanup = jest.fn();

jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue({
    stop: jest.fn(),
    unref: jest.fn(),
  }),
}));

describe('AuthCleanupService', () => {
  let service: AuthCleanupService;
  const mockPool = { query: mockQuery };
  const mockTokenBlacklist = { cleanupExpired: mockCleanupExpired };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthCleanupService(mockPool as any, mockTokenBlacklist as any);
  });

  describe('cleanupExpiredBlacklist', () => {
    it('should call tokenBlacklist.cleanupExpired', async () => {
      mockCleanupExpired.mockResolvedValue(5);

      const result = await service.cleanupExpiredBlacklist();

      expect(result).toBe(5);
      expect(mockCleanupExpired).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredRefreshTokens', () => {
    it('should delete expired refresh tokens', async () => {
      mockQuery.mockResolvedValue({ rowCount: 3 });

      const result = await service.cleanupExpiredRefreshTokens();

      expect(result).toBe(3);
    });

    it('should return 0 when no tokens deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });

      const result = await service.cleanupExpiredRefreshTokens();

      expect(result).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('DB error'));

      const result = await service.cleanupExpiredRefreshTokens();

      expect(result).toBe(0);
    });
  });

  describe('checkSuspensionExpiry', () => {
    it('should restore expired suspended users', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rowCount: 2,
          rows: [
            { id: 'user-1', username: 'alice' },
            { id: 'user-2', username: 'bob' },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 1 }) // audit log for user-1
        .mockResolvedValueOnce({ rowCount: 1 }); // audit log for user-2

      const result = await service.checkSuspensionExpiry();

      expect(result).toBe(2);
    });

    it('should return 0 when no users to restore', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });

      const result = await service.checkSuspensionExpiry();

      expect(result).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('DB error'));

      const result = await service.checkSuspensionExpiry();

      expect(result).toBe(0);
    });
  });

  describe('cleanupExpiredSsoStates', () => {
    it('should delete expired SSO states', async () => {
      mockQuery.mockResolvedValue({ rowCount: 10 });

      const result = await service.cleanupExpiredSsoStates();

      expect(result).toBe(10);
    });

    it('should handle errors gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('DB error'));

      const result = await service.cleanupExpiredSsoStates();

      expect(result).toBe(0);
    });
  });

  describe('cleanupExpiredSpans', () => {
    it('should return 0 when tracing service not set', async () => {
      const result = await service.cleanupExpiredSpans();

      expect(result).toBe(0);
    });

    it('should cleanup spans when tracing service is set', async () => {
      service.setTracingService({ cleanupExpired: mockTracingCleanup } as any);
      mockTracingCleanup.mockResolvedValue(15);

      const result = await service.cleanupExpiredSpans();

      expect(result).toBe(15);
    });

    it('should handle errors gracefully', async () => {
      service.setTracingService({ cleanupExpired: mockTracingCleanup } as any);
      mockTracingCleanup.mockRejectedValue(new Error('Error'));

      const result = await service.cleanupExpiredSpans();

      expect(result).toBe(0);
    });
  });

  describe('cleanupExpiredSlowQueries', () => {
    it('should return 0 when db profiler not set', async () => {
      const result = await service.cleanupExpiredSlowQueries();

      expect(result).toBe(0);
    });

    it('should cleanup slow queries when profiler is set', async () => {
      service.setDbProfiler({ cleanupExpired: mockDbProfilerCleanup } as any);
      mockDbProfilerCleanup.mockResolvedValue(8);

      const result = await service.cleanupExpiredSlowQueries();

      expect(result).toBe(8);
    });
  });

  describe('runManualCleanup', () => {
    it('should run all cleanup tasks', async () => {
      mockCleanupExpired.mockResolvedValue(5);
      mockQuery.mockResolvedValue({ rowCount: 3, rows: [] });

      const result = await service.runManualCleanup();

      expect(result.blacklist).toBe(5);
      expect(result.refreshTokens).toBe(3);
    });

    it('should run only selected tasks', async () => {
      mockCleanupExpired.mockResolvedValue(5);

      const result = await service.runManualCleanup({ blacklist: true });

      expect(result.blacklist).toBe(5);
      expect(result.refreshTokens).toBe(0);
    });
  });

  describe('start/stop', () => {
    it('should start cron job', () => {
      service.start();
      // Should not throw
    });

    it('should stop cron job', () => {
      service.start();
      service.stop();
      // Should not throw
    });

    it('should handle stop when not started', () => {
      service.stop();
      // Should not throw
    });
  });
});

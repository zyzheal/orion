/**
 * Session Module - Barrel Export Tests
 *
 * Verifies that the index.ts correctly exports all public symbols
 * from SessionRepository and SessionService.
 */

describe('Session module barrel exports', () => {
  describe('index exports', () => {
    it('should export SessionRepository class', async () => {
      const mod = await import('../index');
      expect(mod.SessionRepository).toBeDefined();
      expect(typeof mod.SessionRepository).toBe('function');
    });

    it('should export SessionService class', async () => {
      const mod = await import('../index');
      expect(mod.SessionService).toBeDefined();
      expect(typeof mod.SessionService).toBe('function');
    });

    it('should export SessionServiceError class', async () => {
      const mod = await import('../index');
      expect(mod.SessionServiceError).toBeDefined();
      expect(typeof mod.SessionServiceError).toBe('function');
    });

    it('should create SessionRepository instance with pool', async () => {
      const { SessionRepository } = await import('../index');
      const mockPool = { query: jest.fn() };
      const repo = new SessionRepository(mockPool as any);
      expect(repo).toBeDefined();
      expect(repo.create).toBeDefined();
      expect(repo.findByToken).toBeDefined();
      expect(repo.revoke).toBeDefined();
      expect(repo.cleanup).toBeDefined();
      expect(repo.findByUser).toBeDefined();
      expect(repo.refresh).toBeDefined();
    });

    it('should create SessionService instance with repo', async () => {
      const { SessionService } = await import('../index');
      const mockRepo = {
        create: jest.fn(),
        findByToken: jest.fn(),
        revoke: jest.fn(),
        cleanup: jest.fn(),
        findByUser: jest.fn(),
        refresh: jest.fn(),
      };
      const service = new SessionService(mockRepo as any);
      expect(service).toBeDefined();
      expect(service.createSession).toBeDefined();
      expect(service.verifyToken).toBeDefined();
      expect(service.revokeSession).toBeDefined();
      expect(service.cleanup).toBeDefined();
      expect(service.listByUser).toBeDefined();
      expect(service.refreshToken).toBeDefined();
    });

    it('should create SessionServiceError with message', async () => {
      const { SessionServiceError } = await import('../index');
      const error = new SessionServiceError('test error');
      expect(error.message).toBe('test error');
      expect(error.name).toBe('SessionServiceError');
    });
  });
});

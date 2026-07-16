/**
 * SessionService unit tests
 *
 * Tests the business logic layer with a mocked repository.
 */

import { SessionService } from '../SessionService';
import { SessionRepository, Session } from '../SessionRepository';

// Mock SessionRepository
const mockRepository: jest.Mocked<SessionRepository> = {
  create: jest.fn(),
  findByToken: jest.fn(),
  revoke: jest.fn(),
  cleanup: jest.fn(),
  findByUser: jest.fn(),
  refresh: jest.fn(),
} as any;

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SessionService(mockRepository);
  });

  describe('createSession', () => {
    test('should create a session with default expiration', async () => {
      const mockSession: Session = {
        id: 'uuid-1',
        user_id: 'user1',
        tenant_id: 'tenant1',
        token: 'abc123hex',
        expires_at: new Date(),
        created_at: new Date(),
      };
      mockRepository.create.mockResolvedValue(mockSession);

      const result = await service.createSession('user1', 'tenant1');

      expect(mockRepository.create).toHaveBeenCalledWith(
        'user1',
        'tenant1',
        expect.any(String),
        expect.any(Date)
      );
      expect(result.token).toHaveLength(64);
      expect(result.session).toEqual(mockSession);
    });

    test('should create a session with custom expiration', async () => {
      const mockSession: Session = {
        id: 'uuid-2',
        user_id: 'user2',
        tenant_id: 'tenant2',
        token: 'def456hex',
        expires_at: new Date(),
        created_at: new Date(),
      };
      mockRepository.create.mockResolvedValue(mockSession);

      const result = await service.createSession('user2', 'tenant2', 48);

      expect(mockRepository.create).toHaveBeenCalledWith(
        'user2',
        'tenant2',
        expect.any(String),
        expect.any(Date)
      );
      const expiresAt = (mockRepository.create.mock.calls[0] as any[])[3] as Date;
      const now = new Date();
      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(48, 0);
    });
  });

  describe('verifyToken', () => {
    test('should return session for valid token', async () => {
      const mockSession: Session = {
        id: 'uuid-3',
        user_id: 'user3',
        tenant_id: 'tenant3',
        token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
      };
      mockRepository.findByToken.mockResolvedValue(mockSession);

      const result = await service.verifyToken('valid-token');

      expect(mockRepository.findByToken).toHaveBeenCalledWith('valid-token');
      expect(result).toEqual(mockSession);
    });

    test('should return null for invalid token', async () => {
      mockRepository.findByToken.mockResolvedValue(null);

      const result = await service.verifyToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('revokeSession', () => {
    test('should revoke an existing session', async () => {
      mockRepository.revoke.mockResolvedValue(true);

      const result = await service.revokeSession('some-token');

      expect(mockRepository.revoke).toHaveBeenCalledWith('some-token');
      expect(result).toBe(true);
    });

    test('should return false for non-existent session', async () => {
      mockRepository.revoke.mockResolvedValue(false);

      const result = await service.revokeSession('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    test('should return count of cleaned sessions', async () => {
      mockRepository.cleanup.mockResolvedValue(5);

      const result = await service.cleanup();

      expect(mockRepository.cleanup).toHaveBeenCalled();
      expect(result).toBe(5);
    });
  });

  describe('listByUser', () => {
    test('should return sessions for user with tenant filter', async () => {
      const sessions: Session[] = [
        { id: 's1', user_id: 'user1', tenant_id: 't1', token: 'tok1', expires_at: new Date(), created_at: new Date() },
      ];
      mockRepository.findByUser.mockResolvedValue(sessions);

      const result = await service.listByUser('user1', 't1');

      expect(result).toHaveLength(1);
      expect(mockRepository.findByUser).toHaveBeenCalledWith('user1', 't1');
    });

    test('should return sessions for user without tenant filter', async () => {
      mockRepository.findByUser.mockResolvedValue([]);

      const result = await service.listByUser('user1');

      expect(result).toEqual([]);
      expect(mockRepository.findByUser).toHaveBeenCalledWith('user1', undefined);
    });
  });

  describe('refreshToken', () => {
    test('should refresh valid session', async () => {
      const session: Session = {
        id: 's1', user_id: 'user1', tenant_id: 't1', token: 'tok1',
        expires_at: new Date(Date.now() + 3600000), created_at: new Date(),
      };
      const refreshed: Session = { ...session, expires_at: new Date(Date.now() + 86400000) };
      mockRepository.findByToken.mockResolvedValue(session);
      mockRepository.refresh.mockResolvedValue(refreshed);

      const result = await service.refreshToken('tok1');

      expect(result?.expires_at.getTime()).toBeGreaterThan(session.expires_at.getTime());
    });

    test('should throw when session not found', async () => {
      mockRepository.findByToken.mockResolvedValue(null);

      await expect(service.refreshToken('invalid-token')).rejects.toThrow('Session not found or expired');
    });

    test('should refresh with custom hours', async () => {
      const session: Session = {
        id: 's1', user_id: 'user1', tenant_id: 't1', token: 'tok1',
        expires_at: new Date(Date.now() + 3600000), created_at: new Date(),
      };
      mockRepository.findByToken.mockResolvedValue(session);
      mockRepository.refresh.mockResolvedValue(session);

      await service.refreshToken('tok1', 48);

      expect(mockRepository.refresh).toHaveBeenCalledWith('tok1', 48);
    });
  });
});

describe('SessionServiceError', () => {
  test('should have correct name and code', () => {
    const { SessionServiceError } = require('../SessionService');
    const error = new SessionServiceError('test error', 'TEST_CODE');
    expect(error.name).toBe('SessionServiceError');
    expect(error.code).toBe('TEST_CODE');
    expect(error.message).toBe('test error');
    expect(error).toBeInstanceOf(Error);
  });
});

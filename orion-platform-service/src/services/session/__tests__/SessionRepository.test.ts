/**
 * SessionRepository - Comprehensive Tests
 *
 * Tests for session CRUD, token lookup, revocation,
 * cleanup, user active_sessions, and token refresh.
 */

import { SessionRepository, Session } from '../SessionRepository';

// ─── Mock DB ────────────────────────────────────────────────────────────────

function createMockDb() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SessionRepository', () => {
  let repo: SessionRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    repo = new SessionRepository(mockDb as any);
  });

  // ─── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a session and return it', async () => {
      const mockSession: Session = {
        id: 'sess-1',
        user_id: 'user-1',
        tenant_id: 'tenant-1',
        token: 'abc123',
        expires_at: new Date('2026-06-03'),
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockSession] });

      const expiresAt = new Date('2026-06-03');
      const result = await repo.create('user-1', 'tenant-1', 'abc123', expiresAt);

      expect(result).toEqual(mockSession);
      expect(mockDb.query).toHaveBeenCalledWith(
        'INSERT INTO active_sessions (user_id, tenant_id, session_token, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
        ['user-1', 'tenant-1', 'abc123', expiresAt]
      );
    });
  });

  // ─── findByToken ────────────────────────────────────────────────────────

  describe('findByToken', () => {
    it('should return session when token is valid and not expired', async () => {
      const mockSession: Session = {
        id: 'sess-1',
        user_id: 'user-1',
        tenant_id: 'tenant-1',
        token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000),
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [mockSession] });

      const result = await repo.findByToken('valid-token');

      expect(result).toEqual(mockSession);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id, user_id, tenant_id, session_token as token, expires_at, created_at, status, last_activity_at, ip_address, user_agent FROM active_sessions WHERE session_token = $1 AND expires_at > NOW()',
        ['valid-token']
      );
    });

    it('should return null when token not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findByToken('non-existent');

      expect(result).toBeNull();
    });
  });

  // ─── revoke ─────────────────────────────────────────────────────────────

  describe('revoke', () => {
    it('should return true when session deleted', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repo.revoke('token-1');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM active_sessions WHERE session_token = $1',
        ['token-1']
      );
    });

    it('should return false when token not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.revoke('non-existent');

      expect(result).toBe(false);
    });
  });

  // ─── cleanup ────────────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('should return count of deleted expired active_sessions', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 12 });

      const result = await repo.cleanup();

      expect(result).toBe(12);
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM active_sessions WHERE expires_at < NOW()'
      );
    });

    it('should return 0 when no expired active_sessions', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.cleanup();

      expect(result).toBe(0);
    });
  });

  // ─── findByUser ─────────────────────────────────────────────────────────

  describe('findByUser', () => {
    it('should return active_sessions for user with tenant filter', async () => {
      const active_sessions: Session[] = [
        { id: 's1', user_id: 'user-1', tenant_id: 't1', token: 'tok1', expires_at: new Date(), created_at: new Date() },
        { id: 's2', user_id: 'user-1', tenant_id: 't1', token: 'tok2', expires_at: new Date(), created_at: new Date() },
      ];
      mockDb.query.mockResolvedValue({ rows: active_sessions });

      const result = await repo.findByUser('user-1', 't1');

      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id, user_id, tenant_id, session_token as token, expires_at, created_at, status, last_activity_at, ip_address, user_agent FROM active_sessions WHERE user_id = $1 AND tenant_id = $2 AND expires_at > NOW() ORDER BY created_at DESC',
        ['user-1', 't1']
      );
    });

    it('should return active_sessions for user without tenant filter', async () => {
      const active_sessions: Session[] = [
        { id: 's1', user_id: 'user-1', tenant_id: 't1', token: 'tok1', expires_at: new Date(), created_at: new Date() },
      ];
      mockDb.query.mockResolvedValue({ rows: active_sessions });

      const result = await repo.findByUser('user-1');

      expect(result).toHaveLength(1);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT id, user_id, tenant_id, session_token as token, expires_at, created_at, status, last_activity_at, ip_address, user_agent FROM active_sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC',
        ['user-1']
      );
    });

    it('should return empty array when user has no active_sessions', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findByUser('user-no-active_sessions');

      expect(result).toEqual([]);
    });
  });

  // ─── refresh ────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('should refresh session with default 24 hours', async () => {
      const refreshed: Session = {
        id: 'sess-1',
        user_id: 'user-1',
        tenant_id: 't1',
        token: 'token-1',
        expires_at: new Date(Date.now() + 24 * 3600000),
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [refreshed] });

      const result = await repo.refresh('token-1');

      expect(result).toEqual(refreshed);
      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE active_sessions SET expires_at = $2, last_activity_at = NOW() WHERE session_token = $1 AND expires_at > NOW() RETURNING id, user_id, tenant_id, session_token as token, expires_at, created_at, status, last_activity_at, ip_address, user_agent',
        ['token-1', expect.any(Date)]
      );
    });

    it('should refresh session with custom hours', async () => {
      const refreshed: Session = {
        id: 'sess-1',
        user_id: 'user-1',
        tenant_id: 't1',
        token: 'token-1',
        expires_at: new Date(Date.now() + 48 * 3600000),
        created_at: new Date(),
      };
      mockDb.query.mockResolvedValue({ rows: [refreshed] });

      const result = await repo.refresh('token-1', 48);

      expect(result).toEqual(refreshed);
    });

    it('should return null when token not found or expired', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.refresh('expired-token');

      expect(result).toBeNull();
    });
  });
});

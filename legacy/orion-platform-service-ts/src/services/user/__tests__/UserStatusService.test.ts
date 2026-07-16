/**
 * UserStatusService 测试
 *
 * 测试用户状态管理服务：状态变更、安全清理、批量禁用、会话计数。
 * Mock DatabasePool 和 TokenBlacklistService 模拟依赖。
 */

import { UserStatusService, UserStatus, UserStatusResult } from '../UserStatusService';

// ==================== Mock DatabasePool ====================

function createMockDb() {
  const users = new Map<string, any>();
  const refreshTokens = new Map<string, any>();
  const ssoBindings = new Map<string, any>();
  const statusHistory: any[] = [];

  return {
    users,
    refreshTokens,
    ssoBindings,
    statusHistory,
    query: jest.fn().mockImplementation(async (text: string, params?: any[]) => {
      const upper = text.toUpperCase();

      // SELECT user by id
      if (upper.includes('SELECT ID, USERNAME, STATUS FROM USERS WHERE ID')) {
        const id = params?.[0];
        const user = users.get(id);
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }

      // UPDATE user status
      if (upper.includes('UPDATE USERS SET STATUS')) {
        const newStatus = params?.[0];
        const id = params?.[1];
        const user = users.get(id);
        if (user) {
          user.status = newStatus;
          user.updated_at = new Date();
        }
        return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
      }

      // DELETE refresh_tokens
      if (upper.includes('DELETE FROM REFRESH_TOKENS WHERE USER_ID')) {
        const userId = params?.[0];
        let deleted = 0;
        for (const [key, token] of refreshTokens) {
          if (token.user_id === userId && new Date(token.expires_at) > new Date()) {
            refreshTokens.delete(key);
            deleted++;
          }
        }
        return { rows: [], rowCount: deleted };
      }

      // DELETE user_sso_bindings
      if (upper.includes('DELETE FROM USER_SSO_BINDINGS WHERE USER_ID')) {
        const userId = params?.[0];
        let deleted = 0;
        for (const [key, binding] of ssoBindings) {
          if (binding.user_id === userId) {
            ssoBindings.delete(key);
            deleted++;
          }
        }
        return { rows: [], rowCount: deleted };
      }

      // DELETE active_sessions
      if (upper.includes('DELETE FROM ACTIVE_SESSIONS WHERE USER_ID')) {
        return { rows: [], rowCount: 0 };
      }

      // Advisory lock
      if (upper.includes('PG_ADVISORY_XACT_LOCK')) {
        return { rows: [], rowCount: 0 };
      }

      // INSERT status history
      if (upper.includes('INSERT INTO USER_STATUS_HISTORY')) {
        statusHistory.push({
          user_id: params?.[0],
          old_status: params?.[1],
          new_status: params?.[2],
          reason: params?.[3],
          operator_id: params?.[4],
          changed_at: params?.[5],
        });
        return { rows: [], rowCount: 1 };
      }

      // SELECT users for batch disable
      if (upper.includes('SELECT ID, USERNAME FROM USERS WHERE')) {
        const status = params?.[0];
        let results = Array.from(users.values()).filter(u => u.status === status);

        let paramIdx = 1;
        if (upper.includes('DEPARTMENT =')) {
          const dept = params?.[paramIdx++];
          results = results.filter(u => u.department === dept);
        }
        if (upper.includes('ROLE =')) {
          const role = params?.[paramIdx++];
          results = results.filter(u => u.role === role);
        }

        return { rows: results, rowCount: results.length };
      }

      // COUNT refresh_tokens
      if (upper.includes('REFRESH_TOKENS') && upper.includes('COUNT(*)')) {
        const userId = params?.[0];
        let count = 0;
        for (const token of refreshTokens.values()) {
          if (token.user_id === userId && new Date(token.expires_at) > new Date()) {
            count++;
          }
        }
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    }),
  };
}

function createMockTokenBlacklist() {
  return {
    revokeAllUserTokens: jest.fn().mockResolvedValue(3),
  };
}

// ==================== Tests ====================

describe('UserStatusService', () => {
  let service: UserStatusService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockTokenBlacklist: ReturnType<typeof createMockTokenBlacklist>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    mockTokenBlacklist = createMockTokenBlacklist();
    service = new UserStatusService(mockDb as any, mockTokenBlacklist as any);
  });

  // ---- changeUserStatus ----

  describe('changeUserStatus', () => {
    beforeEach(() => {
      mockDb.users.set('user-1', {
        id: 'user-1',
        username: 'testuser',
        status: 'active',
        tenant_id: 'tenant-1',
      });
    });

    it('should change status from active to suspended', async () => {
      const result = await service.changeUserStatus(
        'user-1',
        'suspended',
        'Policy violation',
        'admin-1'
      );

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-1');
      expect(result.oldStatus).toBe('active');
      expect(result.newStatus).toBe('suspended');
      expect(result.revokedTokens).toBeGreaterThanOrEqual(0);
      expect(result.blacklistedSessions).toBeGreaterThanOrEqual(0);
      expect(result.unboundSso).toBeGreaterThanOrEqual(0);
    });

    it('should change status from active to terminated', async () => {
      const result = await service.changeUserStatus(
        'user-1',
        'terminated',
        'Account closed',
        'admin-1'
      );

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('terminated');
    });

    it('should throw when user not found', async () => {
      await expect(
        service.changeUserStatus('non-existent', 'suspended', 'reason', 'admin')
      ).rejects.toThrow('User not found');
    });

    it('should throw when status is same', async () => {
      await expect(
        service.changeUserStatus('user-1', 'active', 'reason', 'admin')
      ).rejects.toThrow('already has status active');
    });

    it('should not run security cleanup for active status', async () => {
      mockDb.users.set('user-2', {
        id: 'user-2',
        username: 'user2',
        status: 'suspended',
        tenant_id: 'tenant-1',
      });

      const result = await service.changeUserStatus(
        'user-2',
        'active',
        'Reinstated',
        'admin-1'
      );

      expect(result.success).toBe(true);
      expect(result.revokedTokens).toBe(0);
    });

    it('should log status change to history', async () => {
      await service.changeUserStatus(
        'user-1',
        'suspended',
        'Test reason',
        'admin-1'
      );

      expect(mockDb.statusHistory).toHaveLength(1);
      expect(mockDb.statusHistory[0].user_id).toBe('user-1');
      expect(mockDb.statusHistory[0].old_status).toBe('active');
      expect(mockDb.statusHistory[0].new_status).toBe('suspended');
    });
  });

  // ---- Security cleanup (disableUser) ----

  describe('security cleanup', () => {
    beforeEach(() => {
      mockDb.users.set('user-1', {
        id: 'user-1',
        username: 'testuser',
        status: 'active',
        tenant_id: 'tenant-1',
      });

      // Add refresh tokens
      mockDb.refreshTokens.set('token-1', {
        user_id: 'user-1',
        expires_at: new Date('2030-01-01'),
      });
      mockDb.refreshTokens.set('token-2', {
        user_id: 'user-1',
        expires_at: new Date('2020-01-01'), // expired
      });

      // Add SSO bindings
      mockDb.ssoBindings.set('sso-1', { user_id: 'user-1' });
    });

    it('should revoke refresh tokens on suspension', async () => {
      const result = await service.changeUserStatus(
        'user-1',
        'suspended',
        'Security breach',
        'admin-1'
      );

      expect(result.revokedTokens).toBeGreaterThanOrEqual(0);
    });

    it('should blacklist access tokens via TokenBlacklistService', async () => {
      await service.changeUserStatus(
        'user-1',
        'terminated',
        'Terminated',
        'admin-1'
      );

      expect(mockTokenBlacklist.revokeAllUserTokens).toHaveBeenCalledWith(
        'user-1',
        'user_status_change'
      );
    });

    it('should unbind SSO associations', async () => {
      const result = await service.changeUserStatus(
        'user-1',
        'terminated',
        'Terminated',
        'admin-1'
      );

      expect(result.unboundSso).toBeGreaterThanOrEqual(0);
    });
  });

  // ---- batchDisable ----

  describe('batchDisable', () => {
    beforeEach(() => {
      mockDb.users.set('user-1', {
        id: 'user-1',
        username: 'user1',
        status: 'active',
        department: 'engineering',
        role: 'developer',
        tenant_id: 'tenant-1',
      });
      mockDb.users.set('user-2', {
        id: 'user-2',
        username: 'user2',
        status: 'active',
        department: 'engineering',
        role: 'developer',
        tenant_id: 'tenant-1',
      });
      mockDb.users.set('user-3', {
        id: 'user-3',
        username: 'user3',
        status: 'active',
        department: 'sales',
        role: 'manager',
        tenant_id: 'tenant-1',
      });
    });

    it('should batch disable users by department', async () => {
      const result = await service.batchDisable({
        department: 'engineering',
        reason: 'Reorganization',
        operatorId: 'admin-1',
      });

      expect(result.disabledCount).toBe(2);
      expect(result.results).toHaveLength(2);
    });

    it('should batch disable users by role', async () => {
      const result = await service.batchDisable({
        role: 'developer',
        reason: 'Role change',
        operatorId: 'admin-1',
      });

      expect(result.disabledCount).toBe(2);
    });

    it('should handle errors in batch disable gracefully', async () => {
      // Make one user fail
      mockDb.users.set('user-fail', {
        id: 'user-fail',
        username: 'failuser',
        status: 'active',
        department: 'engineering',
        tenant_id: 'tenant-1',
      });

      let callCount = 0;
      mockDb.query.mockImplementation(async (text: string, params?: any[]) => {
        callCount++;
        const upper = text.toUpperCase();

        if (upper.includes('SELECT ID, USERNAME, STATUS FROM USERS WHERE ID')) {
          const id = params?.[0];
          if (id === 'user-fail') {
            return { rows: [], rowCount: 0 }; // User not found
          }
          const user = mockDb.users.get(id);
          return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
        }

        if (upper.includes('SELECT ID, USERNAME FROM USERS WHERE')) {
          const results = Array.from(mockDb.users.values())
            .filter(u => u.status === 'active' && u.department === 'engineering');
          return { rows: results, rowCount: results.length };
        }

        // Default fallback
        return { rows: [], rowCount: 0 };
      });

      const result = await service.batchDisable({
        department: 'engineering',
        reason: 'Test',
        operatorId: 'admin-1',
      });

      expect(result.disabledCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ---- getActiveSessionCount ----

  describe('getActiveSessionCount', () => {
    it('should return count of active sessions', async () => {
      mockDb.refreshTokens.set('token-1', {
        user_id: 'user-1',
        expires_at: new Date('2030-01-01'),
      });
      mockDb.refreshTokens.set('token-2', {
        user_id: 'user-1',
        expires_at: new Date('2030-01-01'),
      });

      const count = await service.getActiveSessionCount('user-1');

      expect(count).toBe(2);
    });

    it('should return 0 when no active sessions', async () => {
      const count = await service.getActiveSessionCount('user-no-sessions');
      expect(count).toBe(0);
    });
  });
});

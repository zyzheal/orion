/**
 * UserActivityService 测试
 *
 * 测试用户操作日志服务：记录、查询、高级查询、计数、最近操作。
 * Mock DatabasePool 模拟数据库交互。
 */

import { UserActivityService, UserActivity, CreateActivityInput } from '../UserActivityService';

// ==================== Mock crypto ====================

let uuidCounter = 0;
const mockRandomUUID = jest.fn().mockImplementation(() => `test-uuid-${++uuidCounter}`);
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: mockRandomUUID },
  writable: true,
});

// ==================== Mock DatabasePool ====================

function createMockDb() {
  const store = new Map<string, UserActivity>();

  return {
    store,
    query: jest.fn().mockImplementation(async (text: string, params?: any[]) => {
      const upper = text.toUpperCase();

      // INSERT
      if (upper.includes('INSERT INTO USER_ACTIVITIES')) {
        const row: any = {
          id: params?.[0],
          userId: params?.[1],
          action: params?.[2],
          resourceType: params?.[3],
          resourceId: params?.[4],
          details: params?.[5] ? JSON.parse(params[5]) : undefined,
          ipAddress: params?.[6],
          userAgent: params?.[7],
          createdAt: params?.[8],
        };
        store.set(row.id, row);
        return { rows: [row], rowCount: 1 };
      }

      // SELECT COUNT
      if (upper.includes('SELECT COUNT(*)')) {
        const userId = params?.[0];
        let count = 0;
        for (const activity of store.values()) {
          if (activity.userId === userId) count++;
        }
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }

      // SELECT with complex WHERE (getActivitiesByOptions)
      if (upper.includes('WHERE USER_ID = $1') && upper.includes('LIMIT')) {
        const userId = params?.[0];
        let results = Array.from(store.values()).filter(a => a.userId === userId);

        // Parse conditions from query
        let paramIdx = 1;
        if (upper.includes('RESOURCE_TYPE =')) {
          paramIdx++;
          const resourceType = params?.[paramIdx - 1];
          results = results.filter(a => a.resourceType === resourceType);
        }
        if (upper.includes('ACTION =')) {
          paramIdx++;
          const action = params?.[paramIdx - 1];
          results = results.filter(a => a.action === action);
        }
        if (upper.includes('CREATED_AT >=')) {
          paramIdx++;
          const startDate = params?.[paramIdx - 1];
          results = results.filter(a => new Date(a.createdAt) >= new Date(startDate));
        }
        if (upper.includes('CREATED_AT <=')) {
          paramIdx++;
          const endDate = params?.[paramIdx - 1];
          results = results.filter(a => new Date(a.createdAt) <= new Date(endDate));
        }

        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const limit = params?.[paramIdx] || 20;
        const offset = params?.[paramIdx + 1] || 0;
        results = results.slice(offset, offset + limit);

        return { rows: results, rowCount: results.length };
      }

      // SELECT with LIMIT OFFSET (getActivities)
      if (upper.includes('WHERE USER_ID = $1') && upper.includes('LIMIT $2')) {
        const userId = params?.[0];
        const limit = params?.[1] || 20;
        const offset = params?.[2] || 0;

        let results = Array.from(store.values())
          .filter(a => a.userId === userId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        results = results.slice(offset, offset + limit);
        return { rows: results, rowCount: results.length };
      }

      // SELECT LIMIT 1 (getLastActivity)
      if (upper.includes('LIMIT 1')) {
        const userId = params?.[0];
        const results = Array.from(store.values())
          .filter(a => a.userId === userId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return { rows: results.slice(0, 1), rowCount: Math.min(results.length, 1) };
      }

      return { rows: [], rowCount: 0 };
    }),
  };
}

// ==================== Tests ====================

describe('UserActivityService', () => {
  let service: UserActivityService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    uuidCounter = 0;
    mockDb = createMockDb();
    service = new UserActivityService(mockDb as any);
  });

  // ---- logActivity ----

  describe('logActivity', () => {
    it('should log activity with all fields', async () => {
      const input: CreateActivityInput = {
        userId: 'user-1',
        action: 'deploy',
        resourceType: 'pipeline',
        resourceId: 'pipeline-123',
        details: { env: 'production' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const result = await service.logActivity(input);

      expect(result.id).toBe('test-uuid-1');
      expect(result.userId).toBe('user-1');
      expect(result.action).toBe('deploy');
      expect(result.resourceType).toBe('pipeline');
      expect(result.resourceId).toBe('pipeline-123');
      expect(result.details).toEqual({ env: 'production' });
      expect(result.ipAddress).toBe('192.168.1.1');
      expect(result.userAgent).toBe('Mozilla/5.0');
      expect(result.createdAt).toBeDefined();
    });

    it('should log activity with minimal fields', async () => {
      const input: CreateActivityInput = {
        userId: 'user-1',
        action: 'login',
      };

      const result = await service.logActivity(input);

      expect(result.userId).toBe('user-1');
      expect(result.action).toBe('login');
      expect(result.resourceType).toBeNull();
      expect(result.resourceId).toBeNull();
    });

    it('should handle details as JSON string', async () => {
      const input: CreateActivityInput = {
        userId: 'user-1',
        action: 'update',
        details: { key: 'value' },
      };

      const result = await service.logActivity(input);
      expect(result.details).toEqual({ key: 'value' });
    });
  });

  // ---- getActivities ----

  describe('getActivities', () => {
    it('should return activities for user', async () => {
      await service.logActivity({ userId: 'user-1', action: 'login' });
      await service.logActivity({ userId: 'user-1', action: 'deploy' });
      await service.logActivity({ userId: 'user-2', action: 'login' });

      const results = await service.getActivities('user-1');

      expect(results).toHaveLength(2);
      expect(results.every(a => a.userId === 'user-1')).toBe(true);
    });

    it('should respect limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await service.logActivity({ userId: 'user-1', action: `action-${i}` });
      }

      const page1 = await service.getActivities('user-1', 2, 0);
      const page2 = await service.getActivities('user-1', 2, 2);

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
    });

    it('should return empty array for non-existent user', async () => {
      const results = await service.getActivities('non-existent');
      expect(results).toHaveLength(0);
    });

    it('should use default limit and offset', async () => {
      await service.logActivity({ userId: 'user-1', action: 'test' });

      const results = await service.getActivities('user-1');
      expect(results).toHaveLength(1);
    });
  });

  // ---- getActivitiesByOptions ----

  describe('getActivitiesByOptions', () => {
    it('should filter by resourceType', async () => {
      await service.logActivity({ userId: 'user-1', action: 'deploy', resourceType: 'pipeline' });
      await service.logActivity({ userId: 'user-1', action: 'deploy', resourceType: 'service' });

      const results = await service.getActivitiesByOptions('user-1', { resourceType: 'pipeline' });

      expect(results).toHaveLength(1);
      expect(results[0].resourceType).toBe('pipeline');
    });

    it('should filter by action', async () => {
      await service.logActivity({ userId: 'user-1', action: 'deploy' });
      await service.logActivity({ userId: 'user-1', action: 'rollback' });

      const results = await service.getActivitiesByOptions('user-1', { action: 'deploy' });

      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('deploy');
    });

    it('should filter by date range', async () => {
      await service.logActivity({ userId: 'user-1', action: 'test' });

      const results = await service.getActivitiesByOptions('user-1', {
        startDate: new Date('2020-01-01'),
        endDate: new Date('2030-12-31'),
      });

      expect(results).toHaveLength(1);
    });

    it('should combine multiple filters', async () => {
      await service.logActivity({ userId: 'user-1', action: 'deploy', resourceType: 'pipeline' });
      await service.logActivity({ userId: 'user-1', action: 'rollback', resourceType: 'pipeline' });
      await service.logActivity({ userId: 'user-1', action: 'deploy', resourceType: 'service' });

      const results = await service.getActivitiesByOptions('user-1', {
        resourceType: 'pipeline',
        action: 'deploy',
      });

      expect(results).toHaveLength(1);
    });

    it('should respect limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await service.logActivity({ userId: 'user-1', action: 'test' });
      }

      const results = await service.getActivitiesByOptions('user-1', { limit: 2, offset: 0 });
      expect(results).toHaveLength(2);
    });
  });

  // ---- getActivityCount ----

  describe('getActivityCount', () => {
    it('should return count of user activities', async () => {
      await service.logActivity({ userId: 'user-1', action: 'login' });
      await service.logActivity({ userId: 'user-1', action: 'deploy' });
      await service.logActivity({ userId: 'user-2', action: 'login' });

      const count = await service.getActivityCount('user-1');

      expect(count).toBe(2);
    });

    it('should return 0 for non-existent user', async () => {
      const count = await service.getActivityCount('non-existent');
      expect(count).toBe(0);
    });
  });

  // ---- getLastActivity ----

  describe('getLastActivity', () => {
    it('should return last activity for user', async () => {
      await service.logActivity({ userId: 'user-1', action: 'login' });
      await service.logActivity({ userId: 'user-1', action: 'deploy' });

      const last = await service.getLastActivity('user-1');

      expect(last).toBeDefined();
      expect(last!.userId).toBe('user-1');
    });

    it('should return null for non-existent user', async () => {
      const last = await service.getLastActivity('non-existent');
      expect(last).toBeNull();
    });

    it('should return null when user has no activities', async () => {
      const last = await service.getLastActivity('empty-user');
      expect(last).toBeNull();
    });
  });
});

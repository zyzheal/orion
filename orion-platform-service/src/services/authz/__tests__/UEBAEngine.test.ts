/**
 * UEBAEngine Tests - User and Entity Behavior Analytics
 *
 * Covers: analyzeUserBehavior, getHighRiskUsers, detectAnomalies,
 * risk level calculation, off-hours detection, tenant isolation.
 */

import { UEBAService, UEBAStats, AnomalyAlert } from '../UEBAEngine';

// Mock PermissionAuditRepository
function createMockAuditRepo() {
  return {
    queryByUser: jest.fn().mockResolvedValue([]),
    countDeniedByUser: jest.fn().mockResolvedValue([]),
    logDecision: jest.fn(),
    logDecisions: jest.fn(),
    queryDenied: jest.fn(),
    queryByResource: jest.fn(),
  };
}

// Helper to create a deny log entry
function makeDenyEntry(userId: string, hoursAgo: number, resourceType = 'pipeline') {
  const time = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  return {
    user_id: userId,
    resource_type: resourceType,
    action: 'read',
    decision: 'deny',
    evaluated_at: time.toISOString(),
  };
}

describe('UEBAService', () => {
  let mockAuditRepo: ReturnType<typeof createMockAuditRepo>;
  let service: UEBAService;

  beforeEach(() => {
    mockAuditRepo = createMockAuditRepo();
    service = new UEBAService(mockAuditRepo as any);
  });

  // ==================== analyzeUserBehavior ====================

  describe('analyzeUserBehavior', () => {
    it('should return null when no recent denies exist', async () => {
      mockAuditRepo.queryByUser.mockResolvedValue([]);

      const result = await service.analyzeUserBehavior('user-1');

      expect(result).toBeNull();
    });

    it('should return stats with low risk for few denies', async () => {
      const denies = [
        makeDenyEntry('user-1', 1),
        makeDenyEntry('user-1', 2),
        makeDenyEntry('user-1', 3),
      ];
      mockAuditRepo.queryByUser.mockResolvedValue(denies);

      const result = await service.analyzeUserBehavior('user-1');

      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-1');
      expect(result!.denyCount).toBe(3);
      expect(result!.riskLevel).toBe('low');
    });

    it('should return medium risk for 5-9 denies', async () => {
      const denies = Array.from({ length: 6 }, (_, i) => makeDenyEntry('user-1', i + 1));
      mockAuditRepo.queryByUser.mockResolvedValue(denies);

      const result = await service.analyzeUserBehavior('user-1');

      expect(result!.riskLevel).toBe('medium');
    });

    it('should return high risk for 10-19 denies', async () => {
      const denies = Array.from({ length: 12 }, (_, i) => makeDenyEntry('user-1', i + 1));
      mockAuditRepo.queryByUser.mockResolvedValue(denies);

      const result = await service.analyzeUserBehavior('user-1');

      expect(result!.riskLevel).toBe('high');
    });

    it('should return critical risk for 20+ denies', async () => {
      const denies = Array.from({ length: 25 }, (_, i) => makeDenyEntry('user-1', i + 1));
      mockAuditRepo.queryByUser.mockResolvedValue(denies);

      const result = await service.analyzeUserBehavior('user-1');

      expect(result!.riskLevel).toBe('critical');
    });

    it('should return high risk when unique resources >= 5', async () => {
      const denies = Array.from({ length: 5 }, (_, i) =>
        makeDenyEntry('user-1', i + 1, `resource-type-${i}`),
      );
      mockAuditRepo.queryByUser.mockResolvedValue(denies);

      const result = await service.analyzeUserBehavior('user-1');

      expect(result!.riskLevel).toBe('high');
    });

    it('should return critical risk when unique resources >= 10', async () => {
      const denies = Array.from({ length: 10 }, (_, i) =>
        makeDenyEntry('user-1', i + 1, `resource-type-${i}`),
      );
      mockAuditRepo.queryByUser.mockResolvedValue(denies);

      const result = await service.analyzeUserBehavior('user-1');

      expect(result!.riskLevel).toBe('critical');
    });

    it('should calculate denyRate correctly', async () => {
      const denies = [
        makeDenyEntry('user-1', 1),
        makeDenyEntry('user-1', 2),
      ];
      mockAuditRepo.queryByUser.mockResolvedValue(denies);

      const result = await service.analyzeUserBehavior('user-1', 24);

      expect(result!.denyRate).toBeCloseTo(2 / 24);
    });

    it('should filter denies by time window', async () => {
      // 3 recent denies (within 24h) + 1 old deny (48h ago)
      const denies = [
        makeDenyEntry('user-1', 1),
        makeDenyEntry('user-1', 12),
        makeDenyEntry('user-1', 23),
        makeDenyEntry('user-1', 48), // older than 24h
      ];
      mockAuditRepo.queryByUser.mockResolvedValue(denies);

      const result = await service.analyzeUserBehavior('user-1', 24);

      expect(result!.denyCount).toBe(3);
    });

    it('should use custom hours parameter', async () => {
      const denies = [
        makeDenyEntry('user-1', 1),
        makeDenyEntry('user-1', 3),
      ];
      mockAuditRepo.queryByUser.mockResolvedValue(denies);

      const result = await service.analyzeUserBehavior('user-1', 2);

      // Only deny within 2 hours should count (deny at 1h ago)
      expect(result!.denyCount).toBe(1);
    });

    it('should pass tenantId to repository', async () => {
      mockAuditRepo.queryByUser.mockResolvedValue([]);

      await service.analyzeUserBehavior('user-1', 24, 'tenant-abc');

      expect(mockAuditRepo.queryByUser).toHaveBeenCalledWith('user-1', 1000, 'tenant-abc');
    });

    it('should include lastDenyAt from most recent deny', async () => {
      const recentTime = new Date(Date.now() - 1 * 60 * 60 * 1000);
      const denies = [
        { ...makeDenyEntry('user-1', 1), evaluated_at: recentTime.toISOString() },
        makeDenyEntry('user-1', 5),
      ];
      mockAuditRepo.queryByUser.mockResolvedValue(denies);

      const result = await service.analyzeUserBehavior('user-1');

      expect(result!.lastDenyAt).toBeDefined();
    });
  });

  // ==================== getHighRiskUsers ====================

  describe('getHighRiskUsers', () => {
    it('should return empty array when no denied users', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([]);

      const result = await service.getHighRiskUsers();

      expect(result).toEqual([]);
    });

    it('should return users with medium or higher risk level', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([
        { user_id: 'user-1', count: '15' },
        { user_id: 'user-2', count: '3' },
      ]);

      // user-1 has 15 denies (high risk), user-2 has 3 (low risk)
      mockAuditRepo.queryByUser.mockImplementation(async (userId: string) => {
        if (userId === 'user-1') {
          return Array.from({ length: 15 }, (_, i) => makeDenyEntry('user-1', i + 1));
        }
        return Array.from({ length: 3 }, (_, i) => makeDenyEntry('user-2', i + 1));
      });

      const result = await service.getHighRiskUsers();

      // user-1 is high risk, user-2 is low risk (excluded)
      expect(result.length).toBe(1);
      expect(result[0].userId).toBe('user-1');
      expect(result[0].riskLevel).toBe('high');
    });

    it('should sort results by risk level descending', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([
        { user_id: 'user-medium', count: '6' },
        { user_id: 'user-critical', count: '25' },
      ]);

      mockAuditRepo.queryByUser.mockImplementation(async (userId: string) => {
        if (userId === 'user-medium') {
          return Array.from({ length: 6 }, (_, i) => makeDenyEntry('user-medium', i + 1));
        }
        return Array.from({ length: 25 }, (_, i) => makeDenyEntry('user-critical', i + 1));
      });

      const result = await service.getHighRiskUsers();

      expect(result[0].riskLevel).toBe('critical');
      expect(result[1].riskLevel).toBe('medium');
    });

    it('should respect limit parameter', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({ user_id: `user-${i}`, count: '15' })),
      );

      mockAuditRepo.queryByUser.mockImplementation(async () =>
        Array.from({ length: 15 }, (_, i) => makeDenyEntry('any', i + 1)),
      );

      const result = await service.getHighRiskUsers(24, 5);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should pass tenantId to repository', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([]);

      await service.getHighRiskUsers(24, 10, 'tenant-xyz');

      expect(mockAuditRepo.countDeniedByUser).toHaveBeenCalledWith(24, 'tenant-xyz');
    });
  });

  // ==================== detectAnomalies ====================

  describe('detectAnomalies', () => {
    it('should return empty alerts when no denied users', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([]);

      const result = await service.detectAnomalies();

      expect(result).toEqual([]);
    });

    it('should generate frequent_denial alert for 10+ denies', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([
        { user_id: 'user-1', count: '15' },
      ]);

      mockAuditRepo.queryByUser.mockImplementation(async (userId: string) => {
        if (userId === 'user-1') {
          return Array.from({ length: 15 }, (_, i) => makeDenyEntry('user-1', i + 1));
        }
        return [];
      });

      const result = await service.detectAnomalies();

      const denialAlert = result.find((a) => a.alertType === 'frequent_denial');
      expect(denialAlert).toBeDefined();
      expect(denialAlert!.userId).toBe('user-1');
      expect(denialAlert!.message).toContain('15');
    });

    it('should NOT generate frequent_denial alert for < 10 denies', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([
        { user_id: 'user-1', count: '5' },
      ]);

      mockAuditRepo.queryByUser.mockImplementation(async () =>
        Array.from({ length: 5 }, (_, i) => makeDenyEntry('user-1', i + 1)),
      );

      const result = await service.detectAnomalies();

      const denialAlert = result.find((a) => a.alertType === 'frequent_denial');
      expect(denialAlert).toBeUndefined();
    });

    it('should generate off_hours_access alert for 3+ off-hours denies', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([
        { user_id: 'user-1', count: '5' },
      ]);

      // Create denies at off-hours (before 9 or after 18 UTC)
      const offHoursDenies = [
        { ...makeDenyEntry('user-1', 1), evaluated_at: '2026-05-18T03:00:00Z' },
        { ...makeDenyEntry('user-1', 2), evaluated_at: '2026-05-18T20:00:00Z' },
        { ...makeDenyEntry('user-1', 3), evaluated_at: '2026-05-18T01:00:00Z' },
        makeDenyEntry('user-1', 4),
        makeDenyEntry('user-1', 5),
      ];

      mockAuditRepo.queryByUser.mockResolvedValue(offHoursDenies);

      const result = await service.detectAnomalies();

      const offHoursAlert = result.find((a) => a.alertType === 'off_hours_access');
      expect(offHoursAlert).toBeDefined();
      expect(offHoursAlert!.severity).toBe('medium');
    });

    it('should NOT generate off_hours_access alert for < 3 off-hours denies', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([
        { user_id: 'user-1', count: '5' },
      ]);

      const denies = [
        { ...makeDenyEntry('user-1', 1), evaluated_at: '2026-05-18T03:00:00Z' },
        { ...makeDenyEntry('user-1', 2), evaluated_at: '2026-05-18T01:00:00Z' },
        { ...makeDenyEntry('user-1', 3), evaluated_at: '2026-05-18T10:00:00Z' }, // working hours
        { ...makeDenyEntry('user-1', 4), evaluated_at: '2026-05-18T14:00:00Z' }, // working hours
        { ...makeDenyEntry('user-1', 5), evaluated_at: '2026-05-18T16:00:00Z' }, // working hours
      ];

      mockAuditRepo.queryByUser.mockResolvedValue(denies);

      const result = await service.detectAnomalies();

      const offHoursAlert = result.find((a) => a.alertType === 'off_hours_access');
      expect(offHoursAlert).toBeUndefined();
    });

    it('should generate multiple alerts for same user', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([
        { user_id: 'user-1', count: '15' },
      ]);

      // 15 denies, many at off-hours
      const denies = Array.from({ length: 15 }, (_, i) => ({
        ...makeDenyEntry('user-1', i + 1),
        evaluated_at: new Date(Date.now() - (i + 1) * 60 * 60 * 1000).toISOString(),
      }));
      // Set some to off-hours
      denies[0].evaluated_at = '2026-05-18T02:00:00Z';
      denies[1].evaluated_at = '2026-05-18T03:00:00Z';
      denies[2].evaluated_at = '2026-05-18T20:00:00Z';

      mockAuditRepo.queryByUser.mockResolvedValue(denies);

      const result = await service.detectAnomalies();

      // Should have both frequent_denial and off_hours_access alerts
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.some((a) => a.alertType === 'frequent_denial')).toBe(true);
      expect(result.some((a) => a.alertType === 'off_hours_access')).toBe(true);
    });

    it('should include timestamp in alerts', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([
        { user_id: 'user-1', count: '12' },
      ]);

      mockAuditRepo.queryByUser.mockImplementation(async () =>
        Array.from({ length: 12 }, (_, i) => makeDenyEntry('user-1', i + 1)),
      );

      const result = await service.detectAnomalies();

      result.forEach((alert) => {
        expect(alert.timestamp).toBeDefined();
        expect(new Date(alert.timestamp).getTime()).not.toBeNaN();
      });
    });

    it('should pass tenantId to both repository calls', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([
        { user_id: 'user-1', count: '5' },
      ]);

      mockAuditRepo.queryByUser.mockResolvedValue([]);

      await service.detectAnomalies(24, 'tenant-abc');

      expect(mockAuditRepo.countDeniedByUser).toHaveBeenCalledWith(24, 'tenant-abc');
      expect(mockAuditRepo.queryByUser).toHaveBeenCalledWith('user-1', 1000, 'tenant-abc');
    });

    it('should handle user with no recent denies gracefully', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([
        { user_id: 'user-1', count: '100' }, // old data
      ]);

      // All denies are older than the time window
      mockAuditRepo.queryByUser.mockResolvedValue([]);

      const result = await service.detectAnomalies();

      // analyzeUserBehavior returns null, so no alerts generated
      expect(result).toEqual([]);
    });
  });

  // ==================== Edge Cases ====================

  describe('edge cases', () => {
    it('should handle analyzeUserBehavior with 0 hours window', async () => {
      const denies = [makeDenyEntry('user-1', 0)]; // right now
      mockAuditRepo.queryByUser.mockResolvedValue(denies);

      const result = await service.analyzeUserBehavior('user-1', 0);

      // 0 hours window should filter out everything (hoursAgo <= 0 is false for positive values)
      // Actually, deny at 0 hours ago should be within 0 hours
      expect(result).not.toBeNull();
    });

    it('should handle empty user ID', async () => {
      mockAuditRepo.queryByUser.mockResolvedValue([]);

      const result = await service.analyzeUserBehavior('');

      expect(result).toBeNull();
      expect(mockAuditRepo.queryByUser).toHaveBeenCalledWith('', 1000, undefined);
    });

    it('should handle getHighRiskUsers with 0 limit', async () => {
      mockAuditRepo.countDeniedByUser.mockResolvedValue([
        { user_id: 'user-1', count: '15' },
      ]);

      const result = await service.getHighRiskUsers(24, 0);

      expect(result).toEqual([]);
    });
  });
});

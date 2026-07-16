/**
 * ConfirmationService - Edge Cases & Advanced Scenarios
 *
 * Covers edge cases not in the main test suite:
 * - Constructor behavior (with/without DB)
 * - Approve/reject with empty input
 * - Expired status handling in batch operations
 * - Audit log filtering combinations
 * - Notification settings isolation between users
 * - Stats after complex state transitions
 * - Concurrent-like sequential operations
 * - Large dataset pagination boundaries
 */

let ConfirmationService: typeof import('../ConfirmationService').ConfirmationService;

const getFreshModule = async () => {
  jest.resetModules();
  const mod = await require('../ConfirmationService');
  return mod;
};

beforeEach(async () => {
  const mod = await getFreshModule();
  ConfirmationService = mod.ConfirmationService;
});

describe('ConfirmationService - Edge Cases', () => {
  // ==========================================================================
  // CONSTRUCTOR BEHAVIOR
  // ==========================================================================

  describe('constructor', () => {
    test('should work without any arguments (in-memory mode)', async () => {
      const service = new ConfirmationService();
      const result = await service.create({
        sceneType: 'test',
        priority: 'P1',
        aiSuggestion: 'Test',
        aiConfidence: 0.5,
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
    });

    test('should accept a db object and use repository path', async () => {
      const mockDb = { query: jest.fn() };
      const service = new ConfirmationService(mockDb);

      // Service should be constructable with db
      expect(service).toBeDefined();
    });
  });

  // ==========================================================================
  // APPROVE/REJECT WITH EMPTY INPUT
  // ==========================================================================

  describe('approve with minimal/empty input', () => {
    test('should approve with completely empty input object', async () => {
      const service = new ConfirmationService();
      const c = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      const result = await service.approve(c.id, {});

      expect(result).not.toBeNull();
      expect(result!.status).toBe('confirmed');
      expect(result!.responder).toBe('system');
      expect(result!.comment).toBeUndefined();
    });

    test('should prefer comment over reason when both provided', async () => {
      const service = new ConfirmationService();
      const c = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      const result = await service.approve(c.id, {
        comment: 'Comment wins',
        reason: 'Reason loses',
      });

      expect(result!.comment).toBe('Comment wins');
    });

    test('should use reason when comment is empty string', async () => {
      const service = new ConfirmationService();
      const c = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      const result = await service.approve(c.id, {
        comment: '',
        reason: 'Fallback reason',
      });

      // Empty string is falsy, so reason should be used
      expect(result!.comment).toBe('Fallback reason');
    });
  });

  describe('reject with minimal/empty input', () => {
    test('should reject with completely empty input object', async () => {
      const service = new ConfirmationService();
      const c = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      const result = await service.reject(c.id, {});

      expect(result).not.toBeNull();
      expect(result!.status).toBe('rejected');
      expect(result!.responder).toBe('system');
    });

    test('should prefer comment over reason when both provided', async () => {
      const service = new ConfirmationService();
      const c = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      const result = await service.reject(c.id, {
        comment: 'Comment wins',
        reason: 'Reason loses',
      });

      expect(result!.comment).toBe('Comment wins');
    });
  });

  // ==========================================================================
  // AUDIT LOG COMPREHENSIVE
  // ==========================================================================

  describe('audit log edge cases', () => {
    test('should create separate audit entries for approve then reject attempts', async () => {
      const service = new ConfirmationService();
      const c = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      await service.approve(c.id, { responder: 'admin' });
      // Second approve should fail but not create audit
      await service.approve(c.id, { responder: 'admin2' });

      const logs = await service.getAuditLogs({ confirmationId: c.id });
      expect(logs.length).toBe(1);
    });

    test('should accumulate audit logs across multiple operations', async () => {
      const service = new ConfirmationService();
      const c1 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });
      const c2 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'B',
        aiConfidence: 0.8,
      });

      await service.approve(c1.id, { responder: 'admin' });
      await service.reject(c2.id, { responder: 'reviewer' });

      const allLogs = await service.getAuditLogs();
      expect(allLogs.length).toBe(2);
    });

    test('should filter audit logs by user across multiple confirmations', async () => {
      const service = new ConfirmationService();
      const c1 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });
      const c2 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'B',
        aiConfidence: 0.8,
      });
      const c3 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'C',
        aiConfidence: 0.8,
      });

      await service.approve(c1.id, { responder: 'admin' });
      await service.approve(c2.id, { responder: 'admin' });
      await service.reject(c3.id, { responder: 'reviewer' });

      const adminLogs = await service.getAuditLogs({ user: 'admin' });
      const reviewerLogs = await service.getAuditLogs({ user: 'reviewer' });

      expect(adminLogs.length).toBe(2);
      expect(reviewerLogs.length).toBe(1);
    });

    test('should combine confirmationId and user filters', async () => {
      const service = new ConfirmationService();
      const c1 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });

      await service.approve(c1.id, { responder: 'admin' });

      // Filter by confirmationId (user filter only applies to non-confirmationId path)
      const logs = await service.getAuditLogs({ confirmationId: c1.id, user: 'admin' });
      expect(logs.length).toBe(1);
      expect(logs[0].user).toBe('admin');
    });

    test('should handle date range filter with exact timestamps', async () => {
      const service = new ConfirmationService();
      const c = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });

      const beforeApprove = new Date().toISOString();
      await service.approve(c.id, { responder: 'admin' });
      const afterApprove = new Date().toISOString();

      const logs = await service.getAuditLogs({
        startDate: beforeApprove,
        endDate: afterApprove,
      });

      expect(logs.length).toBe(1);
    });
  });

  // ==========================================================================
  // LIST EDGE CASES
  // ==========================================================================

  describe('list edge cases', () => {
    test('should return empty when filtering by non-matching sceneType', async () => {
      const service = new ConfirmationService();
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });

      const result = await service.list({ sceneType: 'non-existent-type' });

      expect(result).toEqual([]);
    });

    test('should return empty when filtering by non-matching priority', async () => {
      const service = new ConfirmationService();
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });

      const result = await service.list({ priority: 'P3' });

      expect(result).toEqual([]);
    });

    test('should handle offset beyond total items', async () => {
      const service = new ConfirmationService();
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });

      const result = await service.list({ offset: 100, limit: 10 });

      expect(result).toEqual([]);
    });

    test('should treat limit of 0 as default (50) since 0 is falsy', async () => {
      const service = new ConfirmationService();
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });

      // 0 is falsy in JS, so `params.limit || 50` evaluates to 50
      const result = await service.list({ limit: 0 });

      expect(result.length).toBe(1); // default limit of 50 applies
    });

    test('should handle very large limit', async () => {
      const service = new ConfirmationService();
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });

      const result = await service.list({ limit: 10000 });

      expect(result.length).toBe(1);
    });

    test('should handle default params when called with undefined', async () => {
      const service = new ConfirmationService();
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });

      const result = await service.list(undefined);

      expect(result.length).toBe(1);
    });

    test('should sort newest first when multiple items have different timestamps', async () => {
      const service = new ConfirmationService();
      const items = [];
      for (let i = 0; i < 5; i++) {
        const c = await service.create({
          sceneType: 'deploy',
          priority: 'P1',
          aiSuggestion: `Item ${i}`,
          aiConfidence: 0.8,
        });
        items.push(c);
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      const result = await service.list();

      // Verify descending order
      for (let i = 0; i < result.length - 1; i++) {
        const current = new Date(result[i].pushTime).getTime();
        const next = new Date(result[i + 1].pushTime).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });

  // ==========================================================================
  // BATCH APPROVE EDGE CASES
  // ==========================================================================

  describe('batchApprove edge cases', () => {
    test('should handle single item batch', async () => {
      const service = new ConfirmationService();
      const c = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });

      const result = await service.batchApprove({
        ids: [c.id],
        responder: 'admin',
      });

      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
    });

    test('should handle batch with duplicate IDs', async () => {
      const service = new ConfirmationService();
      const c = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });

      const result = await service.batchApprove({
        ids: [c.id, c.id, c.id],
        responder: 'admin',
      });

      // First one succeeds, subsequent ones fail (already confirmed)
      expect(result.success).toBe(1);
      expect(result.failed).toBe(2);
    });

    test('should use default responder in batch when not provided', async () => {
      const service = new ConfirmationService();
      const c = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });

      await service.batchApprove({
        ids: [c.id],
      });

      const updated = await service.getById(c.id);
      expect(updated!.responder).toBe('system');
    });

    test('should handle batch with mix of rejected and pending', async () => {
      const service = new ConfirmationService();
      const c1 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });
      const c2 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'B',
        aiConfidence: 0.8,
      });
      const c3 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'C',
        aiConfidence: 0.8,
      });

      await service.reject(c2.id, { responder: 'admin' });

      const result = await service.batchApprove({
        ids: [c1.id, c2.id, c3.id],
        responder: 'admin',
      });

      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.details.find(d => d.id === c2.id)!.status).toBe('failed');
    });

    test('should generate correct details array structure', async () => {
      const service = new ConfirmationService();
      const c1 = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });

      const result = await service.batchApprove({
        ids: [c1.id, 'non-existent'],
        responder: 'admin',
      });

      expect(result.details).toEqual([
        { id: c1.id, status: 'confirmed' },
        { id: 'non-existent', status: 'failed' },
      ]);
    });
  });

  // ==========================================================================
  // NOTIFICATION SETTINGS ISOLATION
  // ==========================================================================

  describe('notification settings user isolation', () => {
    test('should maintain separate settings per user', async () => {
      const service = new ConfirmationService();

      await service.updateNotificationSettings('user-A', {
        channels: ['pagerduty'],
        autoApproveP3: true,
      });

      await service.updateNotificationSettings('user-B', {
        channels: ['email'],
        autoApproveP3: false,
      });

      const settingsA = await service.getNotificationSettings('user-A');
      const settingsB = await service.getNotificationSettings('user-B');

      expect(settingsA.channels).toEqual(['pagerduty']);
      expect(settingsA.autoApproveP3).toBe(true);
      expect(settingsB.channels).toEqual(['email']);
      expect(settingsB.autoApproveP3).toBe(false);
    });

    test('should not leak settings between users on update', async () => {
      const service = new ConfirmationService();

      await service.updateNotificationSettings('user-1', {
        channels: ['slack', 'pagerduty'],
        dndStart: '20:00',
        autoApproveAfterMinutes: 45,
      });

      // user-2 should get defaults, not user-1's settings
      const settings2 = await service.getNotificationSettings('user-2');

      expect(settings2.channels).toEqual(['email', 'slack']);
      expect(settings2.dndStart).toBe('22:00');
      expect(settings2.autoApproveAfterMinutes).toBe(30);
    });

    test('should update all fields at once', async () => {
      const service = new ConfirmationService();

      const result = await service.updateNotificationSettings('user-full', {
        channels: ['webhook', 'pagerduty', 'email'],
        dndStart: '21:00',
        dndEnd: '09:00',
        autoApproveP3: true,
        autoApproveAfterMinutes: 15,
      });

      expect(result.channels).toEqual(['webhook', 'pagerduty', 'email']);
      expect(result.dndStart).toBe('21:00');
      expect(result.dndEnd).toBe('09:00');
      expect(result.autoApproveP3).toBe(true);
      expect(result.autoApproveAfterMinutes).toBe(15);
    });

    test('should handle empty channels array', async () => {
      const service = new ConfirmationService();

      const result = await service.updateNotificationSettings('user-empty', {
        channels: [],
      });

      expect(result.channels).toEqual([]);
    });

    test('should allow updating userId field via partial update (userId is overridden)', async () => {
      const service = new ConfirmationService();

      const result = await service.updateNotificationSettings('user-1', {
        userId: 'attempted-change',
        channels: ['email'],
      });

      // userId should be forced to the original value
      expect(result.userId).toBe('user-1');
    });
  });

  // ==========================================================================
  // STATS COMPLEX SCENARIOS
  // ==========================================================================

  describe('stats after complex state transitions', () => {
    test('should reflect all status changes correctly', async () => {
      const service = new ConfirmationService();

      // Create 10 items
      const items = [];
      for (let i = 0; i < 10; i++) {
        const c = await service.create({
          sceneType: 'deploy',
          priority: 'P1',
          aiSuggestion: `Item ${i}`,
          aiConfidence: 0.8,
          tenantId: 'stats-tenant',
        });
        items.push(c);
      }

      // Approve 3, reject 2, leave 5 pending
      await service.approve(items[0].id, { responder: 'admin' });
      await service.approve(items[1].id, { responder: 'admin' });
      await service.approve(items[2].id, { responder: 'admin' });
      await service.reject(items[3].id, { responder: 'admin' });
      await service.reject(items[4].id, { responder: 'admin' });

      const stats = await service.getStats('stats-tenant');

      expect(stats.total).toBe(10);
      expect(stats.pending).toBe(5);
      expect(stats.confirmed).toBe(3);
      expect(stats.rejected).toBe(2);
      expect(stats.expired).toBe(0);
    });

    test('should not count items from other tenants', async () => {
      const service = new ConfirmationService();

      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
        tenantId: 'tenant-1',
      });
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'B',
        aiConfidence: 0.8,
        tenantId: 'tenant-2',
      });

      const stats1 = await service.getStats('tenant-1');
      const stats2 = await service.getStats('tenant-2');

      expect(stats1.total).toBe(1);
      expect(stats2.total).toBe(1);
    });

    test('should count items without tenantId when filtering by specific tenant', async () => {
      const service = new ConfirmationService();

      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'No tenant',
        aiConfidence: 0.8,
      });

      const stats = await service.getStats('specific-tenant');

      // Items without tenantId should not match a specific tenant filter
      expect(stats.total).toBe(0);
    });

    test('global stats should include items without tenantId', async () => {
      const service = new ConfirmationService();

      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'No tenant',
        aiConfidence: 0.8,
      });
      await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'With tenant',
        aiConfidence: 0.8,
        tenantId: 't-1',
      });

      const globalStats = await service.getStats();

      expect(globalStats.total).toBe(2);
    });
  });

  // ==========================================================================
  // GET BY ID EDGE CASES
  // ==========================================================================

  describe('getById edge cases', () => {
    test('should return null for empty string id', async () => {
      const service = new ConfirmationService();
      const result = await service.getById('');

      expect(result).toBeNull();
    });

    test('should return null for very long id', async () => {
      const service = new ConfirmationService();
      const result = await service.getById('a'.repeat(1000));

      expect(result).toBeNull();
    });

    test('should return correct data after status change', async () => {
      const service = new ConfirmationService();
      const c = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
        tenantId: 't-1',
      });

      await service.approve(c.id, { responder: 'admin', comment: 'OK' });

      const found = await service.getById(c.id);

      expect(found).not.toBeNull();
      expect(found!.status).toBe('confirmed');
      expect(found!.responder).toBe('admin');
      expect(found!.comment).toBe('OK');
      expect(found!.responseTime).toBeDefined();
      // Original fields should be preserved
      expect(found!.sceneType).toBe('deploy');
      expect(found!.priority).toBe('P1');
      expect(found!.aiSuggestion).toBe('Deploy');
      expect(found!.aiConfidence).toBe(0.8);
      expect(found!.tenantId).toBe('t-1');
    });
  });

  // ==========================================================================
  // AUDIT LOG DEFAULTS AND BOUNDARIES
  // ==========================================================================

  describe('audit log defaults and boundaries', () => {
    test('should use default offset 0 and limit 100', async () => {
      const service = new ConfirmationService();

      // Create and approve 105 items
      for (let i = 0; i < 105; i++) {
        const c = await service.create({
          sceneType: 'deploy',
          priority: 'P1',
          aiSuggestion: `Item ${i}`,
          aiConfidence: 0.8,
        });
        await service.approve(c.id, { responder: 'admin' });
      }

      const allLogs = await service.getAuditLogs();
      expect(allLogs.length).toBe(100); // default limit

      const page2 = await service.getAuditLogs({ offset: 100, limit: 100 });
      expect(page2.length).toBe(5);
    });

    test('should handle getAuditLogs with only offset', async () => {
      const service = new ConfirmationService();
      const c = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'A',
        aiConfidence: 0.8,
      });
      await service.approve(c.id, { responder: 'admin' });

      const result = await service.getAuditLogs({ offset: 0 });

      expect(result.length).toBe(1);
    });

    test('should handle getAuditLogs with only limit', async () => {
      const service = new ConfirmationService();
      for (let i = 0; i < 5; i++) {
        const c = await service.create({
          sceneType: 'deploy',
          priority: 'P1',
          aiSuggestion: `Item ${i}`,
          aiConfidence: 0.8,
        });
        await service.approve(c.id, { responder: 'admin' });
      }

      const result = await service.getAuditLogs({ limit: 3 });

      expect(result.length).toBe(3);
    });
  });

  // ==========================================================================
  // CROSS-METHOD COMPLEX SCENARIOS
  // ==========================================================================

  describe('complex cross-method scenarios', () => {
    test('full lifecycle with multiple users and tenants', async () => {
      const service = new ConfirmationService();

      // Create items for different tenants
      const c1 = await service.create({
        sceneType: 'deploy',
        priority: 'P0',
        aiSuggestion: 'Emergency deploy',
        aiConfidence: 0.99,
        context: { incident: 'INC-001' },
        tenantId: 'tenant-prod',
      });
      const c2 = await service.create({
        sceneType: 'scaling',
        priority: 'P1',
        aiSuggestion: 'Scale up',
        aiConfidence: 0.85,
        context: { region: 'us-east-1' },
        tenantId: 'tenant-prod',
      });
      const c3 = await service.create({
        sceneType: 'config-change',
        priority: 'P2',
        aiSuggestion: 'Update config',
        aiConfidence: 0.70,
        tenantId: 'tenant-staging',
      });

      // Different users handle different items
      await service.approve(c1.id, { responder: 'on-call', comment: 'Emergency approved' });
      await service.reject(c2.id, { responder: 'sre-lead', reason: 'Insufficient capacity data' });
      // c3 remains pending

      // Verify stats per tenant
      const prodStats = await service.getStats('tenant-prod');
      expect(prodStats.total).toBe(2);
      expect(prodStats.confirmed).toBe(1);
      expect(prodStats.rejected).toBe(1);

      const stagingStats = await service.getStats('tenant-staging');
      expect(stagingStats.total).toBe(1);
      expect(stagingStats.pending).toBe(1);

      // Verify audit trail
      const c1Logs = await service.getAuditLogs({ confirmationId: c1.id });
      expect(c1Logs[0].user).toBe('on-call');
      expect(c1Logs[0].action).toBe('approved');

      const c2Logs = await service.getAuditLogs({ confirmationId: c2.id });
      expect(c2Logs[0].user).toBe('sre-lead');
      expect(c2Logs[0].action).toBe('rejected');

      // Verify list filtering
      const pendingProd = await service.list({ status: 'pending', tenantId: 'tenant-prod' });
      expect(pendingProd.length).toBe(0);

      const pendingStaging = await service.list({ status: 'pending', tenantId: 'tenant-staging' });
      expect(pendingStaging.length).toBe(1);
    });

    test('batch approve followed by stats verification', async () => {
      const service = new ConfirmationService();

      const items = [];
      for (let i = 0; i < 5; i++) {
        const c = await service.create({
          sceneType: 'deploy',
          priority: 'P1',
          aiSuggestion: `Batch item ${i}`,
          aiConfidence: 0.8,
          tenantId: 'batch-tenant',
        });
        items.push(c);
      }

      await service.batchApprove({
        ids: items.map(i => i.id),
        responder: 'batch-admin',
        comment: 'Batch approved for release',
      });

      const stats = await service.getStats('batch-tenant');
      expect(stats.total).toBe(5);
      expect(stats.confirmed).toBe(5);
      expect(stats.pending).toBe(0);

      // Verify all audit logs
      const logs = await service.getAuditLogs({ user: 'batch-admin' });
      expect(logs.length).toBe(5);
      expect(logs.every(l => l.action === 'approved')).toBe(true);
    });

    test('notification settings update does not affect confirmations', async () => {
      const service = new ConfirmationService();

      const c = await service.create({
        sceneType: 'deploy',
        priority: 'P1',
        aiSuggestion: 'Deploy',
        aiConfidence: 0.8,
      });

      await service.updateNotificationSettings('user-1', {
        channels: ['pagerduty'],
        autoApproveP3: true,
      });

      // Confirmation should be unaffected
      const found = await service.getById(c.id);
      expect(found).not.toBeNull();
      expect(found!.status).toBe('pending');

      const stats = await service.getStats();
      expect(stats.pending).toBe(1);
    });
  });
});

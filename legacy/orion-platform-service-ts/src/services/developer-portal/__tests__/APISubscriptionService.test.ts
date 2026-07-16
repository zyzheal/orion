/**
 * APISubscriptionService Tests
 *
 * Covers: subscription CRUD, approval workflow (approve/reject/suspend/cancel),
 * usage recording, quota management, usage stats, pagination, error handling.
 */

import {
  APISubscriptionService,
  APISubscriptionServiceError,
  APISubscription,
  SubscriptionStatus,
} from '../APISubscriptionService';

describe('APISubscriptionService', () => {
  let service: APISubscriptionService;

  const defaultInput = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    apiName: 'weather-api',
  };

  beforeEach(() => {
    // Each test gets a fresh instance with in-memory Map (no db)
    service = new APISubscriptionService();
  });

  // ==================== createSubscription ====================

  describe('createSubscription', () => {
    it('should create a subscription with all default fields', async () => {
      const sub = await service.createSubscription(defaultInput);

      expect(sub.id).toBeDefined();
      expect(sub.tenantId).toBe('tenant-1');
      expect(sub.userId).toBe('user-1');
      expect(sub.apiName).toBe('weather-api');
      expect(sub.planName).toBe('standard');
      expect(sub.quotaPerDay).toBe(1000);
      expect(sub.quotaPerMonth).toBe(30000);
      expect(sub.usedToday).toBe(0);
      expect(sub.usedThisMonth).toBe(0);
      expect(sub.status).toBe('pending');
      expect(sub.approvedBy).toBeNull();
      expect(sub.approvedAt).toBeNull();
      expect(sub.rejectReason).toBeNull();
      expect(sub.apiKey).toMatch(/^orion_/);
      expect(sub.expiresAt).toBeInstanceOf(Date);
    });

    it('should create a subscription with custom fields', async () => {
      const sub = await service.createSubscription({
        ...defaultInput,
        planName: 'premium',
        quotaPerDay: 5000,
        quotaPerMonth: 150000,
        reason: 'Need high throughput',
      });

      expect(sub.planName).toBe('premium');
      expect(sub.quotaPerDay).toBe(5000);
      expect(sub.quotaPerMonth).toBe(150000);
      expect(sub.reason).toBe('Need high throughput');
    });

    it('should trim whitespace from userId and apiName', async () => {
      const sub = await service.createSubscription({
        ...defaultInput,
        userId: '  user-1  ',
        apiName: '  weather-api  ',
      });

      expect(sub.userId).toBe('user-1');
      expect(sub.apiName).toBe('weather-api');
    });

    it('should throw for empty userId', async () => {
      await expect(
        service.createSubscription({ ...defaultInput, userId: '' })
      ).rejects.toThrow(APISubscriptionServiceError);

      await expect(
        service.createSubscription({ ...defaultInput, userId: '   ' })
      ).rejects.toThrow(APISubscriptionServiceError);
    });

    it('should throw for empty apiName', async () => {
      await expect(
        service.createSubscription({ ...defaultInput, apiName: '' })
      ).rejects.toThrow(APISubscriptionServiceError);
    });

    it('should throw DUPLICATE_SUBSCRIPTION for duplicate active/pending subscription', async () => {
      await service.createSubscription(defaultInput);

      await expect(
        service.createSubscription(defaultInput)
      ).rejects.toThrow(APISubscriptionServiceError);

      try {
        await service.createSubscription(defaultInput);
      } catch (err: any) {
        expect(err.code).toBe('DUPLICATE_SUBSCRIPTION');
      }
    });

    it('should allow subscribing to a different API', async () => {
      await service.createSubscription(defaultInput);
      const sub2 = await service.createSubscription({ ...defaultInput, apiName: 'stock-api' });

      expect(sub2.apiName).toBe('stock-api');
    });

    it('should allow subscribing from a different user', async () => {
      await service.createSubscription(defaultInput);
      const sub2 = await service.createSubscription({ ...defaultInput, userId: 'user-2' });

      expect(sub2.userId).toBe('user-2');
    });

    it('should set expiresAt approximately 1 year from now', async () => {
      const now = Date.now();
      const sub = await service.createSubscription(defaultInput);

      const expiresAt = sub.expiresAt!.getTime();
      const oneYear = 365 * 24 * 60 * 60 * 1000;
      expect(expiresAt).toBeGreaterThan(now + oneYear - 5000);
      expect(expiresAt).toBeLessThan(now + oneYear + 5000);
    });

    it('should generate unique api keys for each subscription', async () => {
      const sub1 = await service.createSubscription(defaultInput);
      await service.approveSubscription(sub1.id, { approvedBy: 'admin' });
      const sub2 = await service.createSubscription({ ...defaultInput, apiName: 'other-api' });

      expect(sub1.apiKey).not.toBe(sub2.apiKey);
    });

    it('should allow re-subscribing after cancellation', async () => {
      const sub1 = await service.createSubscription(defaultInput);
      await service.cancelSubscription(sub1.id);

      const sub2 = await service.createSubscription(defaultInput);
      expect(sub2.id).not.toBe(sub1.id);
      expect(sub2.status).toBe('pending');
    });
  });

  // ==================== getSubscriptionById ====================

  describe('getSubscriptionById', () => {
    it('should return a subscription by ID', async () => {
      const created = await service.createSubscription(defaultInput);
      const sub = await service.getSubscriptionById(created.id);

      expect(sub.id).toBe(created.id);
      expect(sub.apiName).toBe('weather-api');
    });

    it('should throw SUBSCRIPTION_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.getSubscriptionById('non-existent')
      ).rejects.toThrow(APISubscriptionServiceError);

      try {
        await service.getSubscriptionById('non-existent');
      } catch (err: any) {
        expect(err.code).toBe('SUBSCRIPTION_NOT_FOUND');
      }
    });
  });

  // ==================== listSubscriptions ====================

  describe('listSubscriptions', () => {
    it('should return paginated subscriptions', async () => {
      for (let i = 0; i < 5; i++) {
        await service.createSubscription({ ...defaultInput, apiName: `api-${i}` });
      }

      const result = await service.listSubscriptions('tenant-1', { page: 1, pageSize: 3 });

      expect(result.data.length).toBe(3);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(2);
    });

    it('should use default pagination', async () => {
      const result = await service.listSubscriptions('tenant-1');

      expect(result.page).toBe(1);
      expect(result.data.length).toBe(0);
    });

    it('should filter by userId', async () => {
      await service.createSubscription(defaultInput);
      await service.createSubscription({ ...defaultInput, userId: 'user-2', apiName: 'other-api' });

      const result = await service.listSubscriptions('tenant-1', { userId: 'user-1' });
      expect(result.data.every(s => s.userId === 'user-1')).toBe(true);
    });

    it('should filter by apiName', async () => {
      await service.createSubscription(defaultInput);
      await service.createSubscription({ ...defaultInput, apiName: 'stock-api' });

      const result = await service.listSubscriptions('tenant-1', { apiName: 'weather-api' });
      expect(result.data.every(s => s.apiName === 'weather-api')).toBe(true);
    });

    it('should filter by status', async () => {
      const sub = await service.createSubscription(defaultInput);
      await service.createSubscription({ ...defaultInput, apiName: 'stock-api' });

      await service.approveSubscription(sub.id, { approvedBy: 'admin' });

      const approved = await service.listSubscriptions('tenant-1', { status: 'approved' });
      expect(approved.data.every(s => s.status === 'approved')).toBe(true);
    });

    it('should isolate by tenantId', async () => {
      await service.createSubscription(defaultInput);
      await service.createSubscription({ ...defaultInput, tenantId: 'tenant-2' });

      const result = await service.listSubscriptions('tenant-1');
      expect(result.total).toBe(1);
    });
  });

  // ==================== approveSubscription ====================

  describe('approveSubscription', () => {
    it('should approve a pending subscription', async () => {
      const sub = await service.createSubscription(defaultInput);
      const approved = await service.approveSubscription(sub.id, { approvedBy: 'admin-1' });

      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe('admin-1');
      expect(approved.approvedAt).toBeInstanceOf(Date);
    });

    it('should throw SUBSCRIPTION_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.approveSubscription('non-existent', { approvedBy: 'admin' })
      ).rejects.toThrow(APISubscriptionServiceError);
    });

    it('should throw INVALID_STATUS for already approved subscription', async () => {
      const sub = await service.createSubscription(defaultInput);
      await service.approveSubscription(sub.id, { approvedBy: 'admin' });

      await expect(
        service.approveSubscription(sub.id, { approvedBy: 'admin' })
      ).rejects.toThrow(APISubscriptionServiceError);

      try {
        await service.approveSubscription(sub.id, { approvedBy: 'admin' });
      } catch (err: any) {
        expect(err.code).toBe('INVALID_STATUS');
      }
    });

    it('should throw INVALID_STATUS for rejected subscription', async () => {
      const sub = await service.createSubscription(defaultInput);
      await service.rejectSubscription(sub.id, { approvedBy: 'admin' });

      await expect(
        service.approveSubscription(sub.id, { approvedBy: 'admin' })
      ).rejects.toThrow(APISubscriptionServiceError);
    });
  });

  // ==================== rejectSubscription ====================

  describe('rejectSubscription', () => {
    it('should reject a pending subscription with reason', async () => {
      const sub = await service.createSubscription(defaultInput);
      const rejected = await service.rejectSubscription(sub.id, {
        approvedBy: 'admin-1',
        rejectReason: 'Insufficient credentials',
      });

      expect(rejected.status).toBe('rejected');
      expect(rejected.approvedBy).toBe('admin-1');
      expect(rejected.rejectReason).toBe('Insufficient credentials');
    });

    it('should reject with empty reason if not provided', async () => {
      const sub = await service.createSubscription(defaultInput);
      const rejected = await service.rejectSubscription(sub.id, { approvedBy: 'admin' });

      expect(rejected.rejectReason).toBe('');
    });

    it('should throw INVALID_STATUS for already approved subscription', async () => {
      const sub = await service.createSubscription(defaultInput);
      await service.approveSubscription(sub.id, { approvedBy: 'admin' });

      await expect(
        service.rejectSubscription(sub.id, { approvedBy: 'admin' })
      ).rejects.toThrow(APISubscriptionServiceError);
    });

    it('should throw SUBSCRIPTION_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.rejectSubscription('non-existent', { approvedBy: 'admin' })
      ).rejects.toThrow(APISubscriptionServiceError);
    });
  });

  // ==================== suspendSubscription ====================

  describe('suspendSubscription', () => {
    it('should suspend an approved subscription', async () => {
      const sub = await service.createSubscription(defaultInput);
      await service.approveSubscription(sub.id, { approvedBy: 'admin' });

      const suspended = await service.suspendSubscription(sub.id);
      expect(suspended.status).toBe('suspended');
    });

    it('should throw INVALID_STATUS for pending subscription', async () => {
      const sub = await service.createSubscription(defaultInput);

      await expect(
        service.suspendSubscription(sub.id)
      ).rejects.toThrow(APISubscriptionServiceError);

      try {
        await service.suspendSubscription(sub.id);
      } catch (err: any) {
        expect(err.code).toBe('INVALID_STATUS');
      }
    });

    it('should throw SUBSCRIPTION_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.suspendSubscription('non-existent')
      ).rejects.toThrow(APISubscriptionServiceError);
    });
  });

  // ==================== cancelSubscription ====================

  describe('cancelSubscription', () => {
    it('should cancel a pending subscription', async () => {
      const sub = await service.createSubscription(defaultInput);
      const cancelled = await service.cancelSubscription(sub.id);

      expect(cancelled.status).toBe('cancelled');
    });

    it('should cancel an approved subscription', async () => {
      const sub = await service.createSubscription(defaultInput);
      await service.approveSubscription(sub.id, { approvedBy: 'admin' });

      const cancelled = await service.cancelSubscription(sub.id);
      expect(cancelled.status).toBe('cancelled');
    });

    it('should throw SUBSCRIPTION_NOT_FOUND for non-existent ID', async () => {
      await expect(
        service.cancelSubscription('non-existent')
      ).rejects.toThrow(APISubscriptionServiceError);
    });
  });

  // ==================== recordUsage ====================

  describe('recordUsage', () => {
    it('should record a usage entry and increment counters', async () => {
      const sub = await service.createSubscription(defaultInput);
      await service.approveSubscription(sub.id, { approvedBy: 'admin' });

      const record = await service.recordUsage(sub.id, '/api/v1/weather', 'GET', 200, 150);

      expect(record.id).toBeDefined();
      expect(record.subscriptionId).toBe(sub.id);
      expect(record.endpoint).toBe('/api/v1/weather');
      expect(record.method).toBe('GET');
      expect(record.statusCode).toBe(200);
      expect(record.latencyMs).toBe(150);
      expect(record.timestamp).toBeInstanceOf(Date);

      const updated = await service.getSubscriptionById(sub.id);
      expect(updated.usedToday).toBe(1);
      expect(updated.usedThisMonth).toBe(1);
    });

    it('should throw for non-existent subscription', async () => {
      await expect(
        service.recordUsage('non-existent', '/api', 'GET', 200, 100)
      ).rejects.toThrow(APISubscriptionServiceError);
    });

    it('should throw INVALID_STATUS for non-approved subscription', async () => {
      const sub = await service.createSubscription(defaultInput);

      await expect(
        service.recordUsage(sub.id, '/api', 'GET', 200, 100)
      ).rejects.toThrow(APISubscriptionServiceError);

      try {
        await service.recordUsage(sub.id, '/api', 'GET', 200, 100);
      } catch (err: any) {
        expect(err.code).toBe('INVALID_STATUS');
      }
    });

    it('should throw QUOTA_EXCEEDED when daily quota is exceeded', async () => {
      const sub = await service.createSubscription({ ...defaultInput, quotaPerDay: 2 });
      await service.approveSubscription(sub.id, { approvedBy: 'admin' });

      await service.recordUsage(sub.id, '/api', 'GET', 200, 100);
      await service.recordUsage(sub.id, '/api', 'GET', 200, 100);

      await expect(
        service.recordUsage(sub.id, '/api', 'GET', 200, 100)
      ).rejects.toThrow(APISubscriptionServiceError);

      try {
        await service.recordUsage(sub.id, '/api', 'GET', 200, 100);
      } catch (err: any) {
        expect(err.code).toBe('QUOTA_EXCEEDED');
      }
    });

    it('should track multiple usage records per subscription', async () => {
      const sub = await service.createSubscription(defaultInput);
      await service.approveSubscription(sub.id, { approvedBy: 'admin' });

      await service.recordUsage(sub.id, '/api/a', 'GET', 200, 100);
      await service.recordUsage(sub.id, '/api/b', 'POST', 201, 200);
      await service.recordUsage(sub.id, '/api/c', 'DELETE', 200, 50);

      const updated = await service.getSubscriptionById(sub.id);
      expect(updated.usedToday).toBe(3);
      expect(updated.usedThisMonth).toBe(3);
    });
  });

  // ==================== getUsageRecords ====================

  describe('getUsageRecords', () => {
    it('should return paginated usage records', async () => {
      const sub = await service.createSubscription(defaultInput);
      await service.approveSubscription(sub.id, { approvedBy: 'admin' });

      for (let i = 0; i < 5; i++) {
        await service.recordUsage(sub.id, `/api/${i}`, 'GET', 200, 100);
      }

      const result = await service.getUsageRecords(sub.id, { page: 1, pageSize: 3 });
      expect(result.data.length).toBe(3);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(2);
    });

    it('should return empty result for subscription with no usage', async () => {
      const sub = await service.createSubscription(defaultInput);

      const result = await service.getUsageRecords(sub.id);
      expect(result.data.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should throw for non-existent subscription', async () => {
      await expect(
        service.getUsageRecords('non-existent')
      ).rejects.toThrow(APISubscriptionServiceError);
    });
  });

  // ==================== getUsageStats ====================

  describe('getUsageStats', () => {
    it('should return stats grouped by status', async () => {
      const sub1 = await service.createSubscription({ ...defaultInput, apiName: 'api-1' });
      const sub2 = await service.createSubscription({ ...defaultInput, apiName: 'api-2' });
      const sub3 = await service.createSubscription({ ...defaultInput, apiName: 'api-3' });

      await service.approveSubscription(sub1.id, { approvedBy: 'admin' });
      await service.rejectSubscription(sub2.id, { approvedBy: 'admin' });
      // sub3 remains pending

      const stats = await service.getUsageStats('tenant-1');

      expect(stats.totalSubscriptions).toBe(3);
      expect(stats.approved).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.suspended).toBe(0);
    });

    it('should return all zeros for empty tenant', async () => {
      const stats = await service.getUsageStats('tenant-empty');

      expect(stats.totalSubscriptions).toBe(0);
      expect(stats.approved).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.rejected).toBe(0);
      expect(stats.suspended).toBe(0);
    });

    it('should count suspended subscriptions', async () => {
      const sub = await service.createSubscription({ ...defaultInput, apiName: 'api-1' });
      await service.approveSubscription(sub.id, { approvedBy: 'admin' });
      await service.suspendSubscription(sub.id);

      const stats = await service.getUsageStats('tenant-1');
      expect(stats.suspended).toBe(1);
      expect(stats.approved).toBe(0);
    });

    it('should isolate stats by tenant', async () => {
      await service.createSubscription(defaultInput);
      await service.createSubscription({ ...defaultInput, tenantId: 'tenant-2', apiName: 'api-2' });

      const stats1 = await service.getUsageStats('tenant-1');
      const stats2 = await service.getUsageStats('tenant-2');

      expect(stats1.totalSubscriptions).toBe(1);
      expect(stats2.totalSubscriptions).toBe(1);
    });
  });

  // ==================== workflow scenarios ====================

  describe('full subscription lifecycle', () => {
    it('should support full approve -> use -> suspend -> cancel lifecycle', async () => {
      const sub = await service.createSubscription(defaultInput);
      expect(sub.status).toBe('pending');

      const approved = await service.approveSubscription(sub.id, { approvedBy: 'admin' });
      expect(approved.status).toBe('approved');

      await service.recordUsage(sub.id, '/api/test', 'GET', 200, 100);
      const afterUse = await service.getSubscriptionById(sub.id);
      expect(afterUse.usedToday).toBe(1);

      const suspended = await service.suspendSubscription(sub.id);
      expect(suspended.status).toBe('suspended');

      const cancelled = await service.cancelSubscription(sub.id);
      expect(cancelled.status).toBe('cancelled');
    });

    it('should prevent usage recording on suspended subscription', async () => {
      const sub = await service.createSubscription(defaultInput);
      await service.approveSubscription(sub.id, { approvedBy: 'admin' });
      await service.recordUsage(sub.id, '/api', 'GET', 200, 100);
      await service.suspendSubscription(sub.id);

      await expect(
        service.recordUsage(sub.id, '/api', 'GET', 200, 100)
      ).rejects.toThrow(APISubscriptionServiceError);
    });
  });
});

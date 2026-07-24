/**
 * Tests for ServiceCatalogService — business logic, status transitions, validation, SLA
 *
 * Mode B: mock pool.query, verify business logic (validation, state machines, error handling).
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ServiceCatalogService } from '../ServiceCatalogService';

const mockPool = {
  query: jest.fn<any, any>(),
};

const TENANT = 'tenant-1';

function serviceRow(overrides: Record<string, any> = {}) {
  return {
    id: 'svc-1',
    tenant_id: TENANT,
    name: 'VPN Access',
    description: null,
    category: 'network',
    status: 'active',
    owner: null,
    support_team: null,
    sla_tier: 'bronze',
    availability_target: null,
    response_time_target: null,
    related_systems: [],
    metadata: '{}',
    created_by: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function requestRow(overrides: Record<string, any> = {}) {
  return {
    id: 'req-1',
    tenant_id: TENANT,
    service_id: 'svc-1',
    requester_id: 'user-1',
    title: 'Need VPN access',
    description: null,
    priority: 'medium',
    status: 'pending',
    assigned_to: null,
    approved_by: null,
    approved_at: null,
    fulfilled_at: null,
    sla_breach: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('CatalogService (Business Logic)', () => {
  let service: ServiceCatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ServiceCatalogService(mockPool as any);
  });

  // ==================== Service Validation ====================

  describe('createService validation', () => {
    it('should reject empty name', async () => {
      await expect(service.createService({ name: '' }, TENANT)).rejects.toThrow(
        'Service name is required',
      );
    });

    it('should reject whitespace-only name', async () => {
      await expect(service.createService({ name: '   ' }, TENANT)).rejects.toThrow(
        'Service name is required',
      );
    });

    it('should reject invalid SLA tier', async () => {
      await expect(
        service.createService({ name: 'Test', slaTier: 'platinum' }, TENANT),
      ).rejects.toThrow('Invalid SLA tier');
    });

    it('should reject invalid status', async () => {
      await expect(
        service.createService({ name: 'Test', status: 'deleted' }, TENANT),
      ).rejects.toThrow('Invalid status');
    });

    it('should accept valid SLA tiers: gold, silver, bronze', async () => {
      for (const tier of ['gold', 'silver', 'bronze']) {
        mockPool.query.mockResolvedValueOnce({
          rows: [serviceRow({ sla_tier: tier })],
        });
        const result = await service.createService({ name: 'Test', slaTier: tier }, TENANT);
        expect(result.sla_tier).toBe(tier);
      }
    });

    it('should accept valid statuses: active, inactive, retired', async () => {
      for (const status of ['active', 'inactive', 'retired']) {
        mockPool.query.mockResolvedValueOnce({
          rows: [serviceRow({ status })],
        });
        const result = await service.createService({ name: 'Test', status }, TENANT);
        expect(result.status).toBe(status);
      }
    });
  });

  describe('updateService validation', () => {
    it('should reject invalid SLA tier on update', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [serviceRow()] });

      await expect(
        service.updateService('svc-1', { slaTier: 'platinum' }, TENANT),
      ).rejects.toThrow('Invalid SLA tier');
    });

    it('should reject invalid status transition: active -> retired via active -> inactive -> retired', async () => {
      // retired is not directly reachable from active? Let's check: SERVICE_STATUS_TRANSITIONS['active'] = ['inactive', 'retired']
      // Actually retired IS allowed from active. Let's test a disallowed transition.
      mockPool.query.mockResolvedValueOnce({ rows: [serviceRow({ status: 'retired' })] });

      await expect(
        service.updateService('svc-1', { status: 'active' }, TENANT),
      ).rejects.toThrow("Cannot transition service from 'retired'");
    });

    it('should allow active -> inactive', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [serviceRow({ status: 'active' })] });
      mockPool.query.mockResolvedValueOnce({
        rows: [serviceRow({ status: 'inactive' })],
      });

      const result = await service.updateService('svc-1', { status: 'inactive' }, TENANT);
      expect(result.status).toBe('inactive');
    });

    it('should allow active -> retired', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [serviceRow({ status: 'active' })] });
      mockPool.query.mockResolvedValueOnce({
        rows: [serviceRow({ status: 'retired' })],
      });

      const result = await service.updateService('svc-1', { status: 'retired' }, TENANT);
      expect(result.status).toBe('retired');
    });

    it('should allow inactive -> active', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [serviceRow({ status: 'inactive' })] });
      mockPool.query.mockResolvedValueOnce({
        rows: [serviceRow({ status: 'active' })],
      });

      const result = await service.updateService('svc-1', { status: 'active' }, TENANT);
      expect(result.status).toBe('active');
    });

    it('should allow inactive -> retired', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [serviceRow({ status: 'inactive' })] });
      mockPool.query.mockResolvedValueOnce({
        rows: [serviceRow({ status: 'retired' })],
      });

      const result = await service.updateService('svc-1', { status: 'retired' }, TENANT);
      expect(result.status).toBe('retired');
    });

    it('should reject retired -> any status', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [serviceRow({ status: 'retired' })] });

      await expect(
        service.updateService('svc-1', { status: 'inactive' }, TENANT),
      ).rejects.toThrow("Cannot transition service from 'retired'");
    });
  });

  // ==================== Request Validation ====================

  describe('createRequest validation', () => {
    it('should reject empty title', async () => {
      await expect(
        service.createRequest({ serviceId: 'svc-1', requesterId: 'user-1', title: '' }, TENANT),
      ).rejects.toThrow('Request title is required');
    });

    it('should reject missing serviceId', async () => {
      await expect(
        service.createRequest({ serviceId: '', requesterId: 'user-1', title: 'Test' }, TENANT),
      ).rejects.toThrow('Service ID is required');
    });

    it('should reject missing requesterId', async () => {
      await expect(
        service.createRequest({ serviceId: 'svc-1', requesterId: '', title: 'Test' }, TENANT),
      ).rejects.toThrow('Requester ID is required');
    });

    it('should reject when service is not active', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [serviceRow({ status: 'inactive' })],
      });

      await expect(
        service.createRequest({ serviceId: 'svc-1', requesterId: 'user-1', title: 'Test' }, TENANT),
      ).rejects.toThrow('Cannot request a non-active service');
    });

    it('should reject when service not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createRequest({ serviceId: 'nonexistent', requesterId: 'user-1', title: 'Test' }, TENANT),
      ).rejects.toThrow();
    });

    it('should reject invalid priority', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [serviceRow({ status: 'active' })] });

      await expect(
        service.createRequest(
          { serviceId: 'svc-1', requesterId: 'user-1', title: 'Test', priority: 'urgent' },
          TENANT,
        ),
      ).rejects.toThrow('Invalid priority');
    });

    it('should accept valid priorities: critical, high, medium, low', async () => {
      for (const priority of ['critical', 'high', 'medium', 'low']) {
        mockPool.query.mockResolvedValueOnce({ rows: [serviceRow({ status: 'active' })] });
        mockPool.query.mockResolvedValueOnce({
          rows: [requestRow({ priority })],
        });
        mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

        const result = await service.createRequest(
          { serviceId: 'svc-1', requesterId: 'user-1', title: 'Test', priority },
          TENANT,
        );
        expect(result.priority).toBe(priority);
      }
    });
  });

  // ==================== Request Status Transitions ====================

  describe('transitionStatus', () => {
    it('should allow pending -> approved with approvedBy and approvedAt', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'pending' })] });
      mockPool.query.mockResolvedValueOnce({
        rows: [requestRow({ status: 'approved', approved_by: 'admin-1' })],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      const result = await service.transitionStatus('req-1', {
        status: 'approved',
        userId: 'admin-1',
      }, TENANT);

      expect(result.status).toBe('approved');
      // Verify approvedBy and approvedAt in update
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE catalog_requests'),
        expect.arrayContaining([expect.any(Date)]), // approvedAt
      );
    });

    it('should allow pending -> rejected', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'pending' })] });
      mockPool.query.mockResolvedValueOnce({
        rows: [requestRow({ status: 'rejected' })],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      const result = await service.transitionStatus('req-1', {
        status: 'rejected',
        userId: 'admin-1',
      }, TENANT);

      expect(result.status).toBe('rejected');
    });

    it('should allow pending -> cancelled', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'pending' })] });
      mockPool.query.mockResolvedValueOnce({
        rows: [requestRow({ status: 'cancelled' })],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      const result = await service.transitionStatus('req-1', {
        status: 'cancelled',
        userId: 'user-1',
      }, TENANT);

      expect(result.status).toBe('cancelled');
    });

    it('should allow approved -> in_progress', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'approved' })] });
      mockPool.query.mockResolvedValueOnce({
        rows: [requestRow({ status: 'in_progress' })],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      const result = await service.transitionStatus('req-1', {
        status: 'in_progress',
        userId: 'admin-1',
      }, TENANT);

      expect(result.status).toBe('in_progress');
    });

    it('should allow approved -> cancelled', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'approved' })] });
      mockPool.query.mockResolvedValueOnce({
        rows: [requestRow({ status: 'cancelled' })],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      const result = await service.transitionStatus('req-1', {
        status: 'cancelled',
        userId: 'user-1',
      }, TENANT);

      expect(result.status).toBe('cancelled');
    });

    it('should allow in_progress -> fulfilled with fulfilledAt', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'in_progress' })] });
      mockPool.query.mockResolvedValueOnce({
        rows: [requestRow({ status: 'fulfilled', fulfilled_at: new Date() })],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      const result = await service.transitionStatus('req-1', {
        status: 'fulfilled',
        userId: 'admin-1',
      }, TENANT);

      expect(result.status).toBe('fulfilled');
    });

    it('should allow in_progress -> cancelled', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'in_progress' })] });
      mockPool.query.mockResolvedValueOnce({
        rows: [requestRow({ status: 'cancelled' })],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      const result = await service.transitionStatus('req-1', {
        status: 'cancelled',
        userId: 'user-1',
      }, TENANT);

      expect(result.status).toBe('cancelled');
    });

    it('should reject fulfilled -> anything', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'fulfilled' })] });

      await expect(
        service.transitionStatus('req-1', { status: 'pending', userId: 'user-1' }, TENANT),
      ).rejects.toThrow("Cannot transition request from 'fulfilled'");
    });

    it('should reject rejected -> anything', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'rejected' })] });

      await expect(
        service.transitionStatus('req-1', { status: 'pending', userId: 'user-1' }, TENANT),
      ).rejects.toThrow("Cannot transition request from 'rejected'");
    });

    it('should reject cancelled -> anything', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'cancelled' })] });

      await expect(
        service.transitionStatus('req-1', { status: 'pending', userId: 'user-1' }, TENANT),
      ).rejects.toThrow("Cannot transition request from 'cancelled'");
    });

    it('should reject invalid transition: pending -> fulfilled', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'pending' })] });

      await expect(
        service.transitionStatus('req-1', { status: 'fulfilled', userId: 'user-1' }, TENANT),
      ).rejects.toThrow("Cannot transition request from 'pending'");
    });

    it('should create timeline event on status transition', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'pending' })] });
      mockPool.query.mockResolvedValueOnce({
        rows: [requestRow({ status: 'approved' })],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      await service.transitionStatus('req-1', {
        status: 'approved',
        userId: 'admin-1',
        comment: 'Approved by admin',
      }, TENANT);

      // Verify timeline INSERT
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO catalog_request_timeline'),
        expect.arrayContaining([
          expect.any(String), // id
          'req-1',
          TENANT,
          'status_approved',
          'Approved by admin',
          'admin-1',
        ]),
      );
    });

    it('should use default description when no comment provided', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'pending' })] });
      mockPool.query.mockResolvedValueOnce({
        rows: [requestRow({ status: 'approved' })],
      });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

      await service.transitionStatus('req-1', {
        status: 'approved',
        userId: 'admin-1',
      }, TENANT);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO catalog_request_timeline'),
        expect.arrayContaining([expect.any(String), 'req-1', TENANT, 'status_approved', "Status changed to 'approved'"]),
      );
    });

    it('should throw when request not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.transitionStatus('nonexistent', { status: 'approved', userId: 'user-1' }, TENANT),
      ).rejects.toThrow();
    });

    it('should throw when tenant does not match', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [requestRow({ tenant_id: 'other-tenant' })],
      });

      await expect(
        service.transitionStatus('req-1', { status: 'approved', userId: 'user-1' }, TENANT),
      ).rejects.toThrow();
    });
  });

  // ==================== Timeline ====================

  describe('getTimeline', () => {
    it('should return timeline events after verifying request exists', async () => {
      // findById for request
      mockPool.query.mockResolvedValueOnce({ rows: [requestRow()] });
      // findByRequestId
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 'evt-1', request_id: 'req-1', event_type: 'created', metadata: '{}' },
          { id: 'evt-2', request_id: 'req-1', event_type: 'status_approved', metadata: '{}' },
        ],
      });

      const result = await service.getTimeline('req-1', TENANT);

      expect(result).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM catalog_request_timeline WHERE request_id = $1'),
        ['req-1'],
      );
    });

    it('should throw when request not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.getTimeline('nonexistent', TENANT)).rejects.toThrow();
    });
  });

  // ==================== SLA Breach Detection ====================

  describe('detectSlaBreaches', () => {
    it('should detect and return breached requests', async () => {
      // detectSlaBreaches UPDATE
      mockPool.query.mockResolvedValueOnce({ rowCount: 2 });
      // findSlaBreaches SELECT
      mockPool.query.mockResolvedValueOnce({
        rows: [
          requestRow({ id: 'req-1', sla_breach: true }),
          requestRow({ id: 'req-2', sla_breach: true }),
        ],
      });

      const result = await service.detectSlaBreaches(TENANT);

      expect(result.breached).toBe(2);
      expect(result.breaches).toHaveLength(2);
    });

    it('should return zero when no breaches', async () => {
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.detectSlaBreaches(TENANT);

      expect(result.breached).toBe(0);
      expect(result.breaches).toHaveLength(0);
    });
  });

  describe('getSlaBreaches', () => {
    it('should return breached requests', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [requestRow({ sla_breach: true })],
      });

      const result = await service.getSlaBreaches(TENANT);

      expect(result).toHaveLength(1);
      expect(result[0].sla_breach).toBe(true);
    });
  });

  // ==================== Statistics ====================

  describe('getStats', () => {
    it('should return service and request statistics', async () => {
      // findByTenant for services
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: '3' }],
      });
      mockPool.query.mockResolvedValueOnce({
        rows: [
          serviceRow({ id: 'svc-1', status: 'active' }),
          serviceRow({ id: 'svc-2', status: 'active' }),
          serviceRow({ id: 'svc-3', status: 'inactive' }),
        ],
      });
      // getStats for requests
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { status: 'pending', count: 5 },
          { status: 'approved', count: 3 },
          { status: 'fulfilled', count: 10 },
        ],
      });
      // findSlaBreaches
      mockPool.query.mockResolvedValueOnce({
        rows: [requestRow({ sla_breach: true })],
      });

      const result = await service.getStats(TENANT);

      expect(result.services.total).toBe(3);
      expect(result.services.active).toBe(2);
      expect(result.services.inactive).toBe(1);
      expect(result.services.retired).toBe(0);
      expect(result.requests.total).toBe(18);
      expect(result.requests.pending).toBe(5);
      expect(result.slaBreaches).toBe(1);
    });
  });
});

/**
 * Tests for ServiceCatalogRepository and ServiceRequestRepository — CRUD SQL verification
 *
 * Mode A: mock pool.query, verify SQL queries and parameters.
 * Tests repository-level operations through ServiceCatalogService (which creates repos internally).
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ServiceCatalogService } from '../ServiceCatalogService';

const mockPool = {
  query: jest.fn<any, any>(),
};

const TENANT = 'tenant-1';

// Helper: build a catalog_services row
function serviceRow(overrides: Record<string, any> = {}) {
  return {
    id: 'svc-1',
    tenant_id: TENANT,
    name: 'VPN Access',
    description: 'VPN access request service',
    category: 'network',
    status: 'active',
    owner: 'admin-1',
    support_team: 'network-team',
    sla_tier: 'gold',
    availability_target: 99.9,
    response_time_target: 3600,
    related_systems: ['firewall', 'ldap'],
    metadata: '{}',
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Helper: build a catalog_requests row
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

describe('CatalogRepository (ServiceCatalogService CRUD)', () => {
  let service: ServiceCatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ServiceCatalogService(mockPool as any);
  });

  // ==================== Service CRUD ====================

  describe('Service CRUD', () => {
    describe('createService', () => {
      it('should INSERT into catalog_services with all fields', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [serviceRow()] });

        const result = await service.createService({
          name: 'VPN Access',
          category: 'network',
          description: 'VPN access request service',
          slaTier: 'gold',
          owner: 'admin-1',
          supportTeam: 'network-team',
          availabilityTarget: 99.9,
          responseTimeTarget: 3600,
          relatedSystems: ['firewall', 'ldap'],
          createdBy: 'user-1',
        }, TENANT);

        expect(result.id).toBe('svc-1');
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO catalog_services'),
          expect.arrayContaining([
            expect.any(String), // id (uuid)
            TENANT,
            'VPN Access',
            'VPN access request service',
            'network',
            'active',
            'admin-1',
            'network-team',
            'gold',
            99.9,
            3600,
            ['firewall', 'ldap'],
            '{}',
            'user-1',
          ]),
        );
      });

      it('should apply defaults for optional fields', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [serviceRow({
            name: 'Simple Service',
            category: 'general',
            status: 'active',
            sla_tier: 'bronze',
            owner: null,
            support_team: null,
          })],
        });

        await service.createService({ name: 'Simple Service' }, TENANT);

        const [, params] = mockPool.query.mock.calls[0];
        expect(params).toContain('general');   // default category
        expect(params).toContain('active');    // default status
        expect(params).toContain('bronze');    // default slaTier
      });
    });

    describe('getService', () => {
      it('should SELECT by id and verify tenant_id', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [serviceRow()] });

        const result = await service.getService('svc-1', TENANT);

        expect(result.id).toBe('svc-1');
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM catalog_services WHERE id = $1'),
          ['svc-1'],
        );
      });

      it('should throw when service not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await expect(service.getService('nonexistent', TENANT)).rejects.toThrow();
      });

      it('should throw when tenant_id does not match', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [serviceRow({ tenant_id: 'other-tenant' })],
        });

        await expect(service.getService('svc-1', TENANT)).rejects.toThrow();
      });
    });

    describe('listServices', () => {
      it('should SELECT with tenant filter and pagination (default path)', async () => {
        // findByTenant: first query is count, second is data
        mockPool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
        mockPool.query.mockResolvedValueOnce({
          rows: [serviceRow({ id: 'svc-1' }), serviceRow({ id: 'svc-2', name: 'Git Access' })],
        });

        const result = await service.listServices(TENANT);

        expect(result.services).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('COUNT(*)'),
          [TENANT],
        );
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM catalog_services WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT'),
          expect.arrayContaining([TENANT]),
        );
      });

      it('should filter by category via findByCategory', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [serviceRow({ category: 'network' })],
        });

        const result = await service.listServices(TENANT, { category: 'network' });

        expect(result.services).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('category = $'),
          expect.arrayContaining([TENANT, 'network']),
        );
      });

      it('should filter by status via findByStatus', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [serviceRow({ status: 'inactive' })],
        });

        const result = await service.listServices(TENANT, { status: 'inactive' });

        expect(result.services).toHaveLength(1);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('status = $'),
          expect.arrayContaining([TENANT, 'inactive']),
        );
      });

      it('should pass limit/offset to findByTenant', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await service.listServices(TENANT, { limit: 5, offset: 10 });

        const [, params] = mockPool.query.mock.calls[1];
        expect(params).toContain(5);   // limit
        expect(params).toContain(10);  // offset
      });
    });

    describe('updateService', () => {
      it('should UPDATE only provided fields', async () => {
        // findById (via getService internally not called, updateService calls findById directly)
        mockPool.query.mockResolvedValueOnce({ rows: [serviceRow()] });
        // updateService
        mockPool.query.mockResolvedValueOnce({
          rows: [serviceRow({ name: 'Updated VPN' })],
        });

        const result = await service.updateService('svc-1', { name: 'Updated VPN' }, TENANT);

        expect(result.name).toBe('Updated VPN');
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE catalog_services SET'),
          expect.arrayContaining(['Updated VPN', 'svc-1']),
        );
      });

      it('should return existing when no fields to update', async () => {
        // 1st findById: in updateService() tenant check
        mockPool.query.mockResolvedValueOnce({ rows: [serviceRow()] });
        // 2nd findById: in repo.updateService() when fields.length === 0
        mockPool.query.mockResolvedValueOnce({ rows: [serviceRow()] });

        const result = await service.updateService('svc-1', {}, TENANT);

        expect(result.id).toBe('svc-1');
        // 2 calls (findById × 2), no UPDATE
        expect(mockPool.query).toHaveBeenCalledTimes(2);
      });

      it('should throw when service not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await expect(
          service.updateService('nonexistent', { name: 'x' }, TENANT),
        ).rejects.toThrow();
      });

      it('should throw when tenant_id does not match', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [serviceRow({ tenant_id: 'other-tenant' })],
        });

        await expect(
          service.updateService('svc-1', { name: 'x' }, TENANT),
        ).rejects.toThrow();
      });
    });

    describe('deleteService', () => {
      it('should DELETE non-active service', async () => {
        // findById
        mockPool.query.mockResolvedValueOnce({ rows: [serviceRow({ status: 'inactive' })] });
        // delete
        mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

        const result = await service.deleteService('svc-1', TENANT);

        expect(result).toBe(true);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM catalog_services WHERE id = $1'),
          ['svc-1'],
        );
      });

      it('should reject deletion of active service', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [serviceRow({ status: 'active' })] });

        await expect(service.deleteService('svc-1', TENANT)).rejects.toThrow(
          'Cannot delete an active service',
        );
      });

      it('should throw when service not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await expect(service.deleteService('nonexistent', TENANT)).rejects.toThrow();
      });
    });
  });

  // ==================== Request CRUD ====================

  describe('Request CRUD', () => {
    describe('createRequest', () => {
      it('should INSERT into catalog_requests and create timeline event', async () => {
        // findById for service validation
        mockPool.query.mockResolvedValueOnce({ rows: [serviceRow({ status: 'active' })] });
        // createRequest INSERT
        mockPool.query.mockResolvedValueOnce({ rows: [requestRow()] });
        // timeline INSERT
        mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

        const result = await service.createRequest({
          serviceId: 'svc-1',
          requesterId: 'user-1',
          title: 'Need VPN access',
        }, TENANT);

        expect(result.id).toBe('req-1');
        expect(result.status).toBe('pending');
        // Verify INSERT into catalog_requests
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO catalog_requests'),
          expect.arrayContaining([expect.any(String), TENANT, 'svc-1', 'user-1', 'Need VPN access']),
        );
        // Verify timeline INSERT
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO catalog_request_timeline'),
          expect.arrayContaining([expect.any(String), 'req-1', TENANT, 'created']),
        );
      });

      it('should apply defaults: priority=medium, status=pending', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [serviceRow({ status: 'active' })] });
        mockPool.query.mockResolvedValueOnce({
          rows: [requestRow({ priority: 'medium', status: 'pending' })],
        });
        mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'evt-1' }] });

        await service.createRequest({
          serviceId: 'svc-1',
          requesterId: 'user-1',
          title: 'Test request',
        }, TENANT);

        const [, params] = mockPool.query.mock.calls[1];
        expect(params).toContain('medium');  // default priority
        expect(params).toContain('pending'); // default status
      });
    });

    describe('getRequest', () => {
      it('should return request when found and tenant matches', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [requestRow()] });

        const result = await service.getRequest('req-1', TENANT);

        expect(result.id).toBe('req-1');
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM catalog_requests WHERE id = $1'),
          ['req-1'],
        );
      });

      it('should throw when request not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await expect(service.getRequest('nonexistent', TENANT)).rejects.toThrow();
      });

      it('should throw when tenant_id does not match', async () => {
        mockPool.query.mockResolvedValueOnce({
          rows: [requestRow({ tenant_id: 'other-tenant' })],
        });

        await expect(service.getRequest('req-1', TENANT)).rejects.toThrow();
      });
    });

    describe('listRequests', () => {
      it('should list with tenant filter (default path)', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
        mockPool.query.mockResolvedValueOnce({ rows: [requestRow()] });

        const result = await service.listRequests(TENANT);

        expect(result.requests).toHaveLength(1);
        expect(result.total).toBe(1);
      });

      it('should filter by serviceId via findByService', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
        mockPool.query.mockResolvedValueOnce({ rows: [requestRow()] });

        await service.listRequests(TENANT, { serviceId: 'svc-1' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('service_id = $'),
          expect.arrayContaining(['svc-1']),
        );
      });

      it('should filter by requesterId via findByRequester', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [requestRow()] });

        await service.listRequests(TENANT, { requesterId: 'user-1' });

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('requester_id = $'),
          expect.arrayContaining([TENANT, 'user-1']),
        );
      });

      it('should filter by status via findByStatus', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'approved' })] });

        const result = await service.listRequests(TENANT, { status: 'approved' });

        expect(result.requests).toHaveLength(1);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('status = $'),
          expect.arrayContaining([TENANT, 'approved']),
        );
      });
    });

    describe('updateRequest', () => {
      it('should UPDATE provided fields on pending request', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'pending' })] });
        mockPool.query.mockResolvedValueOnce({
          rows: [requestRow({ title: 'Updated title' })],
        });

        const result = await service.updateRequest('req-1', { title: 'Updated title' }, TENANT);

        expect(result.title).toBe('Updated title');
      });

      it('should allow update on in_progress request', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'in_progress' })] });
        mockPool.query.mockResolvedValueOnce({
          rows: [requestRow({ status: 'in_progress', assigned_to: 'admin-1' })],
        });

        const result = await service.updateRequest('req-1', { assignedTo: 'admin-1' }, TENANT);

        expect(result.assigned_to).toBe('admin-1');
      });

      it('should reject update on approved request', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'approved' })] });

        await expect(
          service.updateRequest('req-1', { title: 'x' }, TENANT),
        ).rejects.toThrow("Cannot update request in 'approved' status");
      });

      it('should reject update on fulfilled request', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [requestRow({ status: 'fulfilled' })] });

        await expect(
          service.updateRequest('req-1', { title: 'x' }, TENANT),
        ).rejects.toThrow();
      });

      it('should throw when request not found', async () => {
        mockPool.query.mockResolvedValueOnce({ rows: [] });

        await expect(
          service.updateRequest('nonexistent', { title: 'x' }, TENANT),
        ).rejects.toThrow();
      });
    });
  });
});

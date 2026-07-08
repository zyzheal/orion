/**
 * ServiceRegistryRepository Tests
 */
jest.mock('../../db/tenant-context-storage', () => ({
  getCurrentTenantId: () => 'test-tenant',
  getCurrentTraceId: () => 'test-trace-123',
}));

import { ServiceRegistryRepository } from '../ServiceRegistryRepository';

const mockQuery = jest.fn();

describe('ServiceRegistryRepository', () => {
  let repo: ServiceRegistryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ServiceRegistryRepository({ query: mockQuery } as any);
  });

  // ==================== CRUD ====================

  describe('register', () => {
    it('should register a new service with auto-generated id', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'svc-123', tenant_id: 'test-tenant', service_id: 'svc-1', service_name: 'test', service_url: 'http://test', protocol: 'http', version: '1.0.0', status: 'registered', health_status: 'unknown', last_heartbeat_at: null, metadata: {}, registered_at: new Date(), deregistered_at: null, updated_at: new Date() }],
        rowCount: 1,
      });
      const result = await repo.register({ serviceId: 'svc-1', serviceName: 'test', serviceUrl: 'http://test' });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO service_registry'),
        expect.arrayContaining([expect.stringContaining('svc-'), 'test-tenant', 'svc-1']),
      );
      expect(result.serviceId).toBe('svc-1');
    });

    it('should register with custom protocol and metadata', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'svc-123', tenant_id: 'test-tenant', service_id: 'svc-1', service_name: 'test', service_url: 'http://test', protocol: 'grpc', version: '2.0.0', status: 'registered', health_status: 'unknown', last_heartbeat_at: null, metadata: { region: 'us' }, registered_at: new Date(), deregistered_at: null, updated_at: new Date() }],
        rowCount: 1,
      });
      const result = await repo.register({
        serviceId: 'svc-1',
        serviceName: 'test',
        serviceUrl: 'http://test',
        protocol: 'grpc',
        version: '2.0.0',
        metadata: { region: 'us' },
      });
      expect(result.protocol).toBe('grpc');
      expect(result.metadata).toEqual({ region: 'us' });
    });
  });

  describe('deregister', () => {
    it('should deregister an existing service', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
      await repo.deregister('svc-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE service_registry'),
        ['svc-1', 'test-tenant'],
      );
    });

    it('should throw NOT_FOUND for non-existent service', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await expect(repo.deregister('non-existent')).rejects.toThrow('Service not found');
    });
  });

  // ==================== Queries ====================

  describe('findById', () => {
    it('should find service by internal id', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'svc-123', tenant_id: 'test-tenant', service_id: 'svc-1', service_name: 'test', service_url: 'http://test', protocol: 'http', version: '1.0.0', status: 'registered', health_status: 'healthy', last_heartbeat_at: new Date(), metadata: {}, registered_at: new Date(), deregistered_at: null, updated_at: new Date() }],
        rowCount: 1,
      });
      const result = await repo.findById('svc-123');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND tenant_id = $2'),
        ['svc-123', 'test-tenant'],
      );
      expect(result?.id).toBe('svc-123');
    });

    it('should return undefined if not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const result = await repo.findById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('findByServiceId', () => {
    it('should find service by service_id', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'svc-123', tenant_id: 'test-tenant', service_id: 'svc-1', service_name: 'test', service_url: 'http://test', protocol: 'http', version: '1.0.0', status: 'registered', health_status: 'healthy', last_heartbeat_at: new Date(), metadata: {}, registered_at: new Date(), deregistered_at: null, updated_at: new Date() }],
        rowCount: 1,
      });
      const result = await repo.findByServiceId('svc-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE service_id = $1 AND tenant_id = $2'),
        ['svc-1', 'test-tenant'],
      );
      expect(result?.serviceId).toBe('svc-1');
    });
  });

  describe('findByTenantId', () => {
    it('should find all services for a tenant', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { id: 'svc-1', tenant_id: 'tenant-1', service_id: 'svc-1', service_name: 'test', service_url: 'http://test', protocol: 'http', version: '1.0.0', status: 'registered', health_status: 'healthy', last_heartbeat_at: new Date(), metadata: {}, registered_at: new Date(), deregistered_at: null, updated_at: new Date() },
        ],
        rowCount: 1,
      });
      const result = await repo.findByTenantId('tenant-1', 10, 0);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        ['tenant-1', 10, 0],
      );
      expect(result.length).toBe(1);
    });
  });

  describe('findAll', () => {
    it('should find all services across tenants', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { id: 'svc-1', tenant_id: 'tenant-1', service_id: 'svc-1', service_name: 'test', service_url: 'http://test', protocol: 'http', version: '1.0.0', status: 'registered', health_status: 'healthy', last_heartbeat_at: new Date(), metadata: {}, registered_at: new Date(), deregistered_at: null, updated_at: new Date() },
        ],
        rowCount: 1,
      });
      const result = await repo.findAll({ limit: 50, offset: 0 });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY updated_at DESC'),
        [50, 0],
      );
      expect(result.entities.length).toBe(1);
    });
  });

  // ==================== Health ====================

  describe('updateHealth', () => {
    it('should update health status and last heartbeat', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'svc-123', tenant_id: 'test-tenant', service_id: 'svc-1', service_name: 'test', service_url: 'http://test', protocol: 'http', version: '1.0.0', status: 'registered', health_status: 'healthy', last_heartbeat_at: new Date(), metadata: {}, registered_at: new Date(), deregistered_at: null, updated_at: new Date() }],
        rowCount: 1,
      });
      const result = await repo.updateHealth('svc-1', 'healthy');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET health_status = $1, last_heartbeat_at = $2'),
        ['healthy', expect.any(Date), expect.any(Date), 'svc-1', 'test-tenant'],
      );
      expect(result.healthStatus).toBe('healthy');
    });

    it('should throw NOT_FOUND for non-existent service', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await expect(repo.updateHealth('non-existent', 'healthy')).rejects.toThrow('Service not found');
    });
  });

  describe('findHealthy', () => {
    it('should find all healthy registered services', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { id: 'svc-1', tenant_id: 'test-tenant', service_id: 'svc-1', service_name: 'test', service_url: 'http://test', protocol: 'http', version: '1.0.0', status: 'registered', health_status: 'healthy', last_heartbeat_at: new Date(), metadata: {}, registered_at: new Date(), deregistered_at: null, updated_at: new Date() },
        ],
        rowCount: 1,
      });
      const result = await repo.findHealthy();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("health_status = 'healthy' AND status = 'registered'"),
        ['test-tenant'],
      );
      expect(result.length).toBe(1);
    });

    it('should accept custom tenant id', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await repo.findHealthy('custom-tenant');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['custom-tenant'],
      );
    });
  });

  describe('findUnhealthy', () => {
    it('should find unhealthy and degraded services', async () => {
      mockQuery.mockResolvedValue({
        rows: [
          { id: 'svc-1', tenant_id: 'test-tenant', service_id: 'svc-1', service_name: 'test', service_url: 'http://test', protocol: 'http', version: '1.0.0', status: 'registered', health_status: 'unhealthy', last_heartbeat_at: new Date(), metadata: {}, registered_at: new Date(), deregistered_at: null, updated_at: new Date() },
        ],
        rowCount: 1,
      });
      const result = await repo.findUnhealthy();
      expect(result.length).toBe(1);
      expect(result[0].healthStatus).toBe('unhealthy');
    });
  });

  // ==================== Metadata ====================

  describe('updateMetadata', () => {
    it('should merge new metadata into existing metadata', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'svc-123', tenant_id: 'test-tenant', service_id: 'svc-1', service_name: 'test', service_url: 'http://test', protocol: 'http', version: '1.0.0', status: 'registered', health_status: 'healthy', last_heartbeat_at: new Date(), metadata: { region: 'us', env: 'staging' }, registered_at: new Date(), deregistered_at: null, updated_at: new Date() }],
        rowCount: 1,
      });
      const result = await repo.updateMetadata('svc-1', { env: 'staging' });
      expect(result.metadata).toEqual({ region: 'us', env: 'staging' });
    });

    it('should throw NOT_FOUND for non-existent service', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await expect(repo.updateMetadata('non-existent', {})).rejects.toThrow('Service not found');
    });
  });

  // ==================== Tenant Isolation ====================

  describe('tenant isolation', () => {
    it('should filter by tenant_id on findById', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      await repo.findById('svc-123');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $2'),
        ['svc-123', 'test-tenant'],
      );
    });

    it('should filter by tenant_id on deregister', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
      await repo.deregister('svc-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $2'),
        ['svc-1', 'test-tenant'],
      );
    });

    it('should filter by tenant_id on updateHealth', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'svc-123', tenant_id: 'test-tenant', service_id: 'svc-1', service_name: 'test', service_url: 'http://test', protocol: 'http', version: '1.0.0', status: 'registered', health_status: 'healthy', last_heartbeat_at: new Date(), metadata: {}, registered_at: new Date(), deregistered_at: null, updated_at: new Date() }],
        rowCount: 1,
      });
      await repo.updateHealth('svc-1', 'healthy');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $5'),
        ['healthy', expect.any(Date), expect.any(Date), 'svc-1', 'test-tenant'],
      );
    });
  });
});

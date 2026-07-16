/**
 * Tests for TenantIsolationService
 */
import { TenantIsolationService } from '../TenantIsolationService';

describe('TenantIsolationService', () => {
  let service: TenantIsolationService;

  beforeEach(() => {
    service = new TenantIsolationService();
  });

  describe('validateFourLayers', () => {
    it('should pass all layers when tenant_id matches', async () => {
      const result = await service.validateFourLayers({
        tenantId: 1,
        request: { headers: { 'x-tenant-id': '1' } },
        service: 'test-service',
        repository: 'test-repo',
        databaseSession: { 'app.current_tenant_id': '1' },
      });

      expect(result.passed).toBe(true);
      expect(result.failedLayers).toEqual([]);
    });

    it('should fail API layer when tenant_id header missing', async () => {
      const result = await service.validateFourLayers({
        tenantId: 1,
        request: { headers: {} },
      });

      expect(result.apiLayer).toBe(false);
      expect(result.failedLayers).toContain('API');
    });

    it('should fail API layer when tenant_id header mismatches', async () => {
      const result = await service.validateFourLayers({
        tenantId: 1,
        request: { headers: { 'x-tenant-id': '2' } },
      });

      expect(result.apiLayer).toBe(false);
    });

    it('should pass all layers when service is disabled', async () => {
      service.disable();

      const result = await service.validateFourLayers({
        tenantId: 1,
        request: { headers: {} },
      });

      expect(result.passed).toBe(true);
      expect(result.apiLayer).toBe(true);
      expect(result.serviceLayer).toBe(true);
      expect(result.repositoryLayer).toBe(true);
      expect(result.databaseRLSLayer).toBe(true);
    });

    it('should emit isolation:failed event when validation fails', async () => {
      const events: any[] = [];
      service.on('isolation:failed', (event) => events.push(event));

      await service.validateFourLayers({
        tenantId: 1,
        request: { headers: {} },
      });

      expect(events.length).toBe(1);
    });

    it('should fail service layer when tenantId is 0', async () => {
      const result = await service.validateFourLayers({
        tenantId: 0,
        request: { headers: { 'x-tenant-id': '0' } },
      });

      expect(result.serviceLayer).toBe(false);
    });

    it('should fail database RLS layer when session mismatches', async () => {
      const result = await service.validateFourLayers({
        tenantId: 1,
        request: { headers: { 'x-tenant-id': '1' } },
        databaseSession: { 'app.current_tenant_id': '2' },
      });

      expect(result.databaseRLSLayer).toBe(false);
    });
  });

  describe('enable/disable', () => {
    it('should enable/disable service', () => {
      service.disable();
      expect(service.isEnabled()).toBe(false);

      service.enable();
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('validateResourceAccess', () => {
    it('should allow access when tenant IDs match', () => {
      expect(service.validateResourceAccess(1, 1)).toBe(true);
    });

    it('should deny access when tenant IDs mismatch', () => {
      expect(service.validateResourceAccess(1, 2)).toBe(false);
    });

    it('should allow system tenant to access all resources', () => {
      expect(service.validateResourceAccess(0, 1)).toBe(true);
    });

    it('should allow all access when disabled', () => {
      service.disable();
      expect(service.validateResourceAccess(1, 2)).toBe(true);
    });
  });
});

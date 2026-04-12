/**
 * TenantContext 单元测试
 */

import { TenantContext, TenantInfo } from '../TenantContext';

describe('TenantContext', () => {
  let tenantContext: TenantContext;

  beforeEach(() => {
    tenantContext = new TenantContext({ enabled: true, defaultTenantId: 0 });
  });

  afterEach(() => {
    tenantContext.clearTenant();
  });

  describe('extractTenantFromRequest', () => {
    it('should extract tenant from JWT user object', () => {
      const request = {
        headers: {},
        user: {
          tenant_id: 123,
          userId: 'user-001',
          roles: ['admin'],
        },
      };

      const tenant = tenantContext.extractTenantFromRequest(request);

      expect(tenant).toBeDefined();
      expect(tenant?.tenantId).toBe(123);
      expect(tenant?.userId).toBe('user-001');
      expect(tenant?.roles).toContain('admin');
    });

    it('should extract tenant from header', () => {
      const request = {
        headers: {
          'x-tenant-id': '456',
          'x-user-id': 'user-002',
        },
      };

      const tenant = tenantContext.extractTenantFromRequest(request);

      expect(tenant).toBeDefined();
      expect(tenant?.tenantId).toBe(456);
      expect(tenant?.userId).toBe('user-002');
    });

    it('should prioritize JWT user over header', () => {
      const request = {
        headers: {
          'x-tenant-id': '999',
        },
        user: {
          tenant_id: 100,
        },
      };

      const tenant = tenantContext.extractTenantFromRequest(request);

      expect(tenant?.tenantId).toBe(100);
    });

    it('should return default tenant when no tenant provided', () => {
      const request = {
        headers: {},
      };

      const tenant = tenantContext.extractTenantFromRequest(request);

      expect(tenant).toBeDefined();
      expect(tenant?.tenantId).toBe(0);
    });

    it('should return null when no tenant and no default', () => {
      tenantContext = new TenantContext({ enabled: true, defaultTenantId: -1 });
      const request = {
        headers: {},
      };

      const tenant = tenantContext.extractTenantFromRequest(request);

      expect(tenant).toBeNull();
    });

    it('should ignore invalid header value', () => {
      const request = {
        headers: {
          'x-tenant-id': 'invalid',
        },
      };

      const tenant = tenantContext.extractTenantFromRequest(request);

      expect(tenant?.tenantId).toBe(0);
    });
  });

  describe('setTenant and clearTenant', () => {
    it('should set tenant context', () => {
      const tenant: TenantInfo = {
        tenantId: 100,
        userId: 'user-001',
      };

      tenantContext.setTenant(tenant);

      expect(tenantContext.getCurrentTenant()).toEqual(tenant);
      expect(tenantContext.getCurrentTenantId()).toBe(100);
    });

    it('should emit tenant:set event', (done) => {
      tenantContext.on('tenant:set', (tenant: TenantInfo) => {
        expect(tenant.tenantId).toBe(200);
        done();
      });

      tenantContext.setTenant({ tenantId: 200 });
    });

    it('should clear tenant context', () => {
      tenantContext.setTenant({ tenantId: 100 });
      tenantContext.clearTenant();

      expect(tenantContext.getCurrentTenant()).toBeNull();
      expect(tenantContext.getCurrentTenantId()).toBe(0);
    });

    it('should emit tenant:clear event', (done) => {
      // Use a fresh instance to avoid interference from afterEach
      const freshContext = new TenantContext({ enabled: true, defaultTenantId: 0 });

      freshContext.on('tenant:clear', (previousTenant: TenantInfo | null) => {
        expect(previousTenant?.tenantId).toBe(100);
        done();
      });

      freshContext.setTenant({ tenantId: 100 });
      freshContext.clearTenant();
    });
  });

  describe('validateTenantAccess', () => {
    it('should allow access when tenant matches', () => {
      tenantContext.setTenant({ tenantId: 100 });

      expect(tenantContext.validateTenantAccess(100)).toBe(true);
    });

    it('should deny access when tenant does not match', () => {
      tenantContext.setTenant({ tenantId: 100 });

      expect(tenantContext.validateTenantAccess(200)).toBe(false);
    });

    it('should allow system tenant to access all resources', () => {
      tenantContext.setTenant({ tenantId: 0 });

      expect(tenantContext.validateTenantAccess(100)).toBe(true);
      expect(tenantContext.validateTenantAccess(200)).toBe(true);
    });

    it('should allow all when isolation disabled', () => {
      tenantContext = new TenantContext({ enabled: false });
      tenantContext.setTenant({ tenantId: 100 });

      expect(tenantContext.validateTenantAccess(200)).toBe(true);
    });
  });

  describe('SQL generation', () => {
    it('should generate session set SQL', () => {
      tenantContext.setTenant({ tenantId: 100 });

      const sql = tenantContext.generateSessionSetSQL();

      expect(sql).toContain('set_config');
      expect(sql).toContain('app.current_tenant');
      expect(sql).toContain('100');
      expect(sql).toContain('app.tenant_isolation');
    });

    it('should generate session clear SQL', () => {
      const sql = tenantContext.generateSessionClearSQL();

      expect(sql).toContain('set_config');
      expect(sql).toContain('app.current_tenant');
      expect(sql).toContain('app.tenant_isolation');
    });
  });

  describe('query helpers', () => {
    it('should create query params with tenant_id', () => {
      tenantContext.setTenant({ tenantId: 100 });

      const params = tenantContext.createQueryParams({ name: 'test' });

      expect(params.tenant_id).toBe(100);
      expect(params.name).toBe('test');
    });

    it('should add tenant condition to WHERE clause', () => {
      tenantContext.setTenant({ tenantId: 100 });

      const where = tenantContext.addTenantCondition('status = active');

      expect(where).toContain('status = active');
      expect(where).toContain('tenant_id = 100');
    });

    it('should create WHERE clause when empty', () => {
      tenantContext.setTenant({ tenantId: 100 });

      const where = tenantContext.addTenantCondition('');

      expect(where).toBe('tenant_id = 100');
    });
  });

  describe('parseFromJWT', () => {
    it('should parse tenant from JWT payload', () => {
      const payload = {
        tenant_id: 100,
        userId: 'user-001',
        roles: ['admin'],
      };

      const tenant = TenantContext.parseFromJWT(payload);

      expect(tenant?.tenantId).toBe(100);
      expect(tenant?.userId).toBe('user-001');
      expect(tenant?.roles).toContain('admin');
    });

    it('should use sub as userId if userId not present', () => {
      const payload = {
        tenant_id: 100,
        sub: 'user-sub-001',
      };

      const tenant = TenantContext.parseFromJWT(payload);

      expect(tenant?.userId).toBe('user-sub-001');
    });

    it('should return null when tenant_id not present', () => {
      const payload = {
        userId: 'user-001',
      };

      const tenant = TenantContext.parseFromJWT(payload);

      expect(tenant).toBeNull();
    });
  });
});
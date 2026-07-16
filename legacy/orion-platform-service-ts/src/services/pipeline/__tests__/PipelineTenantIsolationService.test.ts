/**
 * PipelineTenantIsolationService Unit Tests
 */

import { PipelineTenantIsolationService } from '../PipelineTenantIsolationService';
import { PipelineService } from '../PipelineService';

// Mock pino
jest.mock('pino', () => {
  return () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  });
});

function createMockPipelineService(overrides?: any) {
  return {
    getById: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  } as unknown as PipelineService;
}

describe('PipelineTenantIsolationService', () => {
  let service: PipelineTenantIsolationService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== extractTenantId ====================

  describe('extractTenantId', () => {
    it('should extract tenant ID from x-tenant-id header', () => {
      const result = PipelineTenantIsolationService.extractTenantId({
        'x-tenant-id': 'tenant-1',
      });

      expect(result).toBe('tenant-1');
    });

    it('should return empty string when header is missing', () => {
      const result = PipelineTenantIsolationService.extractTenantId({});

      expect(result).toBe('');
    });

    it('should return empty string when header is undefined', () => {
      const result = PipelineTenantIsolationService.extractTenantId({
        'x-tenant-id': undefined,
      });

      expect(result).toBe('');
    });
  });

  // ==================== validatePipelineTenant ====================

  describe('validatePipelineTenant', () => {
    it('should skip validation when no tenantId (backward compatibility)', async () => {
      service = new PipelineTenantIsolationService();

      const result = await service.validatePipelineTenant('p-1', '');

      expect(result.valid).toBe(true);
    });

    it('should skip validation and return pipeline when no tenantId but pipeline exists', async () => {
      const mockPipelineService = createMockPipelineService({
        getById: jest.fn().mockResolvedValue({ id: 'p-1', tenant_id: 't-1' }),
      });
      service = new PipelineTenantIsolationService(mockPipelineService);

      const result = await service.validatePipelineTenant('p-1', '');

      expect(result.valid).toBe(true);
      expect(result.pipeline).toBeDefined();
    });

    it('should return invalid when pipeline not found (no tenantId)', async () => {
      const mockPipelineService = createMockPipelineService({
        getById: jest.fn().mockResolvedValue(null),
      });
      service = new PipelineTenantIsolationService(mockPipelineService);

      const result = await service.validatePipelineTenant('nonexistent', '');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should allow when no pipelineService and no tenantId', async () => {
      service = new PipelineTenantIsolationService(null);

      const result = await service.validatePipelineTenant('p-1', '');

      expect(result.valid).toBe(true);
    });

    it('should allow when no pipelineService but tenantId provided', async () => {
      service = new PipelineTenantIsolationService(null);

      const result = await service.validatePipelineTenant('p-1', 'tenant-1');

      expect(result.valid).toBe(true);
    });

    it('should return invalid when pipeline not found', async () => {
      const mockPipelineService = createMockPipelineService({
        getById: jest.fn().mockResolvedValue(null),
      });
      service = new PipelineTenantIsolationService(mockPipelineService);

      const result = await service.validatePipelineTenant('nonexistent', 'tenant-1');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return valid when tenant matches', async () => {
      const mockPipelineService = createMockPipelineService({
        getById: jest.fn().mockResolvedValue({ id: 'p-1', tenant_id: 'tenant-1' }),
      });
      service = new PipelineTenantIsolationService(mockPipelineService);

      const result = await service.validatePipelineTenant('p-1', 'tenant-1');

      expect(result.valid).toBe(true);
      expect(result.pipeline).toBeDefined();
    });

    it('should return invalid when tenant does not match', async () => {
      const mockPipelineService = createMockPipelineService({
        getById: jest.fn().mockResolvedValue({ id: 'p-1', tenant_id: 'tenant-1' }),
      });
      service = new PipelineTenantIsolationService(mockPipelineService);

      const result = await service.validatePipelineTenant('p-1', 'wrong-tenant');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Access denied');
    });

    it('should allow when pipeline has no tenant_id', async () => {
      const mockPipelineService = createMockPipelineService({
        getById: jest.fn().mockResolvedValue({ id: 'p-1' }),
      });
      service = new PipelineTenantIsolationService(mockPipelineService);

      const result = await service.validatePipelineTenant('p-1', 'tenant-1');

      expect(result.valid).toBe(true);
    });
  });

  // ==================== validateRunTenant ====================

  describe('validateRunTenant', () => {
    it('should return invalid when run is null', async () => {
      service = new PipelineTenantIsolationService();

      const result = await service.validateRunTenant(null, 'tenant-1');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Run not found');
    });

    it('should skip validation when no tenantId', async () => {
      service = new PipelineTenantIsolationService();

      const result = await service.validateRunTenant({ id: 'r-1' }, '');

      expect(result.valid).toBe(true);
    });

    it('should validate tenant from context.tenantId', async () => {
      service = new PipelineTenantIsolationService();

      const result = await service.validateRunTenant(
        { id: 'r-1', context: { tenantId: 'tenant-1' } },
        'tenant-1'
      );

      expect(result.valid).toBe(true);
    });

    it('should reject when context.tenantId does not match', async () => {
      service = new PipelineTenantIsolationService();

      const result = await service.validateRunTenant(
        { id: 'r-1', context: { tenantId: 'tenant-1' } },
        'wrong-tenant'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Access denied');
    });

    it('should validate tenant from tenant_id field', async () => {
      service = new PipelineTenantIsolationService();

      const result = await service.validateRunTenant(
        { id: 'r-1', tenant_id: 'tenant-1' },
        'tenant-1'
      );

      expect(result.valid).toBe(true);
    });

    it('should reject when tenant_id does not match', async () => {
      service = new PipelineTenantIsolationService();

      const result = await service.validateRunTenant(
        { id: 'r-1', tenant_id: 'tenant-1' },
        'wrong-tenant'
      );

      expect(result.valid).toBe(false);
    });

    it('should fall back to pipeline validation when run has no tenant', async () => {
      const mockPipelineService = createMockPipelineService({
        getById: jest.fn().mockResolvedValue({ id: 'p-1', tenant_id: 'tenant-1' }),
      });
      service = new PipelineTenantIsolationService(mockPipelineService);

      const result = await service.validateRunTenant(
        { id: 'r-1', pipelineId: 'p-1' },
        'tenant-1'
      );

      expect(result.valid).toBe(true);
    });

    it('should reject when pipeline validation fails', async () => {
      const mockPipelineService = createMockPipelineService({
        getById: jest.fn().mockResolvedValue(null),
      });
      service = new PipelineTenantIsolationService(mockPipelineService);

      const result = await service.validateRunTenant(
        { id: 'r-1', pipelineId: 'nonexistent' },
        'tenant-1'
      );

      expect(result.valid).toBe(false);
    });

    it('should allow when no tenantId and no pipelineId (legacy data)', async () => {
      service = new PipelineTenantIsolationService();

      const result = await service.validateRunTenant({ id: 'r-1' }, 'tenant-1');

      expect(result.valid).toBe(true);
    });
  });
});

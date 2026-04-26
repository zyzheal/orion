/**
 * TenantService Unit Tests
 */

import { TenantService, TenantServiceError, ListTenantsOptions, PaginatedResult } from '../TenantService';
import { TenantRepository, Tenant, CreateTenantInput } from '../TenantRepository';

// Mock repository
class MockTenantRepository {
  findById = jest.fn();
  findByName = jest.fn();
  findAll = jest.fn();
  create = jest.fn();
  update = jest.fn();
  delete = jest.fn();
  count = jest.fn();
  existsByName = jest.fn();
}

describe('TenantService', () => {
  let service: TenantService;
  let mockRepository: MockTenantRepository;

  beforeEach(() => {
    mockRepository = new MockTenantRepository();
    service = new TenantService(mockRepository as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTenant', () => {
    it('should return tenant when found', async () => {
      const mockTenant = { id: '1', name: 'test', status: 'active' } as Tenant;
      mockRepository.findById.mockResolvedValue(mockTenant);

      const result = await service.getTenant('1');
      
      expect(result).toEqual(mockTenant);
    });

    it('should throw error when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getTenant('nonexistent')).rejects.toThrow('Tenant not found: nonexistent');
      await expect(service.getTenant('nonexistent')).rejects.toThrow(TenantServiceError);
    });
  });

  describe('getTenantByName', () => {
    it('should return tenant by name', async () => {
      const mockTenant = { id: '1', name: 'test' } as Tenant;
      mockRepository.findByName.mockResolvedValue(mockTenant);

      const result = await service.getTenantByName('test');
      
      expect(result?.name).toBe('test');
    });

    it('should return null when not found', async () => {
      mockRepository.findByName.mockResolvedValue(null);

      const result = await service.getTenantByName('nonexistent');
      
      expect(result).toBeNull();
    });
  });

  describe('listTenants', () => {
    it('should return paginated tenants', async () => {
      const mockTenants = [{ id: '1', name: 't1' }, { id: '2', name: 't2' }] as Tenant[];
      mockRepository.findAll.mockResolvedValue(mockTenants);
      mockRepository.count.mockResolvedValue(2);

      const result = await service.listTenants({ page: 1, limit: 10 });
      
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should handle empty results', async () => {
      mockRepository.findAll.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(0);

      const result = await service.listTenants();
      
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should calculate total pages correctly', async () => {
      mockRepository.findAll.mockResolvedValue([]);
      mockRepository.count.mockResolvedValue(100);

      const result = await service.listTenants({ page: 1, limit: 10 });
      
      expect(result.totalPages).toBe(10);
    });
  });

  describe('createTenant', () => {
    it('should create tenant with valid data', async () => {
      const input: CreateTenantInput = { name: 'new-tenant', display_name: 'New Tenant' };
      const created = { id: '1', name: 'new-tenant', display_name: 'New Tenant', status: 'active' } as Tenant;
      mockRepository.existsByName.mockResolvedValue(false);
      mockRepository.create.mockResolvedValue(created);

      const result = await service.createTenant(input);
      
      expect(result.name).toBe('new-tenant');
      expect(mockRepository.create).toHaveBeenCalledWith({
        name: 'new-tenant',
        display_name: 'New Tenant',
      });
    });

    it('should lowercase tenant name', async () => {
      const input: CreateTenantInput = { name: 'NEW-TENANT' };
      mockRepository.existsByName.mockResolvedValue(false);
      mockRepository.create.mockResolvedValue({} as Tenant);

      await service.createTenant(input);
      
      expect(mockRepository.create).toHaveBeenCalledWith({
        name: 'new-tenant',
      });
    });

    it('should reject duplicate tenant name', async () => {
      mockRepository.existsByName.mockResolvedValue(true);

      await expect(service.createTenant({ name: 'existing' })).rejects.toThrow('Tenant name already exists');
    });

    it('should reject empty tenant name', async () => {
      await expect(service.createTenant({ name: '' })).rejects.toThrow('Tenant name is required');
    });

    it('should reject invalid name format', async () => {
      await expect(service.createTenant({ name: 'invalid name!' })).rejects.toThrow('Tenant name can only contain letters');
    });

    it('should reject whitespace-only name', async () => {
      await expect(service.createTenant({ name: '   ' })).rejects.toThrow('Tenant name is required');
    });
  });

  describe('updateTenant', () => {
    it('should update tenant', async () => {
      const existing = { id: '1', name: 'old-name' } as Tenant;
      const updated = { id: '1', name: 'old-name', display_name: 'New Name' } as Tenant;
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const result = await service.updateTenant('1', { display_name: 'New Name' });
      
      expect(result.display_name).toBe('New Name');
    });

    it('should throw error when tenant not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.updateTenant('nonexistent', {})).rejects.toThrow('Tenant not found');
    });

    it('should reject duplicate name change', async () => {
      const existing = { id: '1', name: 'tenant1' } as Tenant;
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.existsByName.mockResolvedValue(true);

      await expect(service.updateTenant('1', { name: 'tenant2' })).rejects.toThrow('Tenant name already exists');
    });
  });

  describe('deleteTenant', () => {
    it('should soft delete tenant', async () => {
      const existing = { id: '1', name: 'test' } as Tenant;
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.delete.mockResolvedValue(true);

      const result = await service.deleteTenant('1');
      
      expect(result).toBe(true);
    });

    it('should throw error when not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.deleteTenant('nonexistent')).rejects.toThrow('Tenant not found');
    });
  });
});
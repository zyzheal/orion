/**
 * TenantRepository Unit Tests
 */

import { TenantRepository, Tenant, CreateTenantInput, UpdateTenantInput } from '../TenantRepository';

// Mock DatabasePool
class MockDatabasePool {
  query = jest.fn();
}

describe('TenantRepository', () => {
  let repository: TenantRepository;
  let mockPool: MockDatabasePool;

  beforeEach(() => {
    mockPool = new MockDatabasePool();
    repository = new TenantRepository(mockPool as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return tenant when found', async () => {
      const mockTenant = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'acme-corp',
        display_name: 'Acme Corporation',
        status: 'active',
        settings: {},
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [mockTenant],
        rowCount: 1,
      });

      const result = await repository.findById('123e4567-e89b-12d3-a456-426614174000');
      
      expect(result).toEqual(mockTenant);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM tenants WHERE id = $1',
        ['123e4567-e89b-12d3-a456-426614174000']
      );
    });

    it('should return null when tenant not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await repository.findById('nonexistent-id');
      
      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should return tenant by name', async () => {
      const mockTenant = { id: '1', name: 'test-tenant', status: 'active' };
      
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [mockTenant],
        rowCount: 1,
      });

      const result = await repository.findByName('test-tenant');
      
      expect(result?.name).toBe('test-tenant');
    });
  });

  describe('findAll', () => {
    it('should return all active tenants', async () => {
      const mockTenants = [
        { id: '1', name: 'tenant1', status: 'active' },
        { id: '2', name: 'tenant2', status: 'active' },
      ];
      
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: mockTenants,
        rowCount: 2,
      });

      const result = await repository.findAll();
      
      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      await repository.findAll({ status: 'inactive' });
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['inactive']
      );
    });

    it('should apply pagination', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      await repository.findAll({ limit: 10, offset: 20 });
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $1 OFFSET $2'),
        [10, 20]
      );
    });
  });

  describe('count', () => {
    it('should return total count', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [{ count: '42' }],
        rowCount: 1,
      });

      const result = await repository.count();
      
      expect(result).toBe(42);
    });

    it('should filter by status', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [{ count: '10' }],
        rowCount: 1,
      });

      await repository.count('active');
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['active']
      );
    });
  });

  describe('create', () => {
    it('should insert tenant and return created record', async () => {
      const input: CreateTenantInput = {
        name: 'new-tenant',
        display_name: 'New Tenant',
        settings: { theme: 'dark' },
      };
      
      const createdTenant = {
        id: 'new-uuid',
        ...input,
        status: 'active',
        settings: { theme: 'dark' },
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [createdTenant],
        rowCount: 1,
      });

      const result = await repository.create(input);
      
      expect(result.name).toBe('new-tenant');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tenants'),
        expect.arrayContaining(['new-tenant', 'New Tenant'])
      );
    });
  });

  describe('update', () => {
    it('should update tenant and return updated record', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const input: UpdateTenantInput = { display_name: 'Updated Name' };
      const updatedTenant = {
        id,
        name: 'tenant1',
        display_name: 'Updated Name',
        status: 'active',
      };
      
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [updatedTenant],
        rowCount: 1,
      });

      const result = await repository.update(id, input);
      
      expect(result?.display_name).toBe('Updated Name');
    });

    it('should return original if no updates', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      const originalTenant = { id, name: 'tenant1' };
      
      (mockPool.query as jest.Mock).mockResolvedValueOnce({
        rows: [originalTenant],
        rowCount: 1,
      });

      const result = await repository.update(id, {});
      
      expect(result?.name).toBe('tenant1');
    });
  });

  describe('delete', () => {
    it('should soft delete tenant (update status)', async () => {
      const id = '123e4567-e89b-12d3-a456-426614174000';
      
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 1,
      });

      const result = await repository.delete(id);
      
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'deleted'"),
        [id]
      );
    });

    it('should return false when tenant not found', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await repository.delete('nonexistent');
      
      expect(result).toBe(false);
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete tenant', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 1,
      });

      await repository.hardDelete('123');
      
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM tenants'),
        ['123']
      );
    });
  });

  describe('existsByName', () => {
    it('should return true when tenant exists', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [1],
        rowCount: 1,
      });

      const result = await repository.existsByName('existing');
      
      expect(result).toBe(true);
    });

    it('should return false when tenant does not exist', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await repository.existsByName('nonexistent');
      
      expect(result).toBe(false);
    });
  });
});
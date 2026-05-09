/**
 * EnvironmentRepository 单元测试
 * GAP-CN-02: Tests CRUD operations for pipeline environments.
 */

import {
  EnvironmentRepository,
  type EnvironmentEntity,
} from '../EnvironmentRepository';

describe('EnvironmentRepository', () => {
  let repo: EnvironmentRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    repo = new EnvironmentRepository(mockDb);
  });

  // ==================== Create ====================

  describe('create', () => {
    test('should create an environment with all fields', async () => {
      const mockRow = {
        id: 'env-1',
        tenant_id: 'tenant-1',
        name: 'development',
        description: 'Dev environment',
        display_order: 0,
        variables: { NODE_ENV: 'development' },
        approval_required: false,
        approval_count: 1,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.create({
        id: 'env-1',
        tenantId: 'tenant-1',
        name: 'development',
        description: 'Dev environment',
        displayOrder: 0,
        variables: { NODE_ENV: 'development' },
        approvalRequired: false,
        approvalCount: 1,
      });

      expect(result.id).toBe('env-1');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.name).toBe('development');
      expect(result.variables).toEqual({ NODE_ENV: 'development' });
      expect(result.approvalRequired).toBe(false);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pipeline_environments'),
        expect.arrayContaining(['tenant-1', 'development']),
      );
    });

    test('should create environment without explicit id', async () => {
      const mockRow = {
        id: 'generated-id',
        tenant_id: 'tenant-1',
        name: 'staging',
        description: null,
        display_order: 1,
        variables: {},
        approval_required: true,
        approval_count: 1,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.create({
        tenantId: 'tenant-1',
        name: 'staging',
        description: null,
        displayOrder: 1,
        variables: {},
        approvalRequired: true,
        approvalCount: 1,
      });

      expect(result.id).toBe('generated-id');
    });

    test('should throw if insert returns no rows', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(repo.create({
        tenantId: 'tenant-1',
        name: 'production',
        description: null,
        displayOrder: 2,
        variables: {},
        approvalRequired: true,
        approvalCount: 2,
      })).rejects.toThrow('INSERT into pipeline_environments returned no rows');
    });
  });

  // ==================== findById ====================

  describe('findById', () => {
    test('should return environment by ID', async () => {
      const mockRow = {
        id: 'env-1',
        tenant_id: 'tenant-1',
        name: 'production',
        description: 'Production environment',
        display_order: 2,
        variables: { NODE_ENV: 'production', LOG_LEVEL: 'warn' },
        approval_required: true,
        approval_count: 2,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.findById('env-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('env-1');
      expect(result!.name).toBe('production');
      expect(result!.approvalRequired).toBe(true);
      expect(result!.approvalCount).toBe(2);
    });

    test('should return undefined for non-existent environment', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findById('non-existent');

      expect(result).toBeUndefined();
    });
  });

  // ==================== findByTenant ====================

  describe('findByTenant', () => {
    test('should return environments for a tenant ordered by display_order', async () => {
      const mockRows = [
        {
          id: 'env-dev',
          tenant_id: 'tenant-1',
          name: 'development',
          description: null,
          display_order: 0,
          variables: { NODE_ENV: 'development' },
          approval_required: false,
          approval_count: 1,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 'env-staging',
          tenant_id: 'tenant-1',
          name: 'staging',
          description: null,
          display_order: 1,
          variables: { NODE_ENV: 'staging' },
          approval_required: true,
          approval_count: 1,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
        },
        {
          id: 'env-prod',
          tenant_id: 'tenant-1',
          name: 'production',
          description: null,
          display_order: 2,
          variables: { NODE_ENV: 'production' },
          approval_required: true,
          approval_count: 2,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      mockDb.query.mockResolvedValue({ rows: mockRows });

      const result = await repo.findByTenant('tenant-1');

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('development');
      expect(result[0].displayOrder).toBe(0);
      expect(result[1].name).toBe('staging');
      expect(result[2].name).toBe('production');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1 ORDER BY display_order ASC'),
        ['tenant-1'],
      );
    });

    test('should return empty array for tenant with no environments', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findByTenant('tenant-empty');

      expect(result).toHaveLength(0);
    });
  });

  // ==================== findByTenantAndName ====================

  describe('findByTenantAndName', () => {
    test('should return environment by tenant and name', async () => {
      const mockRow = {
        id: 'env-prod',
        tenant_id: 'tenant-1',
        name: 'production',
        description: null,
        display_order: 2,
        variables: { NODE_ENV: 'production' },
        approval_required: true,
        approval_count: 2,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.findByTenantAndName('tenant-1', 'production');

      expect(result).toBeDefined();
      expect(result!.id).toBe('env-prod');
      expect(result!.name).toBe('production');
      expect(result!.tenantId).toBe('tenant-1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1 AND name = $2'),
        ['tenant-1', 'production'],
      );
    });

    test('should return undefined for non-existent tenant/name combination', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await repo.findByTenantAndName('tenant-1', 'nonexistent');

      expect(result).toBeUndefined();
    });
  });

  // ==================== Update (via BaseRepository) ====================

  describe('update', () => {
    test('should update environment fields', async () => {
      const mockRow = {
        id: 'env-1',
        tenant_id: 'tenant-1',
        name: 'development',
        description: 'Updated description',
        display_order: 0,
        variables: { NODE_ENV: 'development', LOG_LEVEL: 'debug' },
        approval_required: false,
        approval_count: 1,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-02T00:00:00Z'),
      };
      mockDb.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repo.update('env-1', {
        description: 'Updated description',
        variables: { NODE_ENV: 'development', LOG_LEVEL: 'debug' },
      });

      expect(result.description).toBe('Updated description');
      expect(result.variables).toEqual({ NODE_ENV: 'development', LOG_LEVEL: 'debug' });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pipeline_environments SET'),
        expect.any(Array),
      );
    });

    test('should throw if environment not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(repo.update('non-existent', { description: 'test' }))
        .rejects.toThrow('UPDATE on pipeline_environments affected no rows');
    });

    test('should throw if no columns to update', async () => {
      await expect(repo.update('env-1', {}))
        .rejects.toThrow('Update requires at least one column');
    });
  });

  // ==================== Delete ====================

  describe('delete', () => {
    test('should delete an environment', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 });

      const result = await repo.delete('env-1');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM pipeline_environments'),
        ['env-1'],
      );
    });

    test('should return false if environment not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await repo.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  // ==================== list (findAll) ====================

  describe('list (findAll)', () => {
    test('should list environments with pagination', async () => {
      const mockRows = [
        {
          id: 'env-1',
          tenant_id: 'tenant-1',
          name: 'development',
          description: null,
          display_order: 0,
          variables: {},
          approval_required: false,
          approval_count: 1,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z'),
        },
      ];
      mockDb.query
        .mockResolvedValueOnce({ rows: mockRows })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await repo.list({ limit: 10, offset: 0 });

      expect(result.entities).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ==================== mapRowToEntity ====================

  describe('mapRowToEntity', () => {
    test('should map row with null variables to empty object', () => {
      const row = {
        id: 'env-1',
        tenant_id: 'tenant-1',
        name: 'development',
        description: null,
        display_order: 0,
        variables: null,
        approval_required: false,
        approval_count: 1,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };

      const result = repo.mapRowToEntityPublic(row);

      expect(result.variables).toEqual({});
      expect(result.description).toBeNull();
    });

    test('should map row with null display_order to 0', () => {
      const row = {
        id: 'env-1',
        tenant_id: 'tenant-1',
        name: 'development',
        description: null,
        display_order: null,
        variables: {},
        approval_required: false,
        approval_count: 1,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };

      const result = repo.mapRowToEntityPublic(row);

      expect(result.displayOrder).toBe(0);
    });

    test('should map row with null approval_required to false', () => {
      const row = {
        id: 'env-1',
        tenant_id: 'tenant-1',
        name: 'development',
        description: null,
        display_order: 0,
        variables: {},
        approval_required: null,
        approval_count: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };

      const result = repo.mapRowToEntityPublic(row);

      expect(result.approvalRequired).toBe(false);
      expect(result.approvalCount).toBe(1);
    });

    test('should correctly map all snake_case to camelCase', () => {
      const row = {
        id: 'env-1',
        tenant_id: 'tenant-1',
        name: 'production',
        description: 'Prod',
        display_order: 2,
        variables: { KEY: 'value' },
        approval_required: true,
        approval_count: 3,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-02T00:00:00Z'),
      };

      const result = repo.mapRowToEntityPublic(row);

      expect(result.tenantId).toBe('tenant-1');
      expect(result.displayOrder).toBe(2);
      expect(result.approvalRequired).toBe(true);
      expect(result.approvalCount).toBe(3);
      expect(result.createdAt).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(result.updatedAt).toEqual(new Date('2024-01-02T00:00:00Z'));
    });
  });
});

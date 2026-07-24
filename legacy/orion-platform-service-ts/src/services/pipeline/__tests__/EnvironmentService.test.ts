/**
 * EnvironmentService 单元测试
 * GAP-CN-02: Tests CRUD, variable resolution, approval checks, and default environment creation.
 */

import { EnvironmentService } from '../EnvironmentService';
import { EnvironmentRepository, EnvironmentEntity } from '../../repositories/EnvironmentRepository';
import { mergeVariables } from '../../../models/Environment';

describe('EnvironmentService', () => {
  let service: EnvironmentService;
  let mockRepo: jest.Mocked<EnvironmentRepository>;

  const baseEntity: EnvironmentEntity = {
    id: 'env-1',
    tenantId: 'tenant-1',
    name: 'development',
    description: 'Dev environment',
    displayOrder: 0,
    variables: { NODE_ENV: 'development', LOG_LEVEL: 'debug' },
    approvalRequired: false,
    approvalCount: 1,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByTenant: jest.fn(),
      findByTenantAndName: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
      mapRowToEntityPublic: jest.fn(),
    } as unknown as jest.Mocked<EnvironmentRepository>;

    service = new EnvironmentService({ repository: mockRepo });
  });

  // ==================== CRUD Operations ====================

  describe('createEnvironment', () => {
    test('should create a new environment successfully', async () => {
      mockRepo.findByTenantAndName.mockResolvedValue(undefined);
      mockRepo.create.mockResolvedValue(baseEntity);

      const result = await service.createEnvironment({
        tenantId: 'tenant-1',
        name: 'development',
        description: 'Dev environment',
        order: 0,
        variables: { NODE_ENV: 'development' },
        approvalRequired: false,
        approvalCount: 1,
      });

      expect(result.id).toBe('env-1');
      expect(result.name).toBe('development');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'development',
          displayOrder: 0,
        }),
      );
    });

    test('should throw if environment name already exists for tenant', async () => {
      mockRepo.findByTenantAndName.mockResolvedValue(baseEntity);

      await expect(service.createEnvironment({
        tenantId: 'tenant-1',
        name: 'development',
      })).rejects.toThrow("Environment 'development' already exists for tenant 'tenant-1'");
    });

    test('should throw if approvalCount is less than 1', async () => {
      mockRepo.findByTenantAndName.mockResolvedValue(undefined);

      await expect(service.createEnvironment({
        tenantId: 'tenant-1',
        name: 'development',
        approvalCount: 0,
      })).rejects.toThrow('approvalCount must be at least 1');
    });

    test('should throw if environment name is empty', async () => {
      await expect(service.createEnvironment({
        tenantId: 'tenant-1',
        name: '',
      })).rejects.toThrow('Environment name cannot be empty');
    });

    test('should throw if environment name has invalid format', async () => {
      await expect(service.createEnvironment({
        tenantId: 'tenant-1',
        name: 'Invalid-Name',
      })).rejects.toThrow(/is invalid/);
    });

    test('should throw if environment name is too long', async () => {
      await expect(service.createEnvironment({
        tenantId: 'tenant-1',
        name: 'a'.repeat(65),
      })).rejects.toThrow(/is too long/);
    });

    test('should accept valid name with underscores', async () => {
      mockRepo.findByTenantAndName.mockResolvedValue(undefined);
      mockRepo.create.mockResolvedValue(baseEntity);

      const result = await service.createEnvironment({
        tenantId: 'tenant-1',
        name: 'pre_production_v2',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getEnvironment', () => {
    test('should return environment by ID', async () => {
      mockRepo.findById.mockResolvedValue(baseEntity);

      const result = await service.getEnvironment('env-1');

      expect(result).toEqual(baseEntity);
      expect(mockRepo.findById).toHaveBeenCalledWith('env-1');
    });

    test('should return undefined for non-existent ID', async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      const result = await service.getEnvironment('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('getEnvironmentByName', () => {
    test('should return environment by tenant and name', async () => {
      mockRepo.findByTenantAndName.mockResolvedValue(baseEntity);

      const result = await service.getEnvironmentByName('tenant-1', 'development');

      expect(result).toEqual(baseEntity);
      expect(mockRepo.findByTenantAndName).toHaveBeenCalledWith('tenant-1', 'development');
    });

    test('should return undefined for non-existent name', async () => {
      mockRepo.findByTenantAndName.mockResolvedValue(undefined);

      const result = await service.getEnvironmentByName('tenant-1', 'nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('listEnvironments', () => {
    test('should list all environments for a tenant', async () => {
      const envs: EnvironmentEntity[] = [
        { ...baseEntity, id: 'env-1', name: 'development', displayOrder: 0 },
        { ...baseEntity, id: 'env-2', name: 'staging', displayOrder: 1 },
        { ...baseEntity, id: 'env-3', name: 'production', displayOrder: 2 },
      ];
      mockRepo.findByTenant.mockResolvedValue(envs);

      const result = await service.listEnvironments('tenant-1');

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('development');
      expect(result[1].name).toBe('staging');
      expect(result[2].name).toBe('production');
    });

    test('should return empty array for tenant with no environments', async () => {
      mockRepo.findByTenant.mockResolvedValue([]);

      const result = await service.listEnvironments('tenant-empty');

      expect(result).toHaveLength(0);
    });
  });

  describe('updateEnvironment', () => {
    test('should update environment fields', async () => {
      mockRepo.findById.mockResolvedValue(baseEntity);
      mockRepo.update.mockResolvedValue({
        ...baseEntity,
        description: 'Updated description',
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      });

      const result = await service.updateEnvironment('env-1', {
        description: 'Updated description',
      });

      expect(result.description).toBe('Updated description');
      expect(mockRepo.update).toHaveBeenCalledWith(
        'env-1',
        expect.objectContaining({ description: 'Updated description' }),
      );
    });

    test('should throw if environment not found', async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(service.updateEnvironment('non-existent', {
        description: 'test',
      })).rejects.toThrow("Environment 'non-existent' not found");
    });

    test('should throw if approvalCount is less than 1', async () => {
      mockRepo.findById.mockResolvedValue(baseEntity);

      await expect(service.updateEnvironment('env-1', {
        approvalCount: 0,
      })).rejects.toThrow('approvalCount must be at least 1');
    });

    test('should update variables', async () => {
      mockRepo.findById.mockResolvedValue(baseEntity);
      mockRepo.update.mockResolvedValue({
        ...baseEntity,
        variables: { NODE_ENV: 'development', NEW_VAR: 'value' },
      });

      const result = await service.updateEnvironment('env-1', {
        variables: { NODE_ENV: 'development', NEW_VAR: 'value' },
      });

      expect(result.variables).toEqual({ NODE_ENV: 'development', NEW_VAR: 'value' });
    });

    test('should update approval settings', async () => {
      mockRepo.findById.mockResolvedValue(baseEntity);
      mockRepo.update.mockResolvedValue({
        ...baseEntity,
        approvalRequired: true,
        approvalCount: 3,
      });

      const result = await service.updateEnvironment('env-1', {
        approvalRequired: true,
        approvalCount: 3,
      });

      expect(result.approvalRequired).toBe(true);
      expect(result.approvalCount).toBe(3);
    });
  });

  describe('deleteEnvironment', () => {
    test('should delete an environment', async () => {
      mockRepo.delete.mockResolvedValue(true);

      const result = await service.deleteEnvironment('env-1');

      expect(result).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith('env-1');
    });

    test('should return false if environment not found', async () => {
      mockRepo.delete.mockResolvedValue(false);

      const result = await service.deleteEnvironment('non-existent');

      expect(result).toBe(false);
    });
  });

  // ==================== Variable Resolution ====================

  describe('resolveVariables', () => {
    test('should merge environment variables over pipeline variables', async () => {
      mockRepo.findByTenantAndName.mockResolvedValue({
        id: 'env-prod',
        tenantId: 'tenant-1',
        name: 'production',
        description: null,
        displayOrder: 2,
        variables: { NODE_ENV: 'production', DB_HOST: 'prod-db.example.com' },
        approvalRequired: false,
        approvalCount: 1,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });

      const result = await service.resolveVariables('tenant-1', 'production', {
        NODE_ENV: 'development',
        APP_NAME: 'my-app',
      });

      // Environment variables should override pipeline variables
      expect(result.variables).toEqual({
        APP_NAME: 'my-app',
        NODE_ENV: 'production',
        DB_HOST: 'prod-db.example.com',
      });
      expect(result.environment.name).toBe('production');
      expect(result.environment.approvalRequired).toBe(false);
    });

    test('should return pipeline variables only if environment not found', async () => {
      mockRepo.findByTenantAndName.mockResolvedValue(undefined);

      const result = await service.resolveVariables('tenant-1', 'nonexistent', {
        APP_NAME: 'my-app',
      });

      expect(result.variables).toEqual({ APP_NAME: 'my-app' });
      expect(result.environment.approvalRequired).toBe(false);
    });

    test('should handle empty pipeline variables', async () => {
      mockRepo.findByTenantAndName.mockResolvedValue({
        ...baseEntity,
        variables: { NODE_ENV: 'staging' },
      });

      const result = await service.resolveVariables('tenant-1', 'staging', {});

      expect(result.variables).toEqual({ NODE_ENV: 'staging' });
    });

    test('should handle empty environment variables', async () => {
      mockRepo.findByTenantAndName.mockResolvedValue({
        ...baseEntity,
        variables: {},
      });

      const result = await service.resolveVariables('tenant-1', 'development', {
        APP_NAME: 'my-app',
      });

      expect(result.variables).toEqual({ APP_NAME: 'my-app' });
    });
  });

  // ==================== Approval Checks ====================

  describe('checkApprovalRequired', () => {
    test('should return approval required for production', async () => {
      mockRepo.findByTenantAndName.mockResolvedValue({
        ...baseEntity,
        name: 'production',
        approvalRequired: true,
        approvalCount: 2,
      });

      const result = await service.checkApprovalRequired('tenant-1', 'production');

      expect(result.required).toBe(true);
      expect(result.approvalCount).toBe(2);
      expect(result.environmentFound).toBe(true);
    });

    test('should return no approval required for development', async () => {
      mockRepo.findByTenantAndName.mockResolvedValue({
        ...baseEntity,
        name: 'development',
        approvalRequired: false,
        approvalCount: 1,
      });

      const result = await service.checkApprovalRequired('tenant-1', 'development');

      expect(result.required).toBe(false);
      expect(result.approvalCount).toBe(1);
      expect(result.environmentFound).toBe(true);
    });

    test('should return environmentFound false for non-existent environment', async () => {
      mockRepo.findByTenantAndName.mockResolvedValue(undefined);

      const result = await service.checkApprovalRequired('tenant-1', 'nonexistent');

      expect(result.required).toBe(false);
      expect(result.approvalCount).toBe(0);
      expect(result.environmentFound).toBe(false);
    });
  });

  // ==================== Default Environments ====================

  describe('createDefaultEnvironments', () => {
    test('should create three default environments', async () => {
      mockRepo.findByTenantAndName
        .mockResolvedValueOnce(undefined)  // development
        .mockResolvedValueOnce(undefined)  // staging
        .mockResolvedValueOnce(undefined); // production
      mockRepo.create
        .mockResolvedValueOnce({ ...baseEntity, name: 'development', displayOrder: 0 })
        .mockResolvedValueOnce({ ...baseEntity, name: 'staging', displayOrder: 1 })
        .mockResolvedValueOnce({ ...baseEntity, name: 'production', displayOrder: 2 });

      const result = await service.createDefaultEnvironments('tenant-new');

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('development');
      expect(result[1].name).toBe('staging');
      expect(result[2].name).toBe('production');

      // Verify development has no approval required
      expect(mockRepo.create).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          name: 'development',
          approvalRequired: false,
        }),
      );

      // Verify production requires 2 approvals
      expect(mockRepo.create).toHaveBeenNthCalledWith(3,
        expect.objectContaining({
          name: 'production',
          approvalRequired: true,
          approvalCount: 2,
        }),
      );
    });

    test('should skip environments that already exist (idempotent)', async () => {
      // dev: not found -> create succeeds
      // staging: already exists -> createEnvironment throws internally, caught
      // production: not found -> create succeeds
      mockRepo.findByTenantAndName
        .mockResolvedValueOnce(undefined)     // development - not exists
        .mockResolvedValueOnce(baseEntity)    // staging - already exists
        .mockResolvedValueOnce(undefined);    // production - not exists
      mockRepo.create
        .mockResolvedValueOnce({ ...baseEntity, name: 'development', displayOrder: 0 })
        .mockResolvedValueOnce({ ...baseEntity, name: 'production', displayOrder: 2 });

      const result = await service.createDefaultEnvironments('tenant-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('development');
      expect(result[1].name).toBe('production');
    });
  });

  // ==================== mergeVariables (model function) ====================

  describe('mergeVariables', () => {
    test('should let environment vars override pipeline vars', () => {
      const pipelineVars = { NODE_ENV: 'development', APP_NAME: 'my-app', VERSION: '1.0' };
      const envVars = { NODE_ENV: 'production', DB_HOST: 'prod-db' };

      const result = mergeVariables(pipelineVars, envVars);

      expect(result).toEqual({
        APP_NAME: 'my-app',
        VERSION: '1.0',
        NODE_ENV: 'production',
        DB_HOST: 'prod-db',
      });
    });

    test('should handle empty pipeline vars', () => {
      const result = mergeVariables({}, { KEY: 'value' });
      expect(result).toEqual({ KEY: 'value' });
    });

    test('should handle empty environment vars', () => {
      const result = mergeVariables({ KEY: 'value' }, {});
      expect(result).toEqual({ KEY: 'value' });
    });

    test('should handle both empty', () => {
      const result = mergeVariables({}, {});
      expect(result).toEqual({});
    });
  });
});

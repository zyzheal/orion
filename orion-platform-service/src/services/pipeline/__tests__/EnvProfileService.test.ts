/**
 * EnvProfileService Tests
 */

import { EnvProfileService, type EnvProfileServiceOptions } from '../EnvProfileService';

describe('EnvProfileService', () => {
  let mockDb: any;
  let service: EnvProfileService;

  beforeEach(() => {
    mockDb = { query: jest.fn() };
    const options: EnvProfileServiceOptions = { db: mockDb };
    service = new EnvProfileService(options);
  });

  // ==================== createProfile ====================

  describe('createProfile', () => {
    test('should create a profile with required fields', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // duplicate check
        .mockResolvedValueOnce({ rows: [{
          id: 'env-1', tenant_id: 't-1', name: 'default',
          environment: 'production', variables: { API_URL: 'https://api.example.com' },
          description: 'Production profile', created_at: new Date(), updated_at: new Date(),
        }], rowCount: 1 });

      const profile = await service.createProfile({
        tenantId: 't-1',
        name: 'default',
        environment: 'production',
        variables: { API_URL: 'https://api.example.com' },
        description: 'Production profile',
      });

      expect(profile.name).toBe('default');
      expect(profile.environment).toBe('production');
      expect(profile.variables).toEqual({ API_URL: 'https://api.example.com' });
      expect(profile.description).toBe('Production profile');
    });

    test('should create a profile with empty variables', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{
          id: 'env-2', tenant_id: 't-1', name: 'empty',
          environment: 'development', variables: {},
          description: null, created_at: new Date(), updated_at: new Date(),
        }], rowCount: 1 });

      const profile = await service.createProfile({
        tenantId: 't-1',
        name: 'empty',
        environment: 'development',
        variables: {},
      });

      expect(profile.variables).toEqual({});
    });

    test('should throw on duplicate profile', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{
        id: 'env-existing', tenant_id: 't-1', name: 'default',
        environment: 'production', variables: {},
        description: null, created_at: new Date(), updated_at: new Date(),
      }], rowCount: 1 });

      await expect(
        service.createProfile({
          tenantId: 't-1',
          name: 'default',
          environment: 'production',
          variables: {},
        })
      ).rejects.toThrow('DUPLICATE_PROFILE');
    });

    test('should throw without repository', async () => {
      const noDbService = new EnvProfileService();
      await expect(
        noDbService.createProfile({
          tenantId: 't-1',
          name: 'default',
          environment: 'production',
          variables: {},
        })
      ).rejects.toThrow('NO_REPOSITORY');
    });
  });

  // ==================== getProfile ====================

  describe('getProfile', () => {
    test('should get profile by name and environment', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{
        id: 'env-1', tenant_id: 't-1', name: 'default',
        environment: 'production', variables: { KEY: 'value' },
        description: null, created_at: new Date(), updated_at: new Date(),
      }], rowCount: 1 });

      const profile = await service.getProfile('t-1', 'default', 'production');
      expect(profile).not.toBeNull();
      expect(profile!.name).toBe('default');
      expect(profile!.variables).toEqual({ KEY: 'value' });
    });

    test('should return null when profile not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      const profile = await service.getProfile('t-1', 'nonexistent', 'dev');
      expect(profile).toBeNull();
    });
  });

  // ==================== findProfiles ====================

  describe('findProfiles', () => {
    test('should list profiles for tenant', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'env-1', tenant_id: 't-1', name: 'default',
        environment: 'production', variables: {},
        description: null, created_at: new Date(), updated_at: new Date(),
      }, {
        id: 'env-2', tenant_id: 't-1', name: 'default',
        environment: 'staging', variables: {},
        description: null, created_at: new Date(), updated_at: new Date(),
      }], rowCount: 2 });

      const profiles = await service.findProfiles({ tenantId: 't-1' });
      expect(profiles).toHaveLength(2);
      expect(profiles[0].name).toBe('default');
    });

    test('should filter by name', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'env-1', tenant_id: 't-1', name: 'default',
        environment: 'production', variables: {},
        description: null, created_at: new Date(), updated_at: new Date(),
      }], rowCount: 1 });

      const profiles = await service.findProfiles({ tenantId: 't-1', name: 'default' });
      expect(profiles).toHaveLength(1);
    });
  });

  // ==================== findEnvironmentsForProfile ====================

  describe('findEnvironmentsForProfile', () => {
    test('should return distinct environments for a profile', async () => {
      mockDb.query.mockResolvedValue({ rows: [
        { environment: 'development' },
        { environment: 'staging' },
        { environment: 'production' },
      ], rowCount: 3 });

      const envs = await service.findEnvironmentsForProfile('t-1', 'default');
      expect(envs).toEqual(['development', 'staging', 'production']);
    });
  });

  // ==================== resolveVariables ====================

  describe('resolveVariables', () => {
    test('should resolve variables from profile', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{
        id: 'env-1', tenant_id: 't-1', name: 'default',
        environment: 'production', variables: { API_URL: 'https://api.example.com', PORT: '8080' },
        description: null, created_at: new Date(), updated_at: new Date(),
      }], rowCount: 1 });

      const variables = await service.resolveVariables('t-1', 'default', 'production');
      expect(variables).toEqual({ API_URL: 'https://api.example.com', PORT: '8080' });
    });

    test('should merge overrides with profile variables', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{
        id: 'env-1', tenant_id: 't-1', name: 'default',
        environment: 'production', variables: { API_URL: 'https://old.example.com', PORT: '8080' },
        description: null, created_at: new Date(), updated_at: new Date(),
      }], rowCount: 1 });

      const variables = await service.resolveVariables(
        't-1', 'default', 'production',
        { API_URL: 'https://new.example.com' },
      );
      expect(variables).toEqual({ API_URL: 'https://new.example.com', PORT: '8080' });
    });

    test('should throw when profile not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(
        service.resolveVariables('t-1', 'nonexistent', 'dev')
      ).rejects.toThrow('PROFILE_NOT_FOUND');
    });
  });

  // ==================== updateProfile ====================

  describe('updateProfile', () => {
    test('should update profile variables', async () => {
      mockDb.query.mockResolvedValue({ rows: [{
        id: 'env-1', tenant_id: 't-1', name: 'default',
        environment: 'production', variables: { API_URL: 'https://new.example.com' },
        description: 'Updated', created_at: new Date(), updated_at: new Date(),
      }], rowCount: 1 });

      const profile = await service.updateProfile('env-1', {
        variables: { API_URL: 'https://new.example.com' },
        description: 'Updated',
      });

      expect(profile.variables).toEqual({ API_URL: 'https://new.example.com' });
      expect(profile.description).toBe('Updated');
    });
  });

  // ==================== deleteProfile ====================

  describe('deleteProfile', () => {
    test('should delete a profile', async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await expect(service.deleteProfile('env-1')).resolves.toBeUndefined();
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM env_profiles WHERE id = $1',
        ['env-1'],
      );
    });
  });
});

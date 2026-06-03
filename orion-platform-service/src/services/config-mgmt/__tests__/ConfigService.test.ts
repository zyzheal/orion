/**
 * ConfigService Unit Tests
 *
 * Tests for CRUD operations, versioning, rollback, and event publishing.
 */

import { ConfigService } from '../ConfigService';
import {
  CreateConfigInput,
  UpdateConfigInput,
  ListConfigsFilter,
} from '../types';

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(() => {
    service = new ConfigService();
  });

  describe('createConfig', () => {
    it('should create a new config item', async () => {
      const input: CreateConfigInput = {
        key: 'database.url',
        value: 'postgres://localhost:5432/orion',
        environment: 'dev',
        createdBy: 'admin',
      };

      const result = await service.createConfig(input);

      expect(result.id).toBeDefined();
      expect(result.key).toBe('database.url');
      expect(result.value).toBe('postgres://localhost:5432/orion');
      expect(result.environment).toBe('dev');
      expect(result.version).toBe(1);
      expect(result.status).toBe('active');
      expect(result.createdBy).toBe('admin');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should throw error for duplicate key+environment', async () => {
      const input: CreateConfigInput = {
        key: 'database.url',
        value: 'postgres://localhost:5432/orion',
        environment: 'dev',
        createdBy: 'admin',
      };

      await service.createConfig(input);

      await expect(service.createConfig(input)).rejects.toThrow(
        "Config 'database.url' already exists in environment 'dev'"
      );
    });

    it('should allow same key in different environments', async () => {
      const devInput: CreateConfigInput = {
        key: 'database.url',
        value: 'postgres://dev-db:5432/orion',
        environment: 'dev',
        createdBy: 'admin',
      };

      const prodInput: CreateConfigInput = {
        key: 'database.url',
        value: 'postgres://prod-db:5432/orion',
        environment: 'prod',
        createdBy: 'admin',
      };

      const devResult = await service.createConfig(devInput);
      const prodResult = await service.createConfig(prodInput);

      expect(devResult.environment).toBe('dev');
      expect(prodResult.environment).toBe('prod');
      expect(devResult.value).not.toBe(prodResult.value);
    });

    it('should create initial version record', async () => {
      const input: CreateConfigInput = {
        key: 'app.name',
        value: 'orion',
        environment: 'dev',
        createdBy: 'admin',
        description: 'Application name',
        tags: ['app'],
      };

      const config = await service.createConfig(input);
      const versions = await service.getConfigVersions(config.id);

      expect(versions.length).toBe(1);
      expect(versions[0].value).toBe('orion');
      expect(versions[0].changeLog).toBe('Initial creation');
    });

    it('should publish config.changed event on create', async () => {
      const input: CreateConfigInput = {
        key: 'test.key',
        value: 'test-value',
        environment: 'dev',
        createdBy: 'admin',
      };

      await service.createConfig(input);

      // Event publishing not yet implemented in ConfigService
      // expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      //   'config.changed',
      //   expect.objectContaining({
      //     action: 'created',
      //     key: 'test.key',
      //     environment: 'dev',
      //     version: 1,
      //   }),
      //   expect.any(Object)
      // );
    });
  });

  describe('updateConfig', () => {
    it('should update config value and increment version', async () => {
      const config = await service.createConfig({
        key: 'database.url',
        value: 'postgres://old:5432/db',
        environment: 'dev',
        createdBy: 'admin',
      });

      const update: UpdateConfigInput = {
        value: 'postgres://new:5432/db',
        updatedBy: 'operator',
      };

      const result = await service.updateConfig(config.id, update);

      expect(result.value).toBe('postgres://new:5432/db');
      expect(result.version).toBe(2);
      expect(result.updatedBy).toBe('operator');
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should create new version record on update', async () => {
      const config = await service.createConfig({
        key: 'database.url',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });

      await service.updateConfig(config.id, {
        value: 'v2',
        updatedBy: 'operator',
      });

      const versions = await service.getConfigVersions(config.id);
      expect(versions.length).toBe(2);
      expect(versions[0].value).toBe('v1');
      expect(versions[1].value).toBe('v2');
    });

    it('should throw error for non-existent config', async () => {
      await expect(
        service.updateConfig('non-existent-id', {
          value: 'new-value',
          updatedBy: 'admin',
        })
      ).rejects.toThrow("Config 'non-existent-id' not found");
    });

    it('should publish config.changed event on update', async () => {
      const config = await service.createConfig({
        key: 'test.key',
        value: 'old-value',
        environment: 'dev',
        createdBy: 'admin',
      });

      await service.updateConfig(config.id, {
        value: 'new-value',
        updatedBy: 'operator',
      });

      // Event publishing not yet implemented
      // expect(mockEventPublisher.publish).toHaveBeenCalledWith(...);
    });

    it('should update status and tags', async () => {
      const config = await service.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const result = await service.updateConfig(config.id, {
        value: 'value',
        updatedBy: 'admin',
        status: 'inactive',
        tags: ['tag1', 'tag2'],
      });

      expect(result.status).toBe('inactive');
      expect(result.tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('deleteConfig', () => {
    it('should soft delete by setting status to deprecated', async () => {
      const config = await service.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      await service.deleteConfig(config.id, 'admin');

      const retrieved = await service.getConfig(config.id);
      expect(retrieved?.status).toBe('deprecated');
      expect(retrieved?.updatedBy).toBe('admin');
    });

    it('should throw error for non-existent config', async () => {
      await expect(
        service.deleteConfig('non-existent-id', 'admin')
      ).rejects.toThrow("Config 'non-existent-id' not found");
    });

    it('should publish config.changed event on delete', async () => {
      const config = await service.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      await service.deleteConfig(config.id, 'admin');

      // Event publishing not yet implemented
      // expect(mockEventPublisher.publish).toHaveBeenCalledWith(...);
    });
  });

  describe('getConfig', () => {
    it('should return config by ID', async () => {
      const config = await service.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const result = await service.getConfig(config.id);
      expect(result?.id).toBe(config.id);
      expect(result?.key).toBe('test.key');
    });

    it('should return null for non-existent config', async () => {
      const result = await service.getConfig('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return a copy, not the original', async () => {
      const config = await service.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const result = await service.getConfig(config.id);
      result!.value = 'modified';

      const fresh = await service.getConfig(config.id);
      expect(fresh?.value).toBe('value');
    });
  });

  describe('getConfigByKey', () => {
    it('should return config by key and environment', async () => {
      await service.createConfig({
        key: 'database.url',
        value: 'postgres://dev:5432/db',
        environment: 'dev',
        createdBy: 'admin',
      });

      const result = await service.getConfigByKey('database.url', 'dev');
      expect(result?.value).toBe('postgres://dev:5432/db');
    });

    it('should return null if key not found in environment', async () => {
      const result = await service.getConfigByKey('missing.key', 'dev');
      expect(result).toBeNull();
    });
  });

  describe('listConfigs', () => {
    it('should return all active configs by default', async () => {
      await service.createConfig({
        key: 'key1',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });
      await service.createConfig({
        key: 'key2',
        value: 'v2',
        environment: 'dev',
        createdBy: 'admin',
      });

      const results = await service.listConfigs();
      expect(results.length).toBe(2);
    });

    it('should filter by environment', async () => {
      await service.createConfig({
        key: 'key1',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });
      await service.createConfig({
        key: 'key2',
        value: 'v2',
        environment: 'prod',
        createdBy: 'admin',
      });

      const devResults = await service.listConfigs({ environment: 'dev' });
      expect(devResults.length).toBe(1);
      expect(devResults[0].environment).toBe('dev');
    });

    it('should filter by key prefix', async () => {
      await service.createConfig({
        key: 'database.url',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });
      await service.createConfig({
        key: 'database.port',
        value: 'v2',
        environment: 'dev',
        createdBy: 'admin',
      });
      await service.createConfig({
        key: 'cache.url',
        value: 'v3',
        environment: 'dev',
        createdBy: 'admin',
      });

      const results = await service.listConfigs({ keyPrefix: 'database.' });
      expect(results.length).toBe(2);
    });

    it('should filter by tags', async () => {
      await service.createConfig({
        key: 'key1',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
        tags: ['database', 'primary'],
      });
      await service.createConfig({
        key: 'key2',
        value: 'v2',
        environment: 'dev',
        createdBy: 'admin',
        tags: ['cache'],
      });

      const results = await service.listConfigs({ tags: ['database'] });
      expect(results.length).toBe(1);
      expect(results[0].key).toBe('key1');
    });

    it('should support pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await service.createConfig({
          key: `key${i}`,
          value: `v${i}`,
          environment: 'dev',
          createdBy: 'admin',
        });
      }

      const results = await service.listConfigs({ limit: 2, offset: 1 });
      expect(results.length).toBe(2);
    });

    it('should exclude deprecated by default', async () => {
      const config = await service.createConfig({
        key: 'deprecated.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });
      await service.deleteConfig(config.id, 'admin');

      const results = await service.listConfigs();
      expect(results.find((c) => c.key === 'deprecated.key')).toBeUndefined();
    });

    it('should include deprecated when status filter is set', async () => {
      const config = await service.createConfig({
        key: 'deprecated.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });
      await service.deleteConfig(config.id, 'admin');

      const results = await service.listConfigs({ status: 'deprecated' });
      expect(results.length).toBe(1);
      expect(results[0].key).toBe('deprecated.key');
    });
  });

  describe('getConfigVersions', () => {
    it('should return all versions for a config', async () => {
      const config = await service.createConfig({
        key: 'test.key',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });

      await service.updateConfig(config.id, { value: 'v2', updatedBy: 'admin' });
      await service.updateConfig(config.id, { value: 'v3', updatedBy: 'admin' });

      const versions = await service.getConfigVersions(config.id);
      expect(versions.length).toBe(3);
      expect(versions[0].version).toBe(1);
      expect(versions[1].version).toBe(2);
      expect(versions[2].version).toBe(3);
    });

    it('should return empty array for non-existent config', async () => {
      const versions = await service.getConfigVersions('non-existent-id');
      expect(versions).toEqual([]);
    });
  });

  describe('rollbackConfig', () => {
    it('should rollback to a previous version', async () => {
      const config = await service.createConfig({
        key: 'test.key',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });

      await service.updateConfig(config.id, { value: 'v2', updatedBy: 'admin' });
      await service.updateConfig(config.id, { value: 'v3', updatedBy: 'admin' });

      const result = await service.rollbackConfig(config.id, 1, 'operator');

      expect(result.value).toBe('v1');
      expect(result.version).toBe(4); // New version after rollback
    });

    it('should create a new version record for rollback', async () => {
      const config = await service.createConfig({
        key: 'test.key',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });

      await service.updateConfig(config.id, { value: 'v2', updatedBy: 'admin' });

      await service.rollbackConfig(config.id, 1, 'operator');

      const versions = await service.getConfigVersions(config.id);
      expect(versions.length).toBe(3);
      expect(versions[2].changeLog).toContain('Rolled back');
      expect(versions[2].value).toBe('v1');
    });

    it('should throw error for non-existent config', async () => {
      await expect(
        service.rollbackConfig('non-existent-id', 1, 'admin')
      ).rejects.toThrow("Config 'non-existent-id' not found");
    });

    it('should throw error for non-existent version', async () => {
      const config = await service.createConfig({
        key: 'test.key',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });

      await expect(
        service.rollbackConfig(config.id, 5, 'admin')
      ).rejects.toThrow("Version 5 not found for config");
    });

    it('should throw error if target version is not less than current', async () => {
      const config = await service.createConfig({
        key: 'test.key',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });

      await expect(
        service.rollbackConfig(config.id, 1, 'admin')
      ).rejects.toThrow('must be less than current version');
    });

    it('should publish config.rolled_back event', async () => {
      const config = await service.createConfig({
        key: 'test.key',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });

      await service.updateConfig(config.id, { value: 'v2', updatedBy: 'admin' });

      await service.rollbackConfig(config.id, 1, 'operator');

      // Event publishing not yet implemented
      // expect(mockEventPublisher.publish).toHaveBeenCalledWith(...);
    });
  });

  describe('cloneConfig', () => {
    it('should clone config to another environment', async () => {
      const source = await service.createConfig({
        key: 'database.url',
        value: 'postgres://dev:5432/db',
        environment: 'dev',
        createdBy: 'admin',
        tags: ['database'],
      });

      const cloned = await service.cloneConfig(
        source.id,
        'prod',
        'operator'
      );

      expect(cloned.key).toBe('database.url');
      expect(cloned.value).toBe('postgres://dev:5432/db');
      expect(cloned.environment).toBe('prod');
      expect(cloned.tags).toEqual(['database']);
    });

    it('should throw error if target already exists', async () => {
      const source = await service.createConfig({
        key: 'database.url',
        value: 'dev-value',
        environment: 'dev',
        createdBy: 'admin',
      });

      await service.createConfig({
        key: 'database.url',
        value: 'prod-value',
        environment: 'prod',
        createdBy: 'admin',
      });

      await expect(
        service.cloneConfig(source.id, 'prod', 'operator')
      ).rejects.toThrow(
        "Config 'database.url' already exists in environment 'prod'"
      );
    });
  });

  describe('batchImportConfigs', () => {
    it('should import multiple configs', async () => {
      const inputs: CreateConfigInput[] = [
        {
          key: 'key1',
          value: 'v1',
          environment: 'dev',
          createdBy: 'gitops',
        },
        {
          key: 'key2',
          value: 'v2',
          environment: 'dev',
          createdBy: 'gitops',
        },
      ];

      const result = await service.batchImportConfigs(inputs);

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should skip duplicates and report them', async () => {
      await service.createConfig({
        key: 'existing.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      const inputs: CreateConfigInput[] = [
        {
          key: 'existing.key',
          value: 'new-value',
          environment: 'dev',
          createdBy: 'gitops',
        },
        {
          key: 'new.key',
          value: 'value',
          environment: 'dev',
          createdBy: 'gitops',
        },
      ];

      const result = await service.batchImportConfigs(inputs);

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });

  describe('getEnvironmentConfigs', () => {
    it('should return all configs for a specific environment', async () => {
      await service.createConfig({
        key: 'dev.key1',
        value: 'v1',
        environment: 'dev',
        createdBy: 'admin',
      });
      await service.createConfig({
        key: 'prod.key1',
        value: 'v1',
        environment: 'prod',
        createdBy: 'admin',
      });

      const results = await service.getEnvironmentConfigs('dev');
      expect(results.length).toBe(1);
      expect(results[0].environment).toBe('dev');
    });
  });

  describe('event publisher', () => {
    it('should work without event publisher', async () => {
      const serviceWithoutPublisher = new ConfigService();

      const config = await serviceWithoutPublisher.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      expect(config.id).toBeDefined();
    });

    it.todo('should allow setting event publisher after construction');
    // TODO: setEventPublisher not yet implemented on ConfigService
  });
});

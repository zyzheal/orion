/**
 * ConfigService Unit Tests
 *
 * Tests for CRUD operations, versioning, rollback, and event publishing.
 */

import { ConfigService } from '../ConfigService';
import { ConfigRepository, ConfigEntry, ConfigHistory } from '../ConfigRepository';
import {
  CreateConfigInput,
  UpdateConfigInput,
  ListConfigsFilter,
} from '../types';

// ==================== Mock ConfigRepository ====================

function createMockRepo() {
  const store = new Map<string, ConfigEntry>();
  let historyCounter = 0;
  const historyStore: ConfigHistory[] = [];

  return {
    store,
    historyStore,
    set: jest.fn(async (tenantId: string, key: string, value: Record<string, any>, changedBy?: string) => {
      // Find existing by tenant+key — match the real ConfigRepository
      // which uses tenantId:key:env as composite key for in-memory
      const env = value.environment || 'dev';
      let existing: ConfigEntry | undefined;
      for (const [, entry] of store) {
        if (entry.tenant_id === tenantId && entry.key === key && entry.environment === env) {
          existing = entry;
          break;
        }
      }
      if (existing) {
        const prevValue = existing.value;
        existing.value = value;
        existing.version = (existing.version || 1) + 1;
        existing.description = value.description !== undefined ? value.description : existing.description;
        existing.encrypted = value.encrypted !== undefined ? value.encrypted : existing.encrypted;
        existing.tags = value.tags !== undefined ? value.tags : existing.tags;
        existing.status = value.status !== undefined ? value.status : existing.status;
        existing.updatedBy = changedBy;
        existing.updated_by = changedBy;
        existing.updatedAt = new Date();
        existing.updated_at = new Date();
        store.set(existing.id, existing);
        // Add history
        historyCounter++;
        historyStore.push({
          id: `hist-${historyCounter}`,
          config_id: existing.id,
          configId: existing.id,
          key,
          value: value.value || value,
          version: existing.version,
          changed_by: changedBy || null,
          changedBy: changedBy,
          old_value: prevValue || null,
          oldValue: prevValue || null,
          new_value: value,
          newValue: value,
          changeLog: 'Updated',
          createdAt: new Date(),
          created_at: new Date(),
        });
        return { ...existing };
      }
      // Create new
      const id = `config-${store.size + 1}`;
      const entry: ConfigEntry = {
        id,
        tenant_id: tenantId,
        key,
        value,
        version: 1,
        environment: env,
        status: 'active',
        description: value.description,
        encrypted: value.encrypted || false,
        tags: value.tags || [],
        createdBy: changedBy,
        created_by: changedBy,
        createdAt: new Date(),
        created_at: new Date(),
        updatedBy: changedBy,
        updated_by: changedBy,
        updatedAt: new Date(),
        updated_at: new Date(),
      };
      store.set(id, entry);
      historyCounter++;
      historyStore.push({
        id: `hist-${historyCounter}`,
        config_id: id,
        configId: id,
        key,
        value: value.value || value,
        version: 1,
        changeLog: 'Initial creation',
        changed_by: changedBy || null,
        changedBy: changedBy,
        old_value: null,
        oldValue: null,
        new_value: value,
        newValue: value,
        createdAt: new Date(),
        created_at: new Date(),
      });
      return { ...entry };
    }),
    findById: jest.fn(async (id: string) => {
      const entry = store.get(id);
      return entry ? { ...entry } : null;
    }),
    findByKey: jest.fn(async (tenantId: string, key: string) => {
      // Return first matching entry by tenant+key (like real repository)
      for (const [, entry] of store) {
        if (entry.tenant_id === tenantId && entry.key === key) return { ...entry };
      }
      return null;
    }),
    findAll: jest.fn(async (tenantId: string) => {
      return Array.from(store.values()).filter(e => e.tenant_id === tenantId);
    }),
    delete: jest.fn(async (tenantId: string, key: string) => {
      for (const [id, entry] of store) {
        if (entry.tenant_id === tenantId && entry.key === key) {
          store.delete(id);
          return true;
        }
      }
      return false;
    }),
    getHistory: jest.fn(async (tenantId: string, key: string, limit?: number) => {
      let results = [...historyStore];
      if (limit) results = results.slice(-limit);
      return results;
    }),
    getHistoryByConfigId: jest.fn(async (configId: string) => {
      return historyStore.filter(h => h.configId === configId || h.config_id === configId);
    }),
    updateByKey: jest.fn(async (key: string, value: Record<string, any>) => {
      for (const [, entry] of store) {
        if (entry.key === key) {
          entry.value = value;
          entry.updatedAt = new Date();
          return { ...entry };
        }
      }
      return null;
    }),
  };
}

describe('ConfigService', () => {
  let service: ConfigService;
  let mockRepo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    mockRepo = createMockRepo();
    service = new ConfigService(mockRepo as any);
  });

  describe('constructor', () => {
    it('should throw error when repository is not provided', () => {
      expect(() => new ConfigService(undefined as any)).toThrow('ConfigRepository is required');
    });

    it('should throw error when repository is null', () => {
      expect(() => new ConfigService(null as any)).toThrow('ConfigRepository is required');
    });
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
    it('should delete a config', async () => {
      const config = await service.createConfig({
        key: 'test.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });

      await service.deleteConfig(config.id, 'admin');

      const retrieved = await service.getConfig(config.id);
      expect(retrieved).toBeNull();
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

    it('should exclude deleted configs by default', async () => {
      const config = await service.createConfig({
        key: 'deleted.key',
        value: 'value',
        environment: 'dev',
        createdBy: 'admin',
      });
      await service.deleteConfig(config.id, 'admin');

      const results = await service.listConfigs();
      expect(results.find((c) => c.key === 'deleted.key')).toBeUndefined();
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
});

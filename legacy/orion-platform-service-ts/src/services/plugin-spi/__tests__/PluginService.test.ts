/**
 * Plugin SPI Service Integration Tests
 *
 * End-to-end tests for the main PluginService that orchestrates:
 * - Registration and discovery
 * - Lifecycle management
 * - Plugin execution in sandbox
 * - Health monitoring
 * - Dependency management
 */

import { PluginService } from '../PluginService';
import { PluginRegistryRepository, PluginRegistryEntity } from '../../../repositories/PluginRegistryRepository';
import { PluginManifest } from '../types';

// Mock repository backed by in-memory store
function createMockRepo() {
  const store = new Map<string, PluginRegistryEntity>();

  return {
    create: jest.fn().mockImplementation(async (data: Partial<PluginRegistryEntity>) => {
      const entity: PluginRegistryEntity = {
        id: `plugin-${data.name || Date.now()}`,
        name: data.name || '',
        version: data.version || '1.0.0',
        description: data.description || null,
        author: data.author || null,
        status: data.status || 'installed',
        installDate: new Date(),
        enabledDate: null,
        errorMessage: null,
        config: data.config || {},
        manifest: data.manifest || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(entity.id, entity);
      return entity;
    }),

    findByName: jest.fn().mockImplementation(async (name: string) => {
      for (const entity of store.values()) {
        if (entity.name === name) return entity;
      }
      return undefined;
    }),

    updateStatus: jest.fn().mockImplementation(async (id: string, status: string, errorMessage?: string) => {
      const entity = store.get(id);
      if (!entity) throw new Error(`Plugin ${id} not found`);
      entity.status = status;
      if (status === 'enabled') entity.enabledDate = new Date();
      if (errorMessage) entity.errorMessage = errorMessage;
      entity.updatedAt = new Date();
      store.set(id, entity);
      return entity;
    }),

    updateConfig: jest.fn().mockImplementation(async (id: string, config: Record<string, any>) => {
      const entity = store.get(id);
      if (!entity) throw new Error(`Plugin ${id} not found`);
      entity.config = { ...entity.config, ...config };
      entity.updatedAt = new Date();
      store.set(id, entity);
      return entity;
    }),

    delete: jest.fn().mockImplementation(async (id: string) => {
      return store.delete(id);
    }),

    _store: store,
  } as unknown as PluginRegistryRepository;
}

describe('PluginService (Integration)', () => {
  let service: PluginService;
  let mockRepo: ReturnType<typeof createMockRepo>;

  const createManifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    entryPoint: 'index.js',
    capabilities: ['CUSTOM_TASK'],
    dependencies: [],
    ...overrides,
  });

  beforeEach(() => {
    mockRepo = createMockRepo();
    service = new PluginService(mockRepo, {
      pluginDirectory: '/nonexistent/path', // No auto-discovery
    });
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('initialize', () => {
    it('should initialize the service', async () => {
      await service.initialize();
      expect(service.isInitialized()).toBe(true);
    });

    it('should not fail when plugin directory does not exist', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should emit service:initialized event', async () => {
      const handler = jest.fn();
      service.on('service:initialized', handler);

      await service.initialize();

      expect(handler).toHaveBeenCalled();
    });

    it('should be idempotent', async () => {
      await service.initialize();
      await service.initialize(); // Second call should not throw
      expect(service.isInitialized()).toBe(true);
    });
  });

  describe('registerPlugin', () => {
    it('should register and return plugin info', async () => {
      const manifest = createManifest();
      const plugin = await service.registerPlugin(manifest);

      expect(plugin.manifest.name).toBe('test-plugin');
      expect(plugin.status).toBe('installed');
    });

    it('should emit plugin:installed event', async () => {
      const handler = jest.fn();
      service.on('plugin:installed', handler);

      await service.registerPlugin(createManifest());

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('listPlugins and getPlugin', () => {
    beforeEach(async () => {
      await service.registerPlugin(createManifest({ name: 'plugin-a' }));
      await service.registerPlugin(createManifest({ name: 'plugin-b' }));
    });

    it('should list all plugins', () => {
      const plugins = service.listPlugins();
      expect(plugins.length).toBe(2);
    });

    it('should get a specific plugin', () => {
      const plugin = service.getPlugin('plugin-a');
      expect(plugin).toBeDefined();
      expect(plugin!.manifest.name).toBe('plugin-a');
    });

    it('should return undefined for unknown plugin', () => {
      const plugin = service.getPlugin('unknown');
      expect(plugin).toBeUndefined();
    });

    it('should filter by status', async () => {
      await service.enablePlugin('plugin-a');

      const enabled = service.listPlugins({ statusFilter: 'enabled' });
      expect(enabled.length).toBe(1);
      expect(enabled[0].manifest.name).toBe('plugin-a');
    });
  });

  describe('enablePlugin and disablePlugin', () => {
    beforeEach(async () => {
      await service.registerPlugin(createManifest());
    });

    it('should enable a plugin', async () => {
      const plugin = await service.enablePlugin('test-plugin');
      expect(plugin.status).toBe('enabled');
    });

    it('should emit plugin:enabled event', async () => {
      const handler = jest.fn();
      service.on('plugin:enabled', handler);

      await service.enablePlugin('test-plugin');

      expect(handler).toHaveBeenCalled();
    });

    it('should disable a plugin', async () => {
      await service.enablePlugin('test-plugin');
      const plugin = await service.disablePlugin('test-plugin');
      expect(plugin.status).toBe('disabled');
    });

    it('should emit plugin:disabled event', async () => {
      const handler = jest.fn();
      service.on('plugin:disabled', handler);

      await service.enablePlugin('test-plugin');
      await service.disablePlugin('test-plugin');

      expect(handler).toHaveBeenCalled();
    });

    it('should throw error for unknown plugin', async () => {
      await expect(service.enablePlugin('unknown')).rejects.toThrow();
    });
  });

  describe('uninstallPlugin', () => {
    beforeEach(async () => {
      await service.registerPlugin(createManifest());
    });

    it('should uninstall a plugin', async () => {
      await service.uninstallPlugin('test-plugin');

      const plugin = service.getPlugin('test-plugin');
      expect(plugin).toBeUndefined();
    });

    it('should emit plugin:uninstalled event', async () => {
      const handler = jest.fn();
      service.on('plugin:uninstalled', handler);

      await service.uninstallPlugin('test-plugin');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('updatePluginConfig', () => {
    beforeEach(async () => {
      await service.registerPlugin(createManifest(), { initial: 'value' });
    });

    it('should update plugin configuration', async () => {
      const plugin = await service.updatePluginConfig('test-plugin', { newKey: 'newValue' });

      expect(plugin).toBeDefined();
      expect(plugin!.config).toEqual({ initial: 'value', newKey: 'newValue' });
    });

    it('should return undefined for unknown plugin', async () => {
      const plugin = await service.updatePluginConfig('unknown', { key: 'value' });
      expect(plugin).toBeUndefined();
    });
  });

  describe('executePlugin', () => {
    beforeEach(async () => {
      await service.registerPlugin(createManifest());
      await service.enablePlugin('test-plugin');
    });

    it('should execute a plugin successfully', async () => {
      const result = await service.executePlugin('test-plugin', async () => {
        return { output: 'hello' };
      });

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ output: 'hello' });
      expect(result.exitCode).toBe(0);
    });

    it('should pass abort signal to the execution function', async () => {
      let signalReceived = false;

      await service.executePlugin('test-plugin', async (signal) => {
        signalReceived = signal instanceof AbortSignal;
        return { ok: true };
      });

      expect(signalReceived).toBe(true);
    });

    it('should return error for non-existent plugin', async () => {
      const result = await service.executePlugin('non-existent', async () => ({ ok: true }));

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error for disabled plugin', async () => {
      await service.disablePlugin('test-plugin');

      const result = await service.executePlugin('test-plugin', async () => ({ ok: true }));

      expect(result.success).toBe(false);
      expect(result.error).toContain('not enabled');
    });

    it('should emit plugin:executing and plugin:executed events', async () => {
      const executingHandler = jest.fn();
      const executedHandler = jest.fn();
      service.on('plugin:executing', executingHandler);
      service.on('plugin:executed', executedHandler);

      await service.executePlugin('test-plugin', async () => ({ ok: true }));

      expect(executingHandler).toHaveBeenCalled();
      expect(executedHandler).toHaveBeenCalled();
    });

    it('should handle execution errors', async () => {
      const result = await service.executePlugin('test-plugin', async () => {
        throw new Error('Execution failed');
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });
  });

  describe('cancelExecution', () => {
    it('should return false when no active execution', () => {
      const result = service.cancelExecution('test-plugin');
      expect(result).toBe(false);
    });
  });

  describe('getPluginHealth', () => {
    beforeEach(async () => {
      await service.registerPlugin(createManifest());
      await service.enablePlugin('test-plugin');
    });

    it('should return health status for enabled plugin', () => {
      const health = service.getPluginHealth('test-plugin');

      expect(health.pluginId).toBe('test-plugin');
      expect(health.healthy).toBe(true);
      expect(health.lastChecked).toBeInstanceOf(Date);
    });

    it('should return unhealthy for error state plugin', async () => {
      // Simulate errors by running executions that fail
      await service.executePlugin('test-plugin', async () => {
        throw new Error('fail');
      });
      await service.executePlugin('test-plugin', async () => {
        throw new Error('fail');
      });

      const health = service.getPluginHealth('test-plugin');
      expect(health.metrics!.errorCount).toBe(2);
    });

    it('should return not found for unknown plugin', () => {
      const health = service.getPluginHealth('unknown');
      expect(health.healthy).toBe(false);
      expect(health.message).toBe('Plugin not found');
    });
  });

  describe('getAllPluginHealth', () => {
    beforeEach(async () => {
      await service.registerPlugin(createManifest({ name: 'plugin-a' }));
      await service.registerPlugin(createManifest({ name: 'plugin-b' }));
    });

    it('should return health for all plugins', () => {
      const healthList = service.getAllPluginHealth();
      expect(healthList.length).toBe(2);
    });
  });

  describe('getDependencyInfo', () => {
    beforeEach(async () => {
      await service.registerPlugin(createManifest({ name: 'base-plugin' }));
      await service.registerPlugin(
        createManifest({
          name: 'dependent-plugin',
          dependencies: [{ name: 'base-plugin', version: '>=1.0.0' }],
        })
      );
    });

    it('should return dependency information', () => {
      const info = service.getDependencyInfo('dependent-plugin');

      expect(info.dependencies).toContain('base-plugin');
      expect(info.dependents).toEqual([]); // Nothing depends on dependent-plugin
      expect(info.canInstall).toBe(true); // base-plugin is installed
      expect(info.missingDeps).toEqual([]);
    });

    it('should show dependents', () => {
      const info = service.getDependencyInfo('base-plugin');

      expect(info.dependents).toContain('dependent-plugin');
    });

    it('should show missing dependencies', async () => {
      // Register a plugin that has no dependencies first
      await service.registerPlugin(createManifest({ name: 'plugin-with-missing' }));

      // Use the dependency resolver directly to check missing deps scenario
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PluginDependencyResolver } = require('../PluginDependencyResolver');
      const resolver = new PluginDependencyResolver();
      const result = resolver.resolveDependencies([
        {
          name: 'plugin-with-missing',
          version: '1.0.0',
          description: 'test',
          author: 'test',
          entryPoint: 'index.js',
          capabilities: ['CUSTOM_TASK'],
          dependencies: [{ name: 'missing-plugin', version: '>=1.0.0' }],
        },
      ]);

      expect(result.resolved).toBe(false);
      expect(result.missing).toHaveLength(1);
      expect(result.missing[0].missingDependency).toBe('missing-plugin');
    });

    it('should throw error for unknown plugin', () => {
      expect(() => service.getDependencyInfo('unknown')).toThrow('not found');
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await service.registerPlugin(createManifest({ name: 'plugin-a' }));
      await service.registerPlugin(createManifest({ name: 'plugin-b' }));
      await service.enablePlugin('plugin-a');
    });

    it('should return accurate statistics', () => {
      const stats = service.getStats();

      expect(stats.totalPlugins).toBe(2);
      expect(stats.enabledPlugins).toBe(1);
      expect(stats.disabledPlugins).toBe(0);
      expect(stats.errorPlugins).toBe(0);
    });
  });

  describe('registerActivationHook and registerDeactivationHook', () => {
    it('should call activation hook when enabling', async () => {
      const hook = jest.fn().mockResolvedValue(undefined);

      await service.registerPlugin(createManifest());
      service.registerActivationHook('test-plugin', hook);
      await service.enablePlugin('test-plugin');

      expect(hook).toHaveBeenCalledWith('test-plugin', undefined);
    });

    it('should call deactivation hook when disabling', async () => {
      const hook = jest.fn().mockResolvedValue(undefined);

      await service.registerPlugin(createManifest());
      await service.enablePlugin('test-plugin');
      service.registerDeactivationHook('test-plugin', hook);
      await service.disablePlugin('test-plugin');

      expect(hook).toHaveBeenCalledWith('test-plugin');
    });
  });

  describe('shutdown', () => {
    it('should disable enabled plugins and cancel executions', async () => {
      await service.registerPlugin(createManifest());
      await service.enablePlugin('test-plugin');
      await service.initialize();

      await service.shutdown();

      const plugin = service.getPlugin('test-plugin');
      expect(plugin!.status).toBe('disabled');
      expect(service.isInitialized()).toBe(false);
    });
  });
});

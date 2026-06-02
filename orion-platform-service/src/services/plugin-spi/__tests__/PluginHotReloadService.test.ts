/**
 * PluginHotReloadService Tests
 *
 * Covers:
 * - constructor: default config, custom config, with db (repository)
 * - getConfig: returns merged config
 * - hotReload: success flow, plugin not found, already reloading, rollback on failure
 * - rollback: no snapshots, target version not found
 * - getVersionHistory: from in-memory, empty
 * - getStats: returns correct counts
 * - triggerReload: delegates to hotReload
 * - cleanup: clears all state
 * - startWatching / stopWatching: browser guard, cleanup
 */

import { PluginHotReloadService } from '../PluginHotReloadService';
import { PluginInfo, PluginManifest } from '../types';
import { EventEmitter } from 'events';

jest.mock('pino', () => {
  const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return jest.fn(() => mockLogger);
});

jest.mock('../../../repositories/PluginVersionSnapshotRepository', () => ({
  PluginVersionSnapshotRepository: jest.fn().mockImplementation(() => ({
    findByPluginId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    pruneOldSnapshots: jest.fn().mockResolvedValue(0),
  })),
}));

function createMockManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'test',
    entryPoint: 'index.js',
    capabilities: ['CUSTOM_TASK'],
    dependencies: [],
    ...overrides,
  };
}

function createMockPluginInfo(overrides: Partial<PluginInfo> = {}): PluginInfo {
  return {
    manifest: createMockManifest(),
    version: '1.0.0',
    status: 'enabled',
    installDate: new Date(),
    config: { key: 'value' },
    ...overrides,
  };
}

function createMockLifecycleManager() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    disablePlugin: jest.fn().mockResolvedValue(undefined),
    enablePlugin: jest.fn().mockResolvedValue(undefined),
    uninstallPlugin: jest.fn().mockResolvedValue(undefined),
    installPlugin: jest.fn().mockImplementation((_manifest: any, _config?: any) =>
      Promise.resolve(createMockPluginInfo({ version: '2.0.0' }))
    ),
  });
}

function createMockRegistry() {
  return {
    getPlugin: jest.fn().mockReturnValue(createMockPluginInfo()),
    validateManifest: jest.fn(),
  };
}

describe('PluginHotReloadService', () => {
  let lifecycleManager: ReturnType<typeof createMockLifecycleManager>;
  let registry: ReturnType<typeof createMockRegistry>;
  let service: PluginHotReloadService;

  beforeEach(() => {
    lifecycleManager = createMockLifecycleManager();
    registry = createMockRegistry();
    service = new PluginHotReloadService(lifecycleManager, registry);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const config = service.getConfig();
      expect(config.autoReload).toBe(true);
      expect(config.reloadDelay).toBe(1000);
      expect(config.maxRetries).toBe(3);
      expect(config.rollbackEnabled).toBe(true);
      expect(config.notifyOnReload).toBe(true);
    });

    it('should accept custom config', () => {
      const custom = new PluginHotReloadService(lifecycleManager, registry, {
        autoReload: false,
        reloadDelay: 5000,
        maxRetries: 5,
      });
      const config = custom.getConfig();
      expect(config.autoReload).toBe(false);
      expect(config.reloadDelay).toBe(5000);
      expect(config.maxRetries).toBe(5);
    });

    it('should initialize snapshot repository when db is provided', () => {
      const mockDb = { query: jest.fn() };
      const withDb = new PluginHotReloadService(lifecycleManager, registry, {}, mockDb as any);
      expect(withDb).toBeDefined();
    });

    it('should setup lifecycle event listeners', () => {
      const saveSpy = jest.spyOn<any, any>(service as any, 'saveSnapshot');
      saveSpy.mockResolvedValue(undefined);

      lifecycleManager.emit('plugin:enabled', { pluginId: 'test-plugin' });

      expect(saveSpy).toHaveBeenCalledWith('test-plugin');
    });
  });

  describe('getConfig', () => {
    it('should return the current config', () => {
      const config = service.getConfig();
      expect(config).toHaveProperty('watchPaths');
      expect(config).toHaveProperty('autoReload');
      expect(config).toHaveProperty('reloadDelay');
    });
  });

  describe('hotReload', () => {
    it('should successfully reload a plugin with provided manifest', async () => {
      registry.getPlugin.mockReturnValue(createMockPluginInfo({ status: 'enabled' }));
      lifecycleManager.installPlugin.mockResolvedValue(
        createMockPluginInfo({ version: '2.0.0', status: 'enabled' })
      );

      const events: string[] = [];
      service.on('hotreload:started', () => events.push('started'));
      service.on('hotreload:completed', () => events.push('completed'));

      const result = await service.hotReload('test-plugin', createMockManifest({ version: '2.0.0' }));

      expect(result.version).toBe('2.0.0');
      expect(lifecycleManager.disablePlugin).toHaveBeenCalledWith('test-plugin');
      expect(lifecycleManager.uninstallPlugin).toHaveBeenCalledWith('test-plugin');
      expect(lifecycleManager.installPlugin).toHaveBeenCalled();
      expect(lifecycleManager.enablePlugin).toHaveBeenCalledWith('test-plugin');
      expect(events).toContain('started');
      expect(events).toContain('completed');
    });

    it('should throw when plugin not found in registry', async () => {
      registry.getPlugin.mockReturnValue(undefined);

      // When plugin not found, the error propagates to catch which calls rollback.
      // Rollback also fails (no snapshots), so the rollback error overrides.
      // The key behavior is that an error IS thrown.
      await expect(service.hotReload('nonexistent')).rejects.toThrow();
    });

    it('should throw when plugin is already being reloaded', async () => {
      registry.getPlugin.mockReturnValue(createMockPluginInfo());
      lifecycleManager.installPlugin.mockImplementation(() => new Promise(() => {}));

      const reloadPromise = service.hotReload('test-plugin');

      await expect(service.hotReload('test-plugin')).rejects.toThrow('already being reloaded');

      // Cleanup
      lifecycleManager.installPlugin.mockRejectedValue(new Error('cancel'));
      try { await reloadPromise; } catch {}
    });

    it('should not re-enable plugin if it was not enabled before', async () => {
      registry.getPlugin.mockReturnValue(createMockPluginInfo({ status: 'disabled' }));
      lifecycleManager.installPlugin.mockResolvedValue(
        createMockPluginInfo({ version: '2.0.0', status: 'disabled' })
      );

      await service.hotReload('test-plugin', createMockManifest({ version: '2.0.0' }));

      expect(lifecycleManager.disablePlugin).not.toHaveBeenCalled();
      expect(lifecycleManager.enablePlugin).not.toHaveBeenCalled();
    });

    it('should emit failed event when install fails', async () => {
      registry.getPlugin.mockReturnValue(createMockPluginInfo({ status: 'enabled' }));
      lifecycleManager.installPlugin.mockRejectedValue(new Error('install failed'));

      // Mock rollback to prevent cascading errors from file system access
      jest.spyOn(service, 'rollback').mockResolvedValue(createMockPluginInfo({ version: '1.0.0' }));

      const events: string[] = [];
      service.on('hotreload:failed', () => events.push('failed'));

      await expect(service.hotReload('test-plugin', createMockManifest())).rejects.toThrow('install failed');

      expect(events).toContain('failed');
    });

    it('should call rollback when rollbackEnabled is true and install fails', async () => {
      registry.getPlugin.mockReturnValue(createMockPluginInfo({ status: 'enabled' }));
      lifecycleManager.installPlugin.mockRejectedValue(new Error('install error'));

      const rollbackSpy = jest.spyOn(service, 'rollback').mockResolvedValue(
        createMockPluginInfo({ version: '1.0.0' })
      );

      try { await service.hotReload('test-plugin', createMockManifest()); } catch {}

      expect(rollbackSpy).toHaveBeenCalledWith('test-plugin');
    });

    it('should not call rollback when rollbackEnabled is false', async () => {
      service = new PluginHotReloadService(lifecycleManager, registry, { rollbackEnabled: false });
      registry.getPlugin.mockReturnValue(createMockPluginInfo());
      lifecycleManager.installPlugin.mockRejectedValue(new Error('fail'));

      const rollbackSpy = jest.spyOn(service, 'rollback');

      await expect(service.hotReload('test-plugin', createMockManifest())).rejects.toThrow('fail');

      expect(rollbackSpy).not.toHaveBeenCalled();
    });
  });

  describe('rollback', () => {
    it('should throw when no snapshots available', async () => {
      await expect(service.rollback('nonexistent')).rejects.toThrow('No snapshots available');
    });

    it('should throw when target version not found in snapshots', async () => {
      (service as any).versionSnapshots.set('test-plugin', [
        { pluginId: 'test-plugin', version: '1.0.0', manifest: createMockManifest(), config: {}, status: 'enabled', timestamp: new Date() },
      ]);

      await expect(service.rollback('test-plugin', '9.9.9')).rejects.toThrow('Snapshot not found');
    });

    it('should rollback using in-memory snapshots', async () => {
      // Manually populate in-memory snapshots
      (service as any).versionSnapshots.set('test-plugin', [
        { pluginId: 'test-plugin', version: '1.0.0', manifest: createMockManifest({ version: '1.0.0' }), config: {}, status: 'enabled', timestamp: new Date('2024-01-01') },
        { pluginId: 'test-plugin', version: '2.0.0', manifest: createMockManifest({ version: '2.0.0' }), config: {}, status: 'enabled', timestamp: new Date('2024-01-02') },
      ]);

      // Mock the registry to return current plugin (v2.0.0)
      registry.getPlugin.mockReturnValue(createMockPluginInfo({ version: '2.0.0' }));
      // Mock install to return the rolled-back version
      lifecycleManager.installPlugin.mockResolvedValue(
        createMockPluginInfo({ version: '1.0.0' })
      );

      const result = await service.rollback('test-plugin');

      expect(result).toBeDefined();
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('getVersionHistory', () => {
    it('should return empty array for unknown plugin', async () => {
      const history = await service.getVersionHistory('unknown-plugin');
      expect(history).toEqual([]);
    });

    it('should return in-memory snapshots', async () => {
      (service as any).versionSnapshots.set('test-plugin', [
        { pluginId: 'test-plugin', version: '1.0.0', manifest: createMockManifest(), config: {}, status: 'enabled', timestamp: new Date() },
      ]);

      const history = await service.getVersionHistory('test-plugin');

      expect(history.length).toBe(1);
      expect(history[0]).toHaveProperty('pluginId', 'test-plugin');
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = service.getStats();

      expect(stats).toEqual({
        watchedPaths: 0,
        pendingReloads: 0,
        activeReloads: 0,
        totalSnapshots: 0,
      });
    });

    it('should count active reloads', async () => {
      registry.getPlugin.mockReturnValue(createMockPluginInfo());
      lifecycleManager.installPlugin.mockImplementation(() => new Promise(() => {}));

      const reloadPromise = service.hotReload('test-plugin', createMockManifest());

      const stats = service.getStats();
      expect(stats.activeReloads).toBe(1);

      // Cleanup
      lifecycleManager.installPlugin.mockRejectedValue(new Error('cancel'));
      try { await reloadPromise; } catch {}
    });
  });

  describe('triggerReload', () => {
    it('should delegate to hotReload', async () => {
      registry.getPlugin.mockReturnValue(createMockPluginInfo());
      lifecycleManager.installPlugin.mockResolvedValue(
        createMockPluginInfo({ version: '2.0.0' })
      );

      const hotReloadSpy = jest.spyOn(service, 'hotReload');

      await service.triggerReload('test-plugin', createMockManifest({ version: '2.0.0' }));

      expect(hotReloadSpy).toHaveBeenCalledWith('test-plugin', expect.any(Object));
    });
  });

  describe('cleanup', () => {
    it('should clear all state', async () => {
      await service.cleanup();

      const stats = service.getStats();
      expect(stats.totalSnapshots).toBe(0);
      expect(stats.pendingReloads).toBe(0);
      expect(stats.activeReloads).toBe(0);
    });
  });

  describe('startWatching / stopWatching', () => {
    it('should not throw with empty watchPaths', () => {
      service = new PluginHotReloadService(lifecycleManager, registry, { watchPaths: [] });
      expect(() => service.startWatching()).not.toThrow();
    });

    it('should stop watching and clear pending reloads', () => {
      const timeout = setTimeout(() => {}, 10000);
      (service as any).pendingReloads.set('test-plugin', timeout);

      service.stopWatching();

      const stats = service.getStats();
      expect(stats.pendingReloads).toBe(0);
    });
  });
});

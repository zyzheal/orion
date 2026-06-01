/**
 * Plugin Registry Tests
 *
 * Tests for plugin registration, discovery, validation,
 * version compatibility, and listing functionality.
 */

import { PluginRegistry } from '../PluginRegistry';
import { PluginManifest, PluginStatus } from '../types';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

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

  beforeEach(async () => {
    registry = new PluginRegistry();
  });

  describe('register', () => {
    it('should register a valid plugin', async () => {
      const manifest = createManifest();
      const result = await registry.register(manifest);

      expect(result.manifest).toEqual(manifest);
      expect(result.status).toBe('installed');
      expect(result.installDate).toBeInstanceOf(Date);
    });

    it('should store plugin config', async () => {
      const manifest = createManifest();
      const config = { key: 'value' };
      const result = await registry.register(manifest, config);

      expect(result.config).toEqual(config);
    });

    it('should reject a manifest with missing name', async () => {
      const manifest = createManifest({ name: '' });

      await expect(registry.register(manifest)).rejects.toThrow('Invalid plugin manifest');
    });

    it('should reject a manifest with invalid semver', async () => {
      const manifest = createManifest({ version: 'invalid' });

      await expect(registry.register(manifest)).rejects.toThrow('not a valid semver');
    });

    it('should reject a manifest with missing description', async () => {
      const manifest = createManifest({ description: '' });

      await expect(registry.register(manifest)).rejects.toThrow('description is required');
    });

    it('should reject a manifest with missing author', async () => {
      const manifest = createManifest({ author: '' });

      await expect(registry.register(manifest)).rejects.toThrow('author is required');
    });

    it('should reject a manifest with missing entryPoint', async () => {
      const manifest = createManifest({ entryPoint: '' });

      await expect(registry.register(manifest)).rejects.toThrow('entryPoint is required');
    });

    it('should reject a manifest with empty capabilities', async () => {
      const manifest = createManifest({ capabilities: [] });

      await expect(registry.register(manifest)).rejects.toThrow('capabilities is required');
    });

    it('should reject a manifest with uppercase name', async () => {
      const manifest = createManifest({ name: 'Test-Plugin' });

      await expect(registry.register(manifest)).rejects.toThrow('name must be lowercase');
    });

    it('should reject a manifest with platform version incompatibility', async () => {
      const manifest = createManifest({ minPlatformVersion: '2.0.0' });

      await expect(registry.register(manifest)).rejects.toThrow('Platform version below minimum required');
    });

    it('should reject a manifest exceeding max platform version', async () => {
      const manifest = createManifest({ maxPlatformVersion: '0.5.0' });

      await expect(registry.register(manifest)).rejects.toThrow('Platform version above maximum supported');
    });

    it('should accept a manifest with compatible platform version range', async () => {
      const manifest = createManifest({
        minPlatformVersion: '0.5.0',
        maxPlatformVersion: '2.0.0',
      });

      const result = await registry.register(manifest);
      expect(result.status).toBe('installed');
    });
  });

  describe('getPlugin', () => {
    it('should return undefined for unknown plugin', async () => {
      const result = registry.getPlugin('unknown');
      expect(result).toBeUndefined();
    });

    it('should return plugin info for registered plugin', async () => {
      const manifest = createManifest();
      await registry.register(manifest);

      const result = registry.getPlugin('test-plugin');
      expect(result).toBeDefined();
      expect(result!.manifest.name).toBe('test-plugin');
    });
  });

  describe('listPlugins', () => {
    beforeEach(async () => {
      await registry.register(createManifest({ name: 'plugin-a', tags: ['security', 'scan'] }));
      await registry.register(createManifest({ name: 'plugin-b', tags: ['quality', 'lint'] }));
      await registry.register(createManifest({ name: 'plugin-c', tags: ['security', 'deploy'] }));
    });

    it('should return all plugins by default', async () => {
      const plugins = registry.listPlugins();
      expect(plugins.length).toBe(3);
    });

    it('should filter by status', async () => {
      await registry.updateStatus('plugin-a', 'enabled');
      await registry.updateStatus('plugin-b', 'disabled');

      const enabled = registry.listPlugins({ statusFilter: 'enabled' as PluginStatus });
      expect(enabled.length).toBe(1);
      expect(enabled[0].manifest.name).toBe('plugin-a');
    });

    it('should filter by capability', async () => {
      const plugins = registry.listPlugins({ capabilityFilter: 'custom' });
      expect(plugins.length).toBe(3);
    });

    it('should filter by tags', async () => {
      const plugins = registry.listPlugins({ tagFilter: ['security'] });
      expect(plugins.length).toBe(2);
    });

    it('should return empty array for non-matching filter', async () => {
      const plugins = registry.listPlugins({ tagFilter: ['nonexistent'] });
      expect(plugins.length).toBe(0);
    });
  });

  describe('updateStatus', () => {
    beforeEach(async () => {
      await registry.register(createManifest());
    });

    it('should update plugin status', async () => {
      const result = await registry.updateStatus('test-plugin', 'enabled');
      expect(result).toBeDefined();
      expect(result!.status).toBe('enabled');
    });

    it('should set enabledDate when enabling', async () => {
      await registry.updateStatus('test-plugin', 'enabled');
      const plugin = registry.getPlugin('test-plugin');
      expect(plugin!.enabledDate).toBeInstanceOf(Date);
    });

    it('should set error message when status is error', async () => {
      await registry.updateStatus('test-plugin', 'error', 'Something went wrong');
      const plugin = registry.getPlugin('test-plugin');
      expect(plugin!.error).toBe('Something went wrong');
    });

    it('should return undefined for unknown plugin', async () => {
      const result = await registry.updateStatus('unknown', 'enabled');
      expect(result).toBeUndefined();
    });
  });

  describe('updateConfig', () => {
    beforeEach(async () => {
      await registry.register(createManifest(), { existing: 'value' });
    });

    it('should merge new config with existing', async () => {
      const result = registry.updateConfig('test-plugin', { newKey: 'newValue' });
      expect(result!.config).toEqual({ existing: 'value', newKey: 'newValue' });
    });

    it('should return undefined for unknown plugin', async () => {
      const result = registry.updateConfig('unknown', { key: 'value' });
      expect(result).toBeUndefined();
    });
  });

  describe('remove', () => {
    beforeEach(async () => {
      await registry.register(createManifest());
    });

    it('should remove a plugin', async () => {
      const result = registry.remove('test-plugin');
      expect(result).toBe(true);
      expect(registry.getPlugin('test-plugin')).toBeUndefined();
    });

    it('should return false for unknown plugin', async () => {
      const result = registry.remove('unknown');
      expect(result).toBe(false);
    });
  });

  describe('hasPlugin', () => {
    beforeEach(async () => {
      await registry.register(createManifest());
    });

    it('should return true for registered plugin', async () => {
      expect(registry.hasPlugin('test-plugin')).toBe(true);
    });

    it('should return false for unknown plugin', async () => {
      expect(registry.hasPlugin('unknown')).toBe(false);
    });
  });

  describe('getPluginCount', () => {
    it('should return 0 when empty', async () => {
      expect(registry.getPluginCount()).toBe(0);
    });

    it('should return correct count after registration', async () => {
      await registry.register(createManifest({ name: 'a' }));
      await registry.register(createManifest({ name: 'b' }));

      expect(registry.getPluginCount()).toBe(2);
    });

    it('should decrease after removal', async () => {
      await registry.register(createManifest({ name: 'a' }));
      registry.remove('a');

      expect(registry.getPluginCount()).toBe(0);
    });
  });

  describe('discover', () => {
    it('should return empty array when plugin directory does not exist', async () => {
      const nonExistentRegistry = new PluginRegistry({
        pluginDirectory: '/nonexistent/plugin/path',
      });

      const result = await nonExistentRegistry.discover();
      expect(result).toEqual([]);
    });
  });

  describe('event emission', () => {
    it('should emit plugin:registered event', async () => {
      const handler = jest.fn();
      registry.on('plugin:registered', handler);

      await registry.register(createManifest());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ pluginId: 'test-plugin', version: '1.0.0' })
      );
    });
  });

  describe('version comparison', () => {
    it('should register plugins with pre-release versions', async () => {
      const manifest = createManifest({ version: '1.0.0-beta.1' });
      const result = await registry.register(manifest);
      expect(result.manifest.version).toBe('1.0.0-beta.1');
    });

    it('should register plugins with build metadata versions', async () => {
      const manifest = createManifest({ version: '1.0.0+build.123' });
      const result = await registry.register(manifest);
      expect(result.manifest.version).toBe('1.0.0+build.123');
    });
  });
});

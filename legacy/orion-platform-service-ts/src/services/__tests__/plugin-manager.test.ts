/**
 * Plugin Manager Service 测试
 */

import { PluginManagerService } from '../plugin-manager-service';
import { EventBusService } from '../event-bus-service';

describe('PluginManagerService', () => {
  let pluginManager: PluginManagerService;
  let mockEventBus: jest.Mocked<EventBusService>;

  beforeEach(() => {
    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
      isHealthy: jest.fn().mockReturnValue(true),
    } as any;

    pluginManager = new PluginManagerService({ eventBus: mockEventBus });
  });

  describe('listAvailablePlugins', () => {
    it('should return list of available plugins', async () => {
      const plugins = await pluginManager.listAvailablePlugins();

      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins[0]).toHaveProperty('id');
      expect(plugins[0]).toHaveProperty('name');
      expect(plugins[0]).toHaveProperty('type');
    });

    it('should filter by type', async () => {
      const plugins = await pluginManager.listAvailablePlugins({
        typeFilter: 'CUSTOM_TASK',
      });

      plugins.forEach((plugin) => {
        expect(plugin.type).toBe('CUSTOM_TASK');
      });
    });

    it('should filter by tags', async () => {
      const plugins = await pluginManager.listAvailablePlugins({
        tagsFilter: ['security'],
      });

      plugins.forEach((plugin) => {
        expect(plugin.tags).toContain('security');
      });
    });
  });

  describe('installPlugin', () => {
    it('should install a plugin successfully', async () => {
      const plugin = await pluginManager.installPlugin('security-scan', '1.0.0');

      expect(plugin.id).toBe('security-scan');
      expect(plugin.state).toBe('INSTALLED');
      expect(plugin.version).toBe('1.0.0');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugin.installed',
        expect.any(Object),
        { source: 'plugin-manager' }
      );
    });

    it('should throw error if plugin already installed', async () => {
      await pluginManager.installPlugin('security-scan', '1.0.0');

      await expect(
        pluginManager.installPlugin('security-scan', '1.0.0')
      ).rejects.toThrow('already installed');
    });

    it('should throw error if plugin not found', async () => {
      await expect(
        pluginManager.installPlugin('non-existent-plugin', '1.0.0')
      ).rejects.toThrow('not found');
    });
  });

  describe('uninstallPlugin', () => {
    beforeEach(async () => {
      await pluginManager.installPlugin('security-scan', '1.0.0');
    });

    it('should uninstall a plugin successfully', async () => {
      const plugin = await pluginManager.uninstallPlugin('security-scan');

      expect(plugin.state).toBe('UNINSTALLED');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugin.uninstalled',
        expect.any(Object),
        { source: 'plugin-manager' }
      );
    });

    it('should throw error if plugin not found', async () => {
      await expect(
        pluginManager.uninstallPlugin('non-existent-plugin')
      ).rejects.toThrow('not found');
    });
  });

  describe('activatePlugin', () => {
    beforeEach(async () => {
      await pluginManager.installPlugin('security-scan', '1.0.0');
    });

    it('should activate a plugin successfully', async () => {
      const plugin = await pluginManager.activatePlugin('security-scan');

      expect(plugin.state).toBe('ACTIVE');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugin.activated',
        expect.any(Object),
        { source: 'plugin-manager' }
      );
    });

    it('should create runtime info for activated plugin', async () => {
      await pluginManager.activatePlugin('security-scan');
      const details = await pluginManager.getPluginDetails('security-scan');

      // Runtime info 应该在激活后创建
      expect(details.runtimeInfo).toBeDefined();
    });
  });

  describe('deactivatePlugin', () => {
    beforeEach(async () => {
      await pluginManager.installPlugin('security-scan', '1.0.0');
      await pluginManager.activatePlugin('security-scan');
    });

    it('should deactivate a plugin successfully', async () => {
      const plugin = await pluginManager.deactivatePlugin('security-scan');

      expect(plugin.state).toBe('INACTIVE');
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugin.deactivated',
        expect.any(Object),
        { source: 'plugin-manager' }
      );
    });
  });

  describe('configurePlugin', () => {
    beforeEach(async () => {
      await pluginManager.installPlugin('security-scan', '1.0.0');
    });

    it('should configure a plugin successfully', async () => {
      const config = { scanType: 'fs', severity: 'CRITICAL,HIGH' };
      const plugin = await pluginManager.configurePlugin('security-scan', config);

      expect(plugin.state).toBe('CONFIGURED');
      expect(plugin.config).toEqual(config);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'plugin.configured',
        expect.any(Object),
        { source: 'plugin-manager' }
      );
    });

    it('should throw error if required config field missing', async () => {
      await expect(
        pluginManager.configurePlugin('security-scan', {})
      ).rejects.toThrow('Missing required config field');
    });
  });

  describe('listInstalledPlugins', () => {
    beforeEach(async () => {
      await pluginManager.installPlugin('security-scan', '1.0.0');
      await pluginManager.installPlugin('code-quality', '1.0.0');
    });

    it('should return list of installed plugins', async () => {
      const plugins = await pluginManager.listInstalledPlugins();

      expect(plugins.length).toBe(2);
    });

    it('should filter by type', async () => {
      const plugins = await pluginManager.listInstalledPlugins({
        typeFilter: 'CUSTOM_TASK',
      });

      expect(plugins.length).toBe(2);
    });

    it('should filter by state', async () => {
      const plugins = await pluginManager.listInstalledPlugins({
        stateFilter: 'INSTALLED',
      });

      expect(plugins.length).toBe(2);
    });
  });
});

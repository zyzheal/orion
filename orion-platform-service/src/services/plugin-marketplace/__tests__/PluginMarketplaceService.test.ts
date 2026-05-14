/**
 * PluginMarketplaceService Tests
 */

import {
  PluginMarketplaceService,
  PublishPluginInput,
  InstallPluginInput,
  ReviewPluginInput,
} from '../PluginMarketplaceService';

describe('PluginMarketplaceService', () => {
  let service: PluginMarketplaceService;

  beforeEach(() => {
    // Use null for in-memory mode
    service = new PluginMarketplaceService(null);
  });

  describe('listPlugins', () => {
    it('should list all plugins by default', async () => {
      const result = await service.listPlugins();

      expect(result.total).toBeGreaterThan(0);
      expect(result.data.length).toBe(result.total);
    });

    it('should filter plugins by category', async () => {
      const result = await service.listPlugins({ category: 'deployment' });

      for (const plugin of result.data) {
        expect(plugin.category).toBe('deployment');
      }
    });

    it('should apply pagination', async () => {
      const result = await service.listPlugins({ limit: 1, offset: 0 });

      expect(result.data.length).toBe(1);
    });
  });

  describe('getPlugin', () => {
    it('should return plugin by ID', async () => {
      const listResult = await service.listPlugins();
      const plugin = await service.getPlugin(listResult.data[0].id);

      expect(plugin).toBeDefined();
      expect(plugin?.id).toBe(listResult.data[0].id);
    });

    it('should return undefined for non-existent plugin', async () => {
      const plugin = await service.getPlugin('non-existent-id');
      expect(plugin).toBeUndefined();
    });
  });

  describe('publishPlugin', () => {
    it('should publish a new plugin with unique name', async () => {
      const timestamp = Date.now();
      const input: PublishPluginInput = {
        name: `test-plugin-${timestamp}`,
        description: 'A test plugin',
        author: 'Test Author',
        category: 'utility',
        version: '1.0.0',
        tags: ['test', 'utility'],
      };

      const plugin = await service.publishPlugin('tenant-1', input);

      expect(plugin.id).toBeDefined();
      expect(plugin.name).toBe(`test-plugin-${timestamp}`);
      expect(plugin.description).toBe('A test plugin');
      expect(plugin.category).toBe('utility');
      expect(plugin.verified).toBe(false);
    });

    it('should publish a second plugin with unique name', async () => {
      const timestamp = Date.now() + 1000;
      const input: PublishPluginInput = {
        name: `test-plugin-${timestamp}`,
        description: 'Another test plugin',
        author: 'Test Author 2',
        category: 'utility',
        version: '2.0.0',
        tags: ['test'],
      };

      const plugin = await service.publishPlugin('tenant-1', input);

      expect(plugin.name).toBe(`test-plugin-${timestamp}`);
      expect(plugin.version).toBe('2.0.0');
    });
  });

  describe('installPlugin', () => {
    it('should install a plugin for a tenant', async () => {
      const timestamp = Date.now();

      // First publish a unique plugin
      const input: PublishPluginInput = {
        name: `install-test-${timestamp}`,
        description: 'Test',
        author: 'Author',
        category: 'utility',
        version: '1.0.0',
        tags: [],
      };
      const published = await service.publishPlugin('tenant-install', input);

      const installInput: InstallPluginInput = {
        tenant_id: `tenant-install-${timestamp}`,
        plugin_id: published.id,
      };

      const install = await service.installPlugin(installInput, 'tenant-install');

      expect(install.id).toBeDefined();
      expect(install.plugin_id).toBe(published.id);
      expect(install.status).toBe('active');
    });
  });

  describe('reviewPlugin', () => {
    it('should submit a review for a plugin', async () => {
      const listResult = await service.listPlugins({ limit: 1 });
      const pluginId = listResult.data[0].id;
      const userId = `user-review-${Date.now()}-${Math.random()}`;

      const input: ReviewPluginInput = {
        plugin_id: pluginId,
        user_id: userId,
        rating: 5,
        comment: 'Great plugin!',
      };

      const review = await service.reviewPlugin(input);

      expect(review.id).toBeDefined();
      expect(review.plugin_id).toBe(pluginId);
      expect(review.rating).toBe(5);
      expect(review.comment).toBe('Great plugin!');
    });
  });

  describe('getPluginQualityScore', () => {
    it('should calculate quality score for a plugin', async () => {
      const listResult = await service.listPlugins({ limit: 1 });
      const pluginId = listResult.data[0].id;

      const score = await service.getPluginQualityScore(pluginId);

      expect(score.pluginId).toBe(pluginId);
      expect(score.overallScore).toBeDefined();
      expect(score.securityScore).toBeDefined();
      expect(score.reliabilityScore).toBeDefined();
    });
  });

  describe('getPluginStats', () => {
    it('should return marketplace statistics', async () => {
      const stats = await service.getPluginStats();

      expect(stats.totalPlugins).toBeGreaterThan(0);
      expect(stats.totalInstalls).toBeGreaterThanOrEqual(0);
      expect(stats.pluginsByCategory).toBeDefined();
    });
  });
});
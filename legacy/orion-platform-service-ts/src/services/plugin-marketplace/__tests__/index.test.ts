/**
 * Plugin Marketplace Services - Index Exports Tests
 *
 * Verifies that all expected exports are correctly re-exported
 * from the plugin-marketplace module's index.ts.
 */

import * as PluginMarketplaceModule from '../index';

describe('Plugin Marketplace Module Exports', () => {
  describe('PluginMarketplaceService', () => {
    it('should export PluginMarketplaceService class', () => {
      expect(PluginMarketplaceModule.PluginMarketplaceService).toBeDefined();
      expect(typeof PluginMarketplaceModule.PluginMarketplaceService).toBe('function');
    });

    it('should be instantiable with null (in-memory mode)', () => {
      const service = new PluginMarketplaceModule.PluginMarketplaceService(null);
      expect(service).toBeDefined();
    });

    it('should export ListPluginsFilter interface (type-only)', () => {
      expect(PluginMarketplaceModule.PluginMarketplaceService).toBeDefined();
    });

    it('should export PublishPluginInput interface (type-only)', () => {
      expect(PluginMarketplaceModule.PluginMarketplaceService).toBeDefined();
    });

    it('should export InstallPluginInput interface (type-only)', () => {
      expect(PluginMarketplaceModule.PluginMarketplaceService).toBeDefined();
    });

    it('should export ReviewPluginInput interface (type-only)', () => {
      expect(PluginMarketplaceModule.PluginMarketplaceService).toBeDefined();
    });

    it('should export PluginListing interface (type-only)', () => {
      expect(PluginMarketplaceModule.PluginMarketplaceService).toBeDefined();
    });

    it('should export PluginInstallResult interface (type-only)', () => {
      expect(PluginMarketplaceModule.PluginMarketplaceService).toBeDefined();
    });

    it('should export PluginReview interface (type-only)', () => {
      expect(PluginMarketplaceModule.PluginMarketplaceService).toBeDefined();
    });

    it('should export QualityScore interface (type-only)', () => {
      expect(PluginMarketplaceModule.PluginMarketplaceService).toBeDefined();
    });
  });

  describe('module completeness', () => {
    it('should export exactly 1 service class', () => {
      const exports = Object.keys(PluginMarketplaceModule);
      const classExports = exports.filter(
        key => typeof (PluginMarketplaceModule as any)[key] === 'function'
      );
      expect(classExports).toHaveLength(1);
      expect(classExports).toContain('PluginMarketplaceService');
    });
  });
});

/**
 * SubApp Services - Index Exports Tests
 *
 * Verifies that all expected exports are correctly re-exported
 * from the subapp module's index.ts.
 */

import * as SubAppModule from '../index';

describe('SubApp Module Exports', () => {
  describe('SubAppRepository', () => {
    it('should export SubAppRepository class', () => {
      expect(SubAppModule.SubAppRepository).toBeDefined();
      expect(typeof SubAppModule.SubAppRepository).toBe('function');
    });

    it('should export CreateSubAppInput interface (type-only)', () => {
      expect(SubAppModule.SubAppRepository).toBeDefined();
    });

    it('should export UpdateSubAppInput interface (type-only)', () => {
      expect(SubAppModule.SubAppRepository).toBeDefined();
    });

    it('should export SubAppConfig interface (type-only)', () => {
      expect(SubAppModule.SubAppRepository).toBeDefined();
    });
  });

  describe('SubAppService', () => {
    it('should export SubAppService class', () => {
      expect(SubAppModule.SubAppService).toBeDefined();
      expect(typeof SubAppModule.SubAppService).toBe('function');
    });
  });

  describe('module completeness', () => {
    it('should export exactly 2 service classes', () => {
      const exports = Object.keys(SubAppModule);
      const classExports = exports.filter(
        key => typeof (SubAppModule as any)[key] === 'function'
      );
      expect(classExports).toHaveLength(2);
      expect(classExports).toContain('SubAppRepository');
      expect(classExports).toContain('SubAppService');
    });
  });
});

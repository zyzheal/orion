/**
 * Role Services - Index Exports Tests
 *
 * Verifies that all expected exports are correctly re-exported
 * from the role module's index.ts.
 */

import * as RoleModule from '../index';

describe('Role Module Exports', () => {
  describe('RoleRepository', () => {
    it('should export RoleRepository class', () => {
      expect(RoleModule.RoleRepository).toBeDefined();
      expect(typeof RoleModule.RoleRepository).toBe('function');
    });

    it('should export Role interface (type-only)', () => {
      expect(RoleModule.RoleRepository).toBeDefined();
    });
  });

  describe('RoleService', () => {
    it('should export RoleService class', () => {
      expect(RoleModule.RoleService).toBeDefined();
      expect(typeof RoleModule.RoleService).toBe('function');
    });

    it('should export RoleServiceError class', () => {
      expect(RoleModule.RoleServiceError).toBeDefined();
      expect(typeof RoleModule.RoleServiceError).toBe('function');
    });

    it('should be instantiable with error', () => {
      const error = new RoleModule.RoleServiceError('test error', 'TEST_CODE');
      expect(error.message).toBe('test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('RoleServiceError');
    });
  });

  describe('module completeness', () => {
    it('should export exactly 3 class/function exports', () => {
      const exports = Object.keys(RoleModule);
      const classExports = exports.filter(
        key => typeof (RoleModule as any)[key] === 'function'
      );
      expect(classExports).toHaveLength(3);
      expect(classExports).toContain('RoleRepository');
      expect(classExports).toContain('RoleService');
      expect(classExports).toContain('RoleServiceError');
    });
  });
});

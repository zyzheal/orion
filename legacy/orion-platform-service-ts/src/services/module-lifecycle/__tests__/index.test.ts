/**
 * module-lifecycle index.ts re-export tests
 *
 * Verifies that all public symbols are correctly re-exported from the module entry point.
 */

// Mock the repository to avoid DB dependency
jest.mock('../../../repositories/ModuleRegistryRepository', () => ({
  ModuleRegistryRepository: jest.fn().mockImplementation(() => ({
    findById: jest.fn().mockResolvedValue(null),
    findAllModules: jest.fn().mockResolvedValue([]),
    upsertModule: jest.fn().mockResolvedValue(undefined),
    updateState: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  })),
}));

import * as moduleLifecycle from '../index';

describe('module-lifecycle index', () => {
  describe('re-exports', () => {
    it('should export ModuleRegistry class', () => {
      expect(moduleLifecycle.ModuleRegistry).toBeDefined();
      expect(typeof moduleLifecycle.ModuleRegistry).toBe('function');
    });

    it('should export ModuleManager class', () => {
      expect(moduleLifecycle.ModuleManager).toBeDefined();
      expect(typeof moduleLifecycle.ModuleManager).toBe('function');
    });

    it('should be able to instantiate ModuleRegistry with db', () => {
      const mockDb = { query: jest.fn() };
      const registry = new moduleLifecycle.ModuleRegistry(mockDb as any);
      expect(registry).toBeDefined();
    });

    it('should be able to instantiate ModuleManager with config and db', () => {
      const mockDb = { query: jest.fn() };
      const config = () => ({});
      const manager = new moduleLifecycle.ModuleManager(config, mockDb as any);
      expect(manager).toBeDefined();
      expect(manager.getRegistry()).toBeDefined();
    });
  });
});

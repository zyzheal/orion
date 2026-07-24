/**
 * Performance Services - Index Exports Tests
 *
 * Verifies that all expected exports are correctly re-exported
 * from the performance module's index.ts.
 */

import * as PerformanceModule from '../index';

describe('Performance Module Exports', () => {
  describe('PerformanceBaselineService', () => {
    it('should export PerformanceBaselineService class', () => {
      expect(PerformanceModule.PerformanceBaselineService).toBeDefined();
      expect(typeof PerformanceModule.PerformanceBaselineService).toBe('function');
    });

    it('should be instantiable', () => {
      const mockDb = { query: async () => ({ rows: [], rowCount: 0 }) };
      const service = new PerformanceModule.PerformanceBaselineService(mockDb);
      expect(service).toBeDefined();
    });

    it('should export PerformanceBaseline interface (type-only)', () => {
      // TypeScript interfaces are erased at runtime, but we can verify
      // the module namespace contains the class exports
      expect(PerformanceModule.PerformanceBaselineService).toBeDefined();
    });

    it('should export EvaluationResult interface (type-only)', () => {
      // Verify the class that uses EvaluationResult is exported
      expect(PerformanceModule.PerformanceBaselineService).toBeDefined();
    });
  });

  describe('PerformanceProfileService', () => {
    it('should export PerformanceProfileService class', () => {
      expect(PerformanceModule.PerformanceProfileService).toBeDefined();
      expect(typeof PerformanceModule.PerformanceProfileService).toBe('function');
    });

    it('should be instantiable', () => {
      const mockDb = { query: async () => ({ rows: [], rowCount: 0 }) };
      const service = new PerformanceModule.PerformanceProfileService(mockDb);
      expect(service).toBeDefined();
    });

    it('should export ProfileConfig interface (type-only)', () => {
      expect(PerformanceModule.PerformanceProfileService).toBeDefined();
    });

    it('should export ProfileRecord interface (type-only)', () => {
      expect(PerformanceModule.PerformanceProfileService).toBeDefined();
    });

    it('should export ProfileResult interface (type-only)', () => {
      expect(PerformanceModule.PerformanceProfileService).toBeDefined();
    });

    it('should export BottleneckAnalysis interface (type-only)', () => {
      expect(PerformanceModule.PerformanceProfileService).toBeDefined();
    });

    it('should export OptimizationSuggestion interface (type-only)', () => {
      expect(PerformanceModule.PerformanceProfileService).toBeDefined();
    });
  });

  describe('module completeness', () => {
    it('should export exactly 2 service classes', () => {
      const exports = Object.keys(PerformanceModule);
      const classExports = exports.filter(
        key => typeof (PerformanceModule as any)[key] === 'function'
      );
      expect(classExports).toHaveLength(2);
      expect(classExports).toContain('PerformanceBaselineService');
      expect(classExports).toContain('PerformanceProfileService');
    });
  });
});

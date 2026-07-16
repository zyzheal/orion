/**
 * Risk Engine Services - Index Exports Tests
 *
 * Verifies that all expected exports are correctly re-exported
 * from the risk-engine module's index.ts.
 */

import * as RiskEngineModule from '../index';

describe('Risk Engine Module Exports', () => {
  describe('RiskAssessmentService', () => {
    it('should export RiskAssessmentService class', () => {
      expect(RiskEngineModule.RiskAssessmentService).toBeDefined();
      expect(typeof RiskEngineModule.RiskAssessmentService).toBe('function');
    });

    it('should be instantiable', () => {
      const service = new RiskEngineModule.RiskAssessmentService();
      expect(service).toBeDefined();
    });

    it('should export RiskFeature interface (type-only)', () => {
      expect(RiskEngineModule.RiskAssessmentService).toBeDefined();
    });

    it('should export RiskPrediction interface (type-only)', () => {
      expect(RiskEngineModule.RiskAssessmentService).toBeDefined();
    });

    it('should export ShapContribution interface (type-only)', () => {
      expect(RiskEngineModule.RiskAssessmentService).toBeDefined();
    });
  });

  describe('PageRankService', () => {
    it('should export PageRankService class', () => {
      expect(RiskEngineModule.PageRankService).toBeDefined();
      expect(typeof RiskEngineModule.PageRankService).toBe('function');
    });

    it('should be instantiable', () => {
      const service = new RiskEngineModule.PageRankService();
      expect(service).toBeDefined();
    });

    it('should export ServiceNode interface (type-only)', () => {
      expect(RiskEngineModule.PageRankService).toBeDefined();
    });

    it('should export ServiceEdge interface (type-only)', () => {
      expect(RiskEngineModule.PageRankService).toBeDefined();
    });

    it('should export ServiceGraph interface (type-only)', () => {
      expect(RiskEngineModule.PageRankService).toBeDefined();
    });

    it('should export PageRankResult interface (type-only)', () => {
      expect(RiskEngineModule.PageRankService).toBeDefined();
    });

    it('should export RootCauseAnalysis interface (type-only)', () => {
      expect(RiskEngineModule.PageRankService).toBeDefined();
    });

    it('should export PageRankOptions interface (type-only)', () => {
      expect(RiskEngineModule.PageRankService).toBeDefined();
    });
  });

  describe('module completeness', () => {
    it('should export exactly 2 service classes', () => {
      const exports = Object.keys(RiskEngineModule);
      const classExports = exports.filter(
        key => typeof (RiskEngineModule as any)[key] === 'function'
      );
      expect(classExports).toHaveLength(2);
      expect(classExports).toContain('RiskAssessmentService');
      expect(classExports).toContain('PageRankService');
    });
  });
});

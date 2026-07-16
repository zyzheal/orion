/**
 * quality-gate index.ts export verification tests
 */

import * as QualityGateExports from '../index';

describe('quality-gate index exports', () => {
  it('should export QualityGateEnhancementService', () => {
    expect(QualityGateExports.QualityGateEnhancementService).toBeDefined();
    expect(typeof QualityGateExports.QualityGateEnhancementService).toBe('function');
  });
});

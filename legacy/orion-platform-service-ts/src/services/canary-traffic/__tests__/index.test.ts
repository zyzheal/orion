/**
 * canary-traffic/index.ts - Export verification tests
 */

import { CanaryTrafficManagerService } from '../CanaryTrafficManagerService';

// Re-import from index to verify exports
import * as indexExports from '../index';

describe('canary-traffic/index exports', () => {
  it('should export CanaryTrafficManagerService', () => {
    expect(indexExports.CanaryTrafficManagerService).toBe(CanaryTrafficManagerService);
  });

  it('should export all expected symbols', () => {
    expect(typeof indexExports.CanaryTrafficManagerService).toBe('function');
  });
});

/**
 * iac/index.ts - Export verification tests
 */

import { WorkspaceService } from '../WorkspaceService';
import { PlanService } from '../PlanService';

// Re-import from index to verify exports
import * as indexExports from '../index';

describe('iac/index exports', () => {
  it('should export WorkspaceService', () => {
    expect(indexExports.WorkspaceService).toBe(WorkspaceService);
  });

  it('should export PlanService', () => {
    expect(indexExports.PlanService).toBe(PlanService);
  });

  it('should export all expected symbols', () => {
    expect(typeof indexExports.WorkspaceService).toBe('function');
    expect(typeof indexExports.PlanService).toBe('function');
  });
});

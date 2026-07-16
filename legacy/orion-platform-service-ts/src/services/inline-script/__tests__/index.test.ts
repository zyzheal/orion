/**
 * inline-script/index.ts - Export verification tests
 */

import { InlineScriptService } from '../InlineScriptService';
import { WasmRuntime } from '../WasmRuntime';

// Re-import from index to verify exports
import * as indexExports from '../index';

describe('inline-script/index exports', () => {
  it('should export InlineScriptService', () => {
    expect(indexExports.InlineScriptService).toBe(InlineScriptService);
  });

  it('should export WasmRuntime', () => {
    expect(indexExports.WasmRuntime).toBe(WasmRuntime);
  });

  it('should export all expected symbols', () => {
    expect(typeof indexExports.InlineScriptService).toBe('function');
    expect(typeof indexExports.WasmRuntime).toBe('function');
  });
});

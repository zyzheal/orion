/**
 * api-market/index.ts - Export verification tests
 */

import { ApiMarketRepository } from '../ApiMarketRepository';
import { ApiMarketService, ApiMarketError } from '../ApiMarketService';

// Re-import from index to verify exports
import * as indexExports from '../index';

describe('api-market/index exports', () => {
  it('should export ApiMarketRepository', () => {
    expect(indexExports.ApiMarketRepository).toBe(ApiMarketRepository);
  });

  it('should export ApiMarketService', () => {
    expect(indexExports.ApiMarketService).toBe(ApiMarketService);
  });

  it('should export ApiMarketError', () => {
    expect(indexExports.ApiMarketError).toBe(ApiMarketError);
  });

  it('should export all expected symbols', () => {
    expect(typeof indexExports.ApiMarketRepository).toBe('function');
    expect(typeof indexExports.ApiMarketService).toBe('function');
    expect(typeof indexExports.ApiMarketError).toBe('function');
  });
});
